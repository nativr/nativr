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
assertNormativeR(rscript);

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "foundation.json"), "utf8"),
);
const { createR } = await import(
  pathToFileURL(path.join(root, "packages", "nativr", "dist", "index.js")).href
);
const assetRoot = path.join(root, "packages", "nativr", "dist", "assets");
const runtimeWasm = await readFile(path.join(assetRoot, "web-tree-sitter.wasm"));
const grammarWasm = await readFile(path.join(assetRoot, "tree-sitter-r.wasm"));
const bundledEntry = (
  await readFile(path.join(root, "packages", "nativr", "dist", "index.js"), "utf8")
).includes("./chunks/");
const runtime = await createR({
  execution: "inline",
  assets: {
    treeSitterRuntimeWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${runtimeWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "web-tree-sitter.wasm")),
    rGrammarWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${grammarWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "tree-sitter-r.wasm")),
  },
});
let failures = 0;
const oracleCases = cases.filter((testCase) => testCase.rOracle !== false);

for (const testCase of oracleCases) {
  await runtime.reset();
  const nativr = await runtime.evalDetailed(testCase.code);
  const actual = snapshotCanonical(
    nativr.raw,
    nativr.visible,
    nativr.warnings.length > 0,
    nativr.output.map((event) => event.text).join(""),
  );
  let oracle;
  try {
    oracle = await runOracle(
      testCase.code,
      testCase.rOracleWithoutCallingHandlers === true,
      testCase.rOracleIgnoreOutput === true,
      testCase.rOracleWithoutSinks === true,
    );
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${testCase.id}\n  R oracle error: ${String(error)}`);
    continue;
  }
  if (!canonicalEqual(actual, oracle, testCase.tolerance)) {
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
else {
  const skipped = cases.length - oracleCases.length;
  console.log(
    `Live R oracle: ${oracleCases.length}/${oracleCases.length} passed; ${skipped} NativR-only representation/random cases skipped`,
  );
}

function runOracle(
  code,
  withoutCallingHandlers = false,
  ignoreOutput = false,
  withoutSinks = false,
) {
  const conditionSetup = withoutCallingHandlers
    ? "before_warnings <- warnings();"
    : "warnings <- character();";
  const evaluation = withoutCallingHandlers
    ? 'result <- withVisible(eval(parse(text = Sys.getenv("NATIVR_CASE")), envir = new.env(parent = globalenv()))); warning_seen <- !identical(before_warnings, warnings());'
    : 'result <- withVisible(withCallingHandlers(eval(parse(text = Sys.getenv("NATIVR_CASE")), envir = new.env(parent = globalenv())), warning = function(w) { warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning") })); warning_seen <- length(warnings) > 0;';
  const outputSetup = withoutSinks
    ? 'output <- "";'
    : 'output_path <- tempfile(); output_connection <- file(output_path, open = "wt", encoding = "UTF-8"); sink(output_connection, type = "output"); sink(output_connection, type = "message");';
  const outputTeardown = withoutSinks
    ? ""
    : 'sink(type = "message"); sink(type = "output"); close(output_connection); output <- readChar(output_path, nchars = file.info(output_path)$size, useBytes = TRUE); unlink(output_path); output <- gsub("\\r\\n", "\\n", output, fixed = TRUE);';
  const wrapper = [
    'invisible(suppressWarnings(Sys.setlocale("LC_ALL", "C")));',
    "options(device = function(...) pdf(NULL));",
    conditionSetup,
    outputSetup,
    evaluation,
    outputTeardown,
    'output_hex <- paste(sprintf("%02x", as.integer(charToRaw(enc2utf8(output)))), collapse = "");',
    "value <- result$value;",
    'encode <- function(x) { vapply(seq_along(x), function(i) { if (is.na(x[[i]])) "NA" else if (is.complex(x[[i]])) paste(format(Re(x[[i]]), scientific = FALSE, trim = TRUE, digits = 17), format(Im(x[[i]]), scientific = FALSE, trim = TRUE, digits = 17), sep = ":") else if (is.nan(x[[i]])) "NaN" else if (is.logical(x[[i]])) if (x[[i]]) "TRUE" else "FALSE" else if (is.character(x[[i]])) gsub("\\r\\n", "\\n", x[[i]], fixed = TRUE) else format(x[[i]], scientific = FALSE, trim = TRUE, digits = 17) }, character(1)) };',
    'encode_hex <- function(x) { vapply(encode(x), function(item) paste(sprintf("%02x", as.integer(charToRaw(enc2utf8(item)))), collapse = ""), character(1), USE.NAMES = FALSE) };',
    'cat(typeof(value), length(value), if (result$visible) "1" else "0", paste(encode_hex(value), collapse = ","), if (warning_seen) "1" else "0", output_hex, sep = "\\t")',
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
      const [type, length, visible, valueHexes, warned, outputHex = ""] = stdout.trim().split("\t");
      const declaredLength = Number(length);
      resolve({
        type,
        length: declaredLength,
        visible: visible === "1",
        values:
          declaredLength === 0
            ? []
            : valueHexes.split(",").map((value) => Buffer.from(value, "hex").toString("utf8")),
        warned: warned === "1",
        output: ignoreOutput ? "" : Buffer.from(outputHex, "hex").toString("utf8"),
      });
    });
  });
}

function snapshotCanonical(snapshot, visible, warned, output) {
  if (snapshot.type === "null") {
    return { type: "NULL", length: 0, visible, values: [], warned, output };
  }
  if (snapshot.type === "list") {
    throw new Error("List conformance is outside the foundation cases.");
  }
  if (snapshot.type === "complex") {
    const values = [];
    for (let index = 0; index < snapshot.real.length; index += 1) {
      if (snapshot.missing?.[index] === 1) values.push("NA");
      else values.push(`${String(snapshot.real[index])}:${String(snapshot.imaginary[index])}`);
    }
    return { type: snapshot.type, length: snapshot.real.length, visible, values, warned, output };
  }
  const values = [];
  for (let index = 0; index < snapshot.values.length; index += 1) {
    if (snapshot.missing?.[index] === 1) values.push("NA");
    else if (snapshot.type === "double" && Number.isNaN(snapshot.values[index])) values.push("NaN");
    else if (snapshot.type === "logical")
      values.push(snapshot.values[index] === 1 ? "TRUE" : "FALSE");
    else values.push(String(snapshot.values[index]));
  }
  return { type: snapshot.type, length: snapshot.values.length, visible, values, warned, output };
}

function canonicalEqual(actual, oracle, tolerance = { absolute: 0, relative: 0 }) {
  if (
    actual.type !== oracle.type ||
    actual.length !== oracle.length ||
    actual.visible !== oracle.visible ||
    actual.warned !== oracle.warned ||
    actual.output !== oracle.output ||
    actual.values.length !== oracle.values.length
  ) {
    return false;
  }
  if (actual.type === "double" || actual.type === "integer") {
    return actual.values.every((value, index) =>
      numericTokenEqual(value, oracle.values[index], tolerance),
    );
  }
  if (actual.type === "complex") {
    return actual.values.every((value, index) => {
      const oracleValue = oracle.values[index];
      if (value === "NA" || oracleValue === "NA") return value === oracleValue;
      const [actualReal, actualImaginary] = value.split(":");
      const [oracleReal, oracleImaginary] = oracleValue.split(":");
      return (
        numericTokenEqual(actualReal, oracleReal, tolerance) &&
        numericTokenEqual(actualImaginary, oracleImaginary, tolerance)
      );
    });
  }
  return actual.values.every((value, index) => value === oracle.values[index]);
}

function numericTokenEqual(actual, oracle, tolerance) {
  if (actual === oracle) return true;
  if (actual === undefined || oracle === undefined) return false;
  if (actual === "NA" || oracle === "NA" || actual === "NaN" || oracle === "NaN") return false;
  const actualNumber = parseCanonicalNumber(actual);
  const oracleNumber = parseCanonicalNumber(oracle);
  if (actualNumber === oracleNumber) return true;
  if (!Number.isFinite(actualNumber) || !Number.isFinite(oracleNumber)) return false;
  const difference = Math.abs(actualNumber - oracleNumber);
  return (
    difference <=
    tolerance.absolute +
      tolerance.relative * Math.max(Math.abs(actualNumber), Math.abs(oracleNumber))
  );
}

function parseCanonicalNumber(value) {
  if (value === "Inf") return Number.POSITIVE_INFINITY;
  if (value === "-Inf") return Number.NEGATIVE_INFINITY;
  return Number(value);
}

function assertNormativeR(rscript) {
  const result = spawnSync(rscript, ["--vanilla", "-e", "cat(as.character(getRversion()))"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const detected = result.status === 0 ? result.stdout.trim() : "unknown";
  if (detected === "4.6.1" || process.env.NATIVR_ALLOW_NON_NORMATIVE_R === "1") return;
  throw new Error(
    `The release-gating oracle requires GNU R 4.6.1; found ${detected}. Set NATIVR_ALLOW_NON_NORMATIVE_R=1 only for advisory local investigation.`,
  );
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
