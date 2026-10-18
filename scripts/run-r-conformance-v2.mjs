import { spawn, spawnSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  collectOracleV2BindingEvidence,
  shadowedOracleV2Code,
} from "./lib/oracle-v2-binding-evidence.mjs";

const exactnessPolicies = new Set([
  "exact",
  "bitwise",
  "ulp-bounded",
  "absolute-relative",
  "structural",
  "statistical",
  "platform-adapted",
  "explicit-deviation",
]);
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "oracle-v2.json"), "utf8"),
);
const capabilities = JSON.parse(
  await readFile(path.join(root, "docs", "compatibility-manifest.json"), "utf8"),
);
const surface = JSON.parse(
  await readFile(path.join(root, "compatibility", "gnu-r", "surface.json"), "utf8"),
);
const bindingEvidence = collectOracleV2BindingEvidence(cases, capabilities, surface);
const caseIds = new Set();
for (const testCase of cases) {
  if (
    typeof testCase.id !== "string" ||
    testCase.id.length === 0 ||
    caseIds.has(testCase.id) ||
    typeof testCase.code !== "string" ||
    testCase.code.length === 0
  ) {
    throw new Error("Oracle-v2 cases require unique IDs and nonempty code.");
  }
  caseIds.add(testCase.id);
  if (!exactnessPolicies.has(testCase.policy)) {
    throw new Error(`Oracle-v2 case '${testCase.id}' has unknown policy '${testCase.policy}'.`);
  }
  if (testCase.policy !== "exact") {
    throw new Error(`Oracle-v2 policy '${testCase.policy}' is declared but not implemented yet.`);
  }
  validateGraphAssertions(testCase);
  validateObservationAssertions(testCase);
}

const rscript = await findRscript();
if (rscript === undefined) {
  console.log("SKIP recursive R oracle v2: Rscript is not installed or not on PATH.");
  process.exit(0);
}
assertNormativeR(rscript);

const observerPath = path.join(root, "conformance", "oracle-v2-observer.R");
const observerSource = await readFile(observerPath, "utf8");
assertRawPromisesRejected(rscript, observerPath);
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
  runtimeProfile: "package-test",
  assets: {
    treeSitterRuntimeWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${runtimeWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "web-tree-sitter.wasm")),
    rGrammarWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${grammarWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "tree-sitter-r.wasm")),
    // RFC-0007: evidence runs use the correctly rounded module, as browser sessions do.
    elementaryWasm: new URL(
      `data:application/wasm;base64,${(await readFile(path.join(assetRoot, "elementary.wasm"))).toString("base64")}`,
    ),
  },
});

let failures = 0;
for (const testCase of cases) {
  await runtime.reset();
  try {
    const actual = await observeNativr(runtime, observerSource, testCase.code);
    const oracle = await runOracle(rscript, observerPath, testCase.code);
    assertObservationAssertions(oracle, testCase, "R");
    assertObservationAssertions(actual, testCase, "NativR");
    assertGraphAssertions(oracle, testCase, "R");
    assertGraphAssertions(actual, testCase, "NativR");
    if (JSON.stringify(actual) !== JSON.stringify(oracle)) {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}\n  R:      ${JSON.stringify(oracle)}\n  NativR: ${JSON.stringify(actual)}`,
      );
    } else {
      for (const binding of testCase.bindingEvidence ?? []) {
        await assertBindingShadow(
          runtime,
          rscript,
          observerPath,
          observerSource,
          testCase,
          binding,
          oracle,
          actual,
        );
      }
      console.log(`PASS ${testCase.id} [${testCase.policy}]`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${testCase.id}: ${error instanceof Error ? error.stack : String(error)}`);
  }
}

await runtime.dispose();
if (failures > 0) process.exitCode = 1;
else {
  console.log(
    `Recursive live R oracle v2: ${cases.length}/${cases.length} passed; ${bindingEvidence.length} registered bindings have case links with causal shadow controls.`,
  );
}

function assertRawPromisesRejected(rscript, observerPath) {
  // Escaped replacement calls can retain raw promises whose deparse does not terminate.
  // These inputs must fail observation explicitly, rather than become exact passing cases.
  for (const reflection of ["sys.call()", "match.call()"]) {
    const code = `local({ assign("probe<-", function(x, value) ${reflection}); x <- 1L; probe(x) <- 1L + 2L; x })`;
    const result = spawnSync(
      rscript,
      ["--vanilla", path.join(root, "scripts", "r-oracle-v2.R"), observerPath],
      {
        env: { ...process.env, NATIVR_CASE: code },
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
      },
    );
    const message =
      "Unsupported oracle type: promise; raw promise payloads require an explicit observation contract.";
    if (
      result.error !== undefined ||
      result.signal !== null ||
      result.status === 0 ||
      result.stdout.trim() !== "" ||
      !result.stderr.includes(message)
    ) {
      throw new Error(
        `Oracle-v2 raw promise preflight for ${reflection} did not reject explicitly: ${result.error?.message ?? result.stderr.slice(0, 2048)}.`,
      );
    }
  }
  console.log("PASS raw replacement-call promise rejection [observer preflight]");
}

