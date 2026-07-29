import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rscript = await findRscript();
if (rscript === undefined) {
  console.log("SKIP optional R oracle: Rscript is not installed or not on PATH.");
  process.exit(0);
}

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "foundation.json"), "utf8"),
);
const { createR } = await import(
  pathToFileURL(path.join(root, "packages", "nativr", "dist", "index.js")).href
);
const assetRoot = path.join(root, "packages", "nativr", "dist", "assets");
const runtime = await createR({
  execution: "inline",
  assets: {
    treeSitterRuntimeWasm: await wasmDataUrl(path.join(assetRoot, "web-tree-sitter.wasm")),
    rGrammarWasm: await wasmDataUrl(path.join(assetRoot, "tree-sitter-r.wasm")),
  },
});
let failures = 0;

for (const testCase of cases) {
  await runtime.reset();
  const nativr = await runtime.evalDetailed(testCase.code);
  const actual = snapshotCanonical(nativr.raw, nativr.visible, nativr.warnings.length > 0);
  const oracle = await runOracle(testCase.code);
  if (JSON.stringify(actual) !== JSON.stringify(oracle)) {
    failures += 1;
    console.error(
      `FAIL ${testCase.id}\n  R:      ${JSON.stringify(oracle)}\n  NativR: ${JSON.stringify(actual)}`,
    );
  } else {
    console.log(`PASS ${testCase.id}`);
  }
}

await runtime.dispose();
if (failures > 0) process.exitCode = 1;
else console.log(`Live R oracle: ${cases.length}/${cases.length} passed`);

function runOracle(code) {
  const wrapper = [
    "warnings <- character();",
    'result <- withVisible(withCallingHandlers(eval(parse(text = Sys.getenv("NATIVR_CASE")), envir = new.env(parent = baseenv())), warning = function(w) { warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning") }));',
    "value <- result$value;",
    'encode <- function(x) { vapply(seq_along(x), function(i) { if (is.nan(x[[i]])) "NaN" else if (is.na(x[[i]])) "NA" else if (is.logical(x[[i]])) if (x[[i]]) "TRUE" else "FALSE" else format(x[[i]], scientific = FALSE, trim = TRUE, digits = 17) }, character(1)) };',
    'cat(typeof(value), length(value), if (result$visible) "1" else "0", paste(encode(value), collapse = ","), if (length(warnings) > 0) "1" else "0", sep = "\\t")',
  ].join(" ");
  return new Promise((resolve, reject) => {
    // Rscript 4.6 on Windows can crash when a multiline `-e` argument starts with a newline.
    const child = spawn(rscript, ["--vanilla", "-e", wrapper], {
      env: { ...process.env, NATIVR_CASE: code },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (status) => {
      if (status !== 0) {
        reject(new Error(`R oracle failed: ${stderr}`));
        return;
      }
      const [type, length, visible, values, warned] = stdout.trim().split("\t");
      resolve({
        type,
        length: Number(length),
        visible: visible === "1",
        values: values === "" ? [] : values.split(","),
        warned: warned === "1",
      });
    });
  });
}

function snapshotCanonical(snapshot, visible, warned) {
  if (snapshot.type === "null") {
    return { type: "NULL", length: 0, visible, values: [], warned };
  }
  if (snapshot.type === "list") {
    throw new Error("List conformance is outside the foundation cases.");
  }
  const values = [];
  for (let index = 0; index < snapshot.values.length; index += 1) {
    if (snapshot.missing?.[index] === 1) values.push("NA");
    else if (snapshot.type === "double" && Number.isNaN(snapshot.values[index])) values.push("NaN");
    else if (snapshot.type === "logical")
      values.push(snapshot.values[index] === 1 ? "TRUE" : "FALSE");
    else values.push(String(snapshot.values[index]));
  }
  return { type: snapshot.type, length: snapshot.values.length, visible, values, warned };
}

async function wasmDataUrl(file) {
  const contents = await readFile(file);
  return `data:application/wasm;base64,${contents.toString("base64")}`;
}

async function findRscript() {
  const availability = spawnSync("Rscript", ["--version"], { windowsHide: true });
  if (availability.error === undefined && availability.status === 0) return "Rscript";
  if (process.platform !== "win32") return undefined;

  const programFiles = process.env.ProgramFiles ?? String.raw`C:\Program Files`;
  const rRoot = path.join(programFiles, "R");
  let installations;
  try {
    installations = await readdir(rRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const candidates = installations
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rRoot, entry.name, "bin", "Rscript.exe"))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking for an installed R distribution.
    }
  }
  return undefined;
}