async function assertBindingShadow(
  runtime,
  rscript,
  observerPath,
  observerSource,
  testCase,
  binding,
  reference,
  observed,
) {
  const marker = `nativr_oracle_v2_binding_shadow_${testCase.id}_${binding}`;
  const errorCode = shadowedOracleV2Code(testCase.code, binding, marker, "error");
  const oracleErrorObservation = await runOracle(rscript, observerPath, errorCode);
  const oracleError = oracleErrorObservation.conditions.at(-1);
  if (
    oracleErrorObservation.outcome !== "error" ||
    oracleError?.kind !== "error" ||
    oracleError.message !== marker
  ) {
    throw new Error(`${testCase.id}: shadowing ${binding} did not cause the expected GNU R error.`);
  }

  await runtime.reset();
  let actualError;
  try {
    await runtime.evalDetailed(`local({\n${errorCode}\n})`);
  } catch (error) {
    actualError = error;
  }
  if (!(actualError instanceof Error) || !actualError.message.includes(marker)) {
    throw new Error(
      `${testCase.id}: shadowing ${binding} did not cause the expected NativR error; received ${String(actualError)}.`,
    );
  }

  const valueCode = shadowedOracleV2Code(testCase.code, binding, marker, "value");
  const referenceAltered = await runOracle(rscript, observerPath, valueCode);
  if (JSON.stringify(referenceAltered) === JSON.stringify(reference)) {
    throw new Error(`${testCase.id}: replacing ${binding} did not alter the GNU R observation.`);
  }
  await runtime.reset();
  const observedAltered = await observeNativr(runtime, observerSource, valueCode);
  if (JSON.stringify(observedAltered) === JSON.stringify(observed)) {
    throw new Error(`${testCase.id}: replacing ${binding} did not alter the NativR observation.`);
  }
}

async function observeNativr(runtime, observerSource, code) {
  const wrapper = `${observerSource}\nlocal({\n  .warning_conditions <- list()\n  globalCallingHandlers(warning = function(c) {\n    .warning_conditions[[length(.warning_conditions) + 1L]] <<- list(\n      classes = class(c),\n      message = conditionMessage(c),\n      call = if (is.null(c$call)) NULL else paste(deparse(c$call), collapse = "\\n")\n    )\n  })\n  .result <- tryCatch(\n    list(outcome = "value", observed = withVisible(local({\n${code}\n    }))),\n    error = function(e) list(outcome = "error", condition = e)\n  )\n  globalCallingHandlers(NULL)\n  if (.result$outcome == "error") {\n    list(\n      outcome = "error",\n      warningConditions = .warning_conditions,\n      classes = class(.result$condition),\n      message = conditionMessage(.result$condition),\n      call = if (is.null(.result$condition$call)) NULL else paste(deparse(.result$condition$call), collapse = "\\n")\n    )\n  } else {\n    .graph <- nativr_oracle_observe_graph(.result$observed$value)\n    list(outcome = "value", warningConditions = .warning_conditions, root = .graph$root, graph = .graph$graph, visible = .result$observed$visible)\n  }\n})`;
  const result = await runtime.evalDetailed(wrapper);
  const payload = snapshotToPlain(result.raw);
  const captured = Array.isArray(payload.warningConditions)
    ? payload.warningConditions
    : payload.warningConditions === null
      ? []
      : [payload.warningConditions];
  if (captured.length > 0 && captured.length !== result.warnings.length) {
    throw new Error("NativR condition handler and public warning counts differ.");
  }
  const warnings = result.warnings.map((warning, index) => {
    const condition = captured[index];
    if (condition !== undefined && condition.message !== warning.message) {
      throw new Error("NativR condition handler and public warning messages differ.");
    }
    return {
      kind: "warning",
      classes: condition?.classes ?? [],
      message: warning.message,
      call: condition?.call ?? warning.call ?? null,
      order: index + 1,
    };
  });
  const streams = {
    stdout: result.output
      .filter((event) => event.stream === "stdout")
      .map((event) => event.text)
      .join(""),
    stderr: result.output
      .filter((event) => event.stream === "stderr")
      .map((event) => event.text)
      .join(""),
    messages: result.output
      .filter((event) => event.stream === "message")
      .map((event) => event.text)
      .join(""),
  };
  if (payload.outcome === "error") {
    return {
      schemaVersion: 2,
      outcome: "error",
      root: null,
      graph: [],
      conditions: [
        ...warnings,
        {
          kind: "error",
          classes: payload.classes,
          message: payload.message,
          call: payload.call,
          order: warnings.length + 1,
        },
      ],
      streams,
      visible: false,
    };
  }
  if (payload.outcome !== "value") {
    throw new Error(`Unknown NativR Oracle-v2 outcome: ${JSON.stringify(payload.outcome)}.`);
  }
  return {
    schemaVersion: 2,
    outcome: "value",
    root: payload.root,
    graph: payload.graph,
    conditions: warnings,
    streams,
    visible: payload.visible,
  };
}

function validateObservationAssertions(testCase) {
  const assertions = testCase.observationAssertions;
  if (assertions === undefined) return;
  if (assertions === null || typeof assertions !== "object" || Array.isArray(assertions)) {
    throw new Error(`Oracle-v2 case '${testCase.id}' has invalid observation assertions.`);
  }
  for (const [name, value] of Object.entries(assertions)) {
    if (name === "outcome" && (value === "value" || value === "error")) continue;
    if (name === "visible" && typeof value === "boolean") continue;
    if (["stdout", "stderr", "messages"].includes(name) && typeof value === "string") continue;
    if (
      name === "conditions" &&
      Array.isArray(value) &&
      value.every(
        (condition, index) =>
          condition !== null &&
          typeof condition === "object" &&
          !Array.isArray(condition) &&
          (condition.kind === "warning" || condition.kind === "error") &&
          Array.isArray(condition.classes) &&
          condition.classes.every((entry) => typeof entry === "string") &&
          typeof condition.message === "string" &&
          (condition.call === null || typeof condition.call === "string") &&
          condition.order === index + 1 &&
          Object.keys(condition).length === 5,
      )
    ) {
      continue;
    }
    throw new Error(`Oracle-v2 case '${testCase.id}' has invalid observation assertion '${name}'.`);
  }
}

function assertObservationAssertions(observation, testCase, implementation) {
  const assertions = testCase.observationAssertions;
  if (assertions === undefined) return;
  for (const [name, expected] of Object.entries(assertions)) {
    const actual = ["stdout", "stderr", "messages"].includes(name)
      ? observation.streams[name]
      : observation[name];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `${testCase.id} (${implementation}): expected ${name} ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
      );
    }
  }
}

function validateGraphAssertions(testCase) {
  const assertions = testCase.graphAssertions;
  if (assertions === undefined) return;
  if (assertions === null || typeof assertions !== "object" || Array.isArray(assertions)) {
    throw new Error(`Oracle-v2 case '${testCase.id}' has invalid graph assertions.`);
  }
  const isPath = (path) =>
    Array.isArray(path) &&
    path.every((segment) => typeof segment === "string" && segment.length > 0);
  for (const [kind, entries] of Object.entries(assertions)) {
    if (kind === "paths") {
      if (!Array.isArray(entries) || !entries.every(isPath)) {
        throw new Error(`Oracle-v2 case '${testCase.id}' has invalid graph paths.`);
      }
    } else if (kind === "sameNode" || kind === "differentNode") {
      if (
        !Array.isArray(entries) ||
        !entries.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isPath))
      ) {
        throw new Error(`Oracle-v2 case '${testCase.id}' has invalid ${kind} assertions.`);
      }
    } else if (kind === "activeBindings") {
      if (
        !Array.isArray(entries) ||
        !entries.every(
          (entry) => isPath(entry?.path) && typeof entry.name === "string" && entry.name.length > 0,
        )
      ) {
        throw new Error(`Oracle-v2 case '${testCase.id}' has invalid active binding assertions.`);
      }
    } else {
      throw new Error(`Oracle-v2 case '${testCase.id}' has unknown graph assertion '${kind}'.`);
    }
  }
}

function assertGraphAssertions(observation, testCase, implementation) {
  const assertions = testCase.graphAssertions;
  if (assertions === undefined) return;
  const prefix = `${testCase.id} (${implementation})`;
  const nodeAt = (id) => {
    const node = observation.graph[id - 1];
    if (!Number.isInteger(id) || node?.id !== id) {
      throw new Error(`${prefix}: graph reference ${id} is missing.`);
    }
    return node;
  };
  const resolve = (path) => {
    let id = observation.root;
    for (const segment of path) {
      const node = nodeAt(id);
      if (segment === "@environment" && node.typeof === "closure") {
        id = node.environment;
      } else if (node.typeof === "environment") {
        const binding = node.bindings?.find((entry) => entry.name === segment);
        if (binding === undefined || binding.active || binding.node === null) {
          throw new Error(`${prefix}: binding '${segment}' is not an observable graph edge.`);
        }
        id = binding.node;
      } else if (Array.isArray(node.tags)) {
        const index = node.tags.indexOf(segment);
        if (index < 0 || !Array.isArray(node.elements)) {
          throw new Error(`${prefix}: element '${segment}' is not an observable graph edge.`);
        }
        id = node.elements[index];
      } else {
        throw new Error(`${prefix}: graph path cannot enter '${segment}' from ${node.typeof}.`);
      }
    }
    nodeAt(id);
    return id;
  };
  for (const path of assertions.paths ?? []) resolve(path);
  for (const [left, right] of assertions.sameNode ?? []) {
    if (resolve(left) !== resolve(right)) {
      throw new Error(
        `${prefix}: paths ${JSON.stringify(left)} and ${JSON.stringify(right)} do not share a node.`,
      );
    }
  }
  for (const [left, right] of assertions.differentNode ?? []) {
    if (resolve(left) === resolve(right)) {
      throw new Error(
        `${prefix}: paths ${JSON.stringify(left)} and ${JSON.stringify(right)} share a node.`,
      );
    }
  }
  for (const { path, name } of assertions.activeBindings ?? []) {
    const node = nodeAt(resolve(path));
    const binding = node.bindings?.find((entry) => entry.name === name);
    if (node.typeof !== "environment" || binding?.active !== true || binding.node !== null) {
      throw new Error(`${prefix}: '${name}' is not an unforced active binding.`);
    }
  }
}

function snapshotToPlain(snapshot) {
  if (snapshot.type === "null") return null;
  if (snapshot.type === "list" || snapshot.type === "pairlist") {
    const values = snapshot.values.map(snapshotToPlain);
    const names = snapshot.names;
    if (
      names !== undefined &&
      names.length === values.length &&
      names.every((name) => name.length > 0) &&
      new Set(names).size === names.length
    ) {
      return Object.fromEntries(names.map((name, index) => [name, values[index]]));
    }
    return values;
  }
  if (snapshot.type === "complex") {
    const values = snapshot.real.map((real, index) => ({
      real,
      imaginary: snapshot.imaginary[index],
    }));
    return values.length === 1 ? values[0] : values;
  }
  if (snapshot.type === "formula") return { ...snapshot };
  if (snapshot.type === "symbol") return snapshot.name;
  if (snapshot.type === "language") return snapshot.source;
  if (snapshot.type === "expression") return [...snapshot.sources];
  const values = Array.from(snapshot.values, (value, index) => {
    if (snapshot.missing?.[index] === 1) return null;
    if (snapshot.type === "logical") return value === 1;
    return value;
  });
  return values.length === 1 ? values[0] : values;
}

function runOracle(rscript, observerPath, code) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      rscript,
      ["--vanilla", path.join(root, "scripts", "r-oracle-v2.R"), observerPath],
      {
        env: { ...process.env, NATIVR_CASE: code },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    // Wait for "close" so both pipes have drained before the observation is parsed.
    child.on("close", (status, signal) => {
      if (status !== 0)
        reject(
          new Error(
            `R oracle v2 failed (status ${String(status)}, signal ${String(signal)}, ${stdout.length} stdout chars): ${stderr}`,
          ),
        );
      else resolve(JSON.parse(stdout));
    });
  });
}

function assertNormativeR(rscript) {
  const result = spawnSync(rscript, ["--vanilla", "-e", "cat(as.character(getRversion()))"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const detected = result.status === 0 ? result.stdout.trim() : "unknown";
  if (detected === "4.6.1" || process.env.NATIVR_ALLOW_NON_NORMATIVE_R === "1") return;
  throw new Error(
    `The recursive release-gating oracle requires GNU R 4.6.1; found ${detected}. Set NATIVR_ALLOW_NON_NORMATIVE_R=1 only for advisory local investigation.`,
  );
}

async function findRscript() {
  const availability = spawnSync("Rscript", ["--version"], { windowsHide: true });
  if (availability.error === undefined && availability.status === 0) return "Rscript";
  if (process.platform !== "win32") return undefined;
  const rRoot = path.join(process.env.ProgramFiles ?? String.raw`C:\Program Files`, "R");
  let installations;
  try {
    installations = await readdir(rRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const candidate of installations
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rRoot, entry.name, "bin", "Rscript.exe"))
    .sort()
    .reverse()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next installed R version.
    }
  }
  return undefined;
}
