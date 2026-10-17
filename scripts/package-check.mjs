import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createPackageOracle } from "./lib/package-oracle.mjs";
import { observePackageDependencies } from "./lib/package-dependency-observer.mjs";
import { observePackageLifecycle } from "./lib/package-lifecycle-observer.mjs";
import { observeCleanBaseLoad } from "./lib/package-clean-base-observer.mjs";
import { observePackageAuthors } from "./lib/package-authors-observer.mjs";
import { observePackageAuthorFields } from "./lib/package-author-fields-observer.mjs";
import { assessEffectiveAuthorFields } from "./lib/package-author-validation.mjs";
import {
  decodePackageConditions,
  packageConditionObserverRead,
  packageConditionObserverSetup,
} from "./lib/package-condition-observer.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = parseArguments(process.argv.slice(2));
const corpus = JSON.parse(
  await readFile(path.join(root, "compatibility/package-corpus.json"), "utf8"),
);
const entry = corpus.packages.find((candidate) => candidate.package === args.package);
if (entry === undefined || entry.partition === "holdout" || !entry.artifactSha256) {
  throw new Error(
    "Select an already evaluated, artifact-pinned development or regression package.",
  );
}
const {
  createPackageCheckReport,
  inspectPackageDescription,
  inspectPackageDependencyDeclarations,
  inspectPackageSourceDependencies,
  collectPackageSourceDependencyInputs,
  BASE_PRIORITY_PACKAGES,
  DEFAULT_INSTALLED_PACKAGES,
  inspectPackageLicense,
  comparePackageVersions,
  DEFAULT_PACKAGE_PACK_LIMITS,
  packPackage,
  runPackageExamples,
  runPackageTests,
} = await import(pathToFileURL(path.join(root, "packages/package-tools/dist/index.js")).href);
const { parseDcf } = await import(
  pathToFileURL(path.join(root, "packages/package-tools/dist/dcf.js")).href
);
const { readPackageSource } = await import(
  pathToFileURL(path.join(root, "packages/package-tools/dist/source.js")).href
);
const { createParser } = await import(
  pathToFileURL(path.join(root, "packages/parser/dist/index.js")).href
);
const { createR } = await import(
  pathToFileURL(path.join(root, "packages/nativr/dist/index.js")).href
);
const temporary = await mkdtemp(path.join(os.tmpdir(), "nativr-package-check-"));
let oracle;
try {
  const archive = args.source ?? path.join(temporary, `${entry.package}_${entry.version}.tar.gz`);
  if (args.source === undefined) {
    const response = await fetch(entry.sourceUrl, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Package download failed: ${response.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 64 * 1024 * 1024)
        throw new Error("Package archive exceeds the 64 MiB download limit.");
      chunks.push(chunk);
    }
    await writeFile(archive, Buffer.concat(chunks));
  }
  const sourceSha256 = hash(await readFile(archive));
  if (sourceSha256 !== entry.sourceSha256) throw new Error("Pinned source archive digest differs.");
  const artifact = await packPackage(archive);
  const declarationAssessment = inspectPackageDependencyDeclarations(
    artifact.bundle.description,
    artifact.bundle.namespace,
  );
  const declarationFailed = declarationAssessment.checks.some((check) => check.status === "failed");
  const descriptionAssessment = inspectPackageDescription(artifact.bundle.description);
  const descriptionFailed = descriptionAssessment.checks.some((check) => check.status === "failed");
  if (artifact.integrity.value !== entry.artifactSha256)
    throw new Error("Pinned artifact digest differs.");
  const files = await readPackageSource(archive, DEFAULT_PACKAGE_PACK_LIMITS);
  const licenseAssessment = inspectPackageLicense(
    artifact.bundle.description,
    files.map((file) => file.path),
    new Map(
      files
        .filter((file) => ["LICENSE", "LICENCE"].includes(file.path))
        .map((file) => [file.path, new TextDecoder().decode(file.data)]),
    ),
  );
  const licenseFailed = licenseAssessment.checks.some((check) => check.status === "failed");
  const testFiles = files
    .filter((file) => file.path.startsWith("tests/") && !/\.Rout\.save$/iu.test(file.path))
    .map((file) => ({ path: file.path.slice(6), data: file.data }));
  const runtimeLimits = {
    maxSteps: args.maxSteps,
    maxCallDepth: 200,
    maxVectorLength: args.maxVectorLength,
    maxOutputBytes: 32_000_000,
    maxPackageResourceBytes: 256 * 1024 * 1024,
  };
  const assets = {};
  for (const [key, filename] of [
    ["treeSitterRuntimeWasm", "web-tree-sitter.wasm"],
    ["rGrammarWasm", "tree-sitter-r.wasm"],
  ]) {
    const bytes = await readFile(path.join(root, "packages/nativr/dist/assets", filename));
    assets[key] = new URL(`data:application/wasm;base64,${bytes.toString("base64")}`);
  }
  const dependencyInputs = collectPackageSourceDependencyInputs(artifact.bundle, files);
  const sourceDependencyInputFailures = dependencyInputs.failures;
  const dependencyParser = await createParser({
    treeSitterRuntimeWasm: path.join(root, "packages/nativr/dist/assets/web-tree-sitter.wasm"),
    rGrammarWasm: path.join(root, "packages/nativr/dist/assets/tree-sitter-r.wasm"),
  });
  let sourceDependencyAssessment;
  try {
    // RFC-0008: test references count only when installed (base, recommended, this bundle).
    sourceDependencyAssessment = inspectPackageSourceDependencies(
      artifact.bundle.description,
      dependencyInputs.sources,
      (source) => dependencyParser.parse(source),
      { installed: new Set([...DEFAULT_INSTALLED_PACKAGES, entry.package]) },
    );
  } finally {
    dependencyParser.dispose();
  }
  const sourceDependencyFailed = sourceDependencyAssessment.checks.some(
    (check) => check.status === "failed",
  );
  const probe = await createR({
    execution: "inline",
    assets,
    runtimeProfile: "package-test",
    limits: runtimeLimits,
    packages: [artifact.bundle],
  });
  const capabilities = await probe.capabilities();
  await probe.dispose();
  oracle = await createPackageOracle({
    rscript: args.rscript,
    archive,
    expectedPackage: { name: entry.package, version: entry.version },
    expectedSourceSha256: sourceSha256,
    timeoutMs: 600_000,
    maxOutputBytes: runtimeLimits.maxOutputBytes,
  });
  const rngSetup =
    args.rngSeed === null
      ? ""
      : `set.seed(${args.rngSeed}L, kind = "Mersenne-Twister", normal.kind = "Inversion", sample.kind = "Rejection")
`;
  const observations = [];
  const execution = [];
  const audit = { expectedSourceSha256: sourceSha256, expectedPackage: artifact.package };
  async function compareScript(kind, script) {
    console.log(`Compare ${entry.package} ${script.path}`);
    // Identical explicit RNG state on both runtimes; GNU R otherwise seeds from time and process.
    const setup = rngSetup + (kind === "example" ? `library(${rString(entry.package)})\n` : "");
    const completion = "\ninvisible(NULL)\n";
    const source = setup + script.source + completion;
    const fixtures = kind === "test" ? testFiles : [];
    let expectedCapture;
    let oracleFailure;
    let oracleRepeat;
    try {
      const request = { source, path: script.path, files: fixtures, outputOrder: true };
      expectedCapture = await oracle.capture(request);
      if (args.oracleRepeat) {
        const repeated = await oracle.capture(request);
        oracleRepeat = {
          stdoutEqual: repeated.stdout === expectedCapture.stdout,
          stderrEqual: repeated.stderr === expectedCapture.stderr,
          statusEqual: repeated.status === expectedCapture.status,
          outputOrderEqual:
            repeated.limitations.outputOrder === expectedCapture.limitations.outputOrder &&
            JSON.stringify(repeated.outputOrder ?? null) ===
              JSON.stringify(expectedCapture.outputOrder ?? null),
        };
      }
    } catch (error) {
      oracleFailure = error instanceof Error ? error.message : String(error);
    }
    const expected =
      expectedCapture === undefined
        ? undefined
        : {
            status: expectedCapture.status,
            freshSession: true,
            stdout: expectedCapture.stdout,
            stderr: expectedCapture.stderr,
            conditions: expectedCapture.conditions,
            conditionsComplete:
              expectedCapture.reason === "exited" &&
              !expectedCapture.limitations.incompleteHandlerReturn &&
              expectedCapture.limitations.conditionObserversPresentAtCompletion,
            outputComplete: expectedCapture.reason === "exited",
            // Present only when a second complete native session recorded a uniquely aligned order.
            ...(expectedCapture.outputOrder === undefined
              ? {}
              : { outputOrder: expectedCapture.outputOrder }),
            ...(oracleRepeat === undefined
              ? {}
              : {
                  repeatable:
                    oracleRepeat.stdoutEqual &&
                    oracleRepeat.stderrEqual &&
                    oracleRepeat.statusEqual &&
                    oracleRepeat.outputOrderEqual,
                }),
          };
    const actual = await captureNativr(source, fixtures);
    observations.push({ kind, path: script.path, actual, expected });
    execution.push({
      kind,
      path: script.path,
      sourceSha256: hash(script.source),
      setup,
      completion,
      fixturePaths: fixtures.map((file) => file.path),
      oracleExitCode: expectedCapture?.exitCode,
      oracleSignal: expectedCapture?.signal,
      oracleRuntimeSettings: expectedCapture?.runtimeSettings,
      oracleLimitations: expectedCapture?.limitations,
      ...(oracleRepeat === undefined ? {} : { oracleRepeat }),
      ...(oracleFailure === undefined ? {} : { oracleFailure }),
    });
  }
  async function captureNativr(source, fixtures) {
    let runtime;
    try {
      runtime = await createR({
        execution: "inline",
        assets,
        runtimeProfile: "package-test",
        limits: runtimeLimits,
        packages: [artifact.bundle],
      });
      await runtime.eval(
        'dir.create(file.path(tempdir(), "package-check"), recursive = TRUE); setwd(file.path(tempdir(), "package-check")); invisible(NULL)',
      );
      for (const fixture of fixtures) {
        const parent = path.posix.dirname(fixture.path);
        if (parent !== ".")
          await runtime.eval(`dir.create(${rString(parent)}, recursive=TRUE); invisible(NULL)`);
        // Preserve fixture bytes through the existing virtual text-file API. Binary fixtures
        // remain an explicit preparation failure until a byte-write API is available.
        const fixtureText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          fixture.data,
        );
        if (!Buffer.from(fixtureText, "utf8").equals(Buffer.from(fixture.data)))
          throw new Error(`Fixture '${fixture.path}' cannot be mounted byte-for-byte as UTF-8.`);
        await runtime.assign(".nativr_check_fixture", fixtureText);
        await runtime.eval(
          `writeLines(.nativr_check_fixture, ${rString(fixture.path)}, sep = "", useBytes = TRUE); rm(.nativr_check_fixture); invisible(NULL)`,
        );
        const copied = await runtime.eval(
          `readBin(${rString(fixture.path)}, "raw", n = ${fixture.data.length + 1}L)`,
        );
        if (
          copied?.__nativr__ !== "raw" ||
          !Buffer.from(copied.bytes).equals(Buffer.from(fixture.data))
        )
          throw new Error(`Fixture '${fixture.path}' failed byte verification.`);
      }
      await runtime.eval(packageConditionObserverSetup);
      const result = await runtime.evalDetailed(source, {
        topLevelErrorHandling: "option",
        printVisibleTopLevel: true,
      });
      const { conditions, conditionsComplete } = decodePackageConditions(
        await runtime.evalRaw(packageConditionObserverRead),
        true,
      );
      const outputOrder = result.output.map((event) => ({
        stream: event.stream === "message" ? "stderr" : event.stream,
        text: event.text,
      }));
      return {
        status: "completed",
        freshSession: true,
        stdout: outputOrder
          .filter((event) => event.stream === "stdout")
          .map((event) => event.text)
          .join(""),
        stderr: outputOrder
          .filter((event) => event.stream === "stderr")
          .map((event) => event.text)
          .join(""),
        conditions,
        conditionsComplete,
        outputComplete: true,
        outputOrder,
      };
    } catch (error) {
      let observedConditions;
      try {
        if (runtime !== undefined)
          observedConditions = decodePackageConditions(
            await runtime.evalRaw(packageConditionObserverRead),
            false,
          ).conditions;
      } catch {
        // A failed observer or exhausted session cannot establish complete condition evidence.
      }
      return {
        status: "failed",
        freshSession: true,
        stdout: "",
        stderr: "",
        conditions: observedConditions?.length
          ? observedConditions
          : [
              {
                kind: "error",
                classes: [],
                message: error instanceof Error ? error.message : String(error),
              },
            ],
        conditionsComplete: false,
        outputComplete: false,
      };
    } finally {
      await runtime?.dispose();
    }
  }
  const dependencyObservation = await observePackageDependencies(artifact.dependencies, {
    actual: (source) => captureNativr(source, []),
    expected: (source) => oracle.capture({ source }),
    compareVersions: comparePackageVersions,
  });
  const lifecycleObservation = await observePackageLifecycle(entry.package, {
    actual: (source) => captureNativr(source, []),
    expected: (source) => oracle.capture({ source }),
  });
  const cleanBaseObservation = await observeCleanBaseLoad(entry.package, {
    actual: (source) => captureNativr(source, []),
    expected: (source) => oracle.capture({ source }),
  });
  const descriptionFields = parseDcf(artifact.bundle.description);
  const authorsObservation = await observePackageAuthors(descriptionFields.get("Authors@R"), {
    actual: (source) => captureNativr(source, []),
    expected: (source) => oracle.capture({ source }),
  });
  const authorFieldsObservation = await observePackageAuthorFields(
    descriptionFields.get("Authors@R"),
    {
      author: descriptionFields.get("Author"),
      maintainer: descriptionFields.get("Maintainer"),
      encoding: descriptionFields.get("Encoding"),
    },
    {
      actual: (source) => captureNativr(source, []),
      expected: (source) => oracle.capture({ source }),
    },
  );
  const authorsFailed =
    authorsObservation !== null &&
    (authorsObservation.outcome === "mismatch" ||
      (authorsObservation.outcome === "match" && !authorsObservation.valid));
  const authorMetadataAssessment = assessEffectiveAuthorFields(
    descriptionFields,
    authorFieldsObservation,
  );
  const authorMetadataFailed = authorMetadataAssessment.checks.some(
    (check) => check.status === "failed",
  );
  const dependencyKeys = artifact.dependencies.map(
    (dependency, index) => `DESCRIPTION:${dependency.kind}:${dependency.name}:${index}`,
  );
  const dependencyFailed = dependencyObservation.dependencies.some(
    (dependency) =>
      dependency.required &&
      [dependency.actual, dependency.expected].some(
        (result) => result === "unavailable" || result === "version-mismatch",
      ),
  );
  const dependencyObserved =
    dependencyObservation.actual.status === "completed" &&
    dependencyObservation.expected.status === "completed";
  // RFC-0008 closure: Depends/Imports must be base-priority packages (whose dependencies are base)
  // satisfied on NativR. Non-base dependencies need a packed closure, which this harness lacks.
  const closureChecks = artifact.dependencies
    .map((dependency, index) => ({ dependency, index }))
    .filter(
      ({ dependency }) =>
        (dependency.kind === "Depends" || dependency.kind === "Imports") && dependency.name !== "R",
    )
    .map(({ dependency, index }) => {
      const observed = dependencyObservation.dependencies[index];
      const status = !BASE_PRIORITY_PACKAGES.has(dependency.name)
        ? "unexecuted"
        : observed?.actual === "satisfied"
          ? "passed"
          : "failed";
      return { id: `dependencies:closure:${dependency.kind}:${dependency.name}`, status };
    });
  const closureFailed = closureChecks.some((check) => check.status === "failed");
  const metadataChecks = [
    ...descriptionAssessment.checks,
    ...declarationAssessment.checks,
    ...sourceDependencyAssessment.checks,
    ...licenseAssessment.checks,
    ...authorMetadataAssessment.checks,
    ...closureChecks,
  ];
  const metadataComplete =
    dependencyObserved &&
    sourceDependencyInputFailures.length === 0 &&
    (authorsObservation === null ||
      (authorsObservation.outcome === "match" && authorsObservation.valid)) &&
    (authorFieldsObservation === null || authorFieldsObservation.outcome === "match") &&
    metadataChecks.every((check) => check.status === "passed");
  const tests = await runPackageTests(archive, (script) => compareScript("test", script), {
    ...audit,
    ...(args.tests.length === 0 ? {} : { paths: args.tests }),
  });
  const examples = args.skipExamples
    ? undefined
    : await runPackageExamples(archive, (script) => compareScript("example", script), audit);
  const inventory = files.map((file) => file.path);
  const testInputs = inventory.filter((file) => /^tests\//u.test(file));
  const unsupportedTestInputs = testInputs.filter((file) => /\.Rin$/iu.test(file));
  const rd = inventory.filter((file) => /^man\/.*\.Rd$/iu.test(file));
  const vignettes = inventory.filter((file) => /^(?:vignettes|inst\/doc)\//u.test(file));
  const data = inventory.filter((file) => /^data\//u.test(file));
  const native = inventory.filter((file) => /^src\/|^(?:configure|cleanup)(?:\.|$)/u.test(file));
  const testPaths = [...tests.entrypoints, ...unsupportedTestInputs];
  const attempted = (kind) =>
    observations.filter((item) => item.kind === kind).map((item) => item.path);
  const examplePaths =
    examples?.entrypoints.filter((item) => item.applicableBlocks > 0).map((item) => item.path) ??
    rd;
  const outputPaths = [
    ...testPaths.map((file) => `test:${file}`),
    ...examplePaths.map((file) => `example:${file}`),
  ];
  const observedPaths = observations.map((item) => `${item.kind}:${item.path}`);
  const orderedPaths = observations
    .filter(
      (item) =>
        item.actual.outputComplete &&
        item.actual.outputOrder !== undefined &&
        item.expected?.outputComplete &&
        item.expected.outputOrder !== undefined,
    )
    .map((item) => `${item.kind}:${item.path}`);
  const stage = (id, status, reason, discovered, executed = []) => ({
    id,
    status,
    reason,
    discovered,
    executed,
  });
  const absent = (id, discovered, reason) =>
    stage(id, discovered.length === 0 ? "inapplicable" : "unexecuted", reason, discovered);
  const report = createPackageCheckReport({
    package: artifact.package,
    provenance: {
      sourceSha256,
      artifactSha256: artifact.integrity.value,
      oracle: { implementation: "GNU R", version: oracle.version },
      semanticProfile: capabilities.semanticProfileVersion,
      capabilitySha256: hash(JSON.stringify(capabilities)),
      runtimeLimits,
    },
    comparison: {
      policyVersion: 1,
      adaptations:
        oracle.newlineTransport.kind === "lf-to-crlf"
          ? [
              {
                id: "oracle-text-crlf-v1",
                probeLiteralHex: oracle.newlineTransport.probeLiteralHex,
                stdoutHex: oracle.newlineTransport.stdoutHex,
                stderrHex: oracle.newlineTransport.stderrHex,
              },
            ]
          : [],
    },
    observations,
    stages: [
      stage(
        "archive-artifact",
        "passed",
        "Archive and normalized artifact digests match the pinned corpus.",
        [sourceSha256, artifact.integrity.value],
        [sourceSha256, artifact.integrity.value],
      ),
      stage(
        "metadata-dependencies",
        dependencyFailed ||
          declarationFailed ||
          sourceDependencyFailed ||
          licenseFailed ||
          descriptionFailed ||
          authorsFailed ||
          authorMetadataFailed ||
          authorFieldsObservation?.outcome === "mismatch" ||
          closureFailed
          ? "failed"
          : metadataComplete
            ? "passed"
            : "unexecuted",
        metadataComplete
          ? "Every DESCRIPTION, license, author, declaration, source-reference (literal-source-references-v2) and dependency-closure check executed and passed under RFC-0008."
          : closureFailed
            ? "A base dependency in the Depends/Imports closure is unavailable on NativR; see closure checks."
            : declarationFailed
              ? "Namespace dependency declarations failed; see declarationAssessment. Dynamic references and transitive closure remain unexecuted."
              : sourceDependencyFailed
                ? "Literal source dependency references failed declaration checks; see sourceDependencyAssessment. Computed references and transitive closure remain unexecuted."
                : licenseFailed
                  ? "License structural checks failed; see licenseAssessment. Full license and metadata validation remain unexecuted."
                  : descriptionFailed
                    ? "DESCRIPTION structural checks failed; see descriptionAssessment. Full metadata and undeclared dependency checks remain unexecuted."
                    : authorsFailed ||
                        authorMetadataFailed ||
                        authorFieldsObservation?.outcome === "mismatch"
                      ? "Author/maintainer checks failed or differ from the native oracle; see authorMetadataAssessment, authorsObservation and authorFieldsObservation. Full metadata checks remain unexecuted."
                      : dependencyFailed
                        ? "A required declared dependency version is unavailable or violates its constraint on at least one runtime. Broader metadata and undeclared dependency checks remain unexecuted."
                        : "Some metadata checks remain unexecuted; see the stage inventory and the assessments.",
        [
          ...(authorsObservation === null ? [] : ["DESCRIPTION:Authors@R:person-roles"]),
          ...(authorFieldsObservation === null ? [] : ["DESCRIPTION:Authors@R:derived-fields"]),
          ...closureChecks.map((check) => check.id),
          ...descriptionAssessment.checks.map((check) => check.id),
          ...declarationAssessment.checks.map((check) => check.id),
          ...sourceDependencyAssessment.checks.map((check) => check.id),
          ...sourceDependencyInputFailures.map(
            (failure) => `source-dependency:input:${failure.role}:${failure.path}`,
          ),
          ...licenseAssessment.checks.map((check) => check.id),
          ...authorMetadataAssessment.checks.map((check) => check.id),
          ...dependencyKeys,
        ],
        [
          ...(authorsObservation === null || authorsObservation.outcome === "incomplete"
            ? []
            : ["DESCRIPTION:Authors@R:person-roles"]),
          ...(authorFieldsObservation === null || authorFieldsObservation.outcome === "incomplete"
            ? []
            : ["DESCRIPTION:Authors@R:derived-fields"]),
          ...licenseAssessment.checks
            .filter((check) => check.status !== "unexecuted")
            .map((check) => check.id),
          ...declarationAssessment.checks
            .filter((check) => check.status !== "unexecuted")
            .map((check) => check.id),
          ...sourceDependencyAssessment.checks
            .filter((check) => check.status !== "unexecuted")
            .map((check) => check.id),
          ...descriptionAssessment.checks
            .filter((check) => check.status !== "unexecuted")
            .map((check) => check.id),
          ...authorMetadataAssessment.checks
            .filter((check) => check.status !== "unexecuted")
            .map((check) => check.id),
          ...(dependencyObserved ? dependencyKeys : []),
          ...closureChecks
            .filter((check) => check.status !== "unexecuted")
            .map((check) => check.id),
        ],
      ),
      stage(
        "installation-loading",
        [lifecycleObservation.outcome, cleanBaseObservation.outcome].includes("mismatch")
          ? "failed"
          : "unexecuted",
        `Namespace lifecycle: ${lifecycleObservation.outcome}; base-only search-path loading: ${cleanBaseObservation.outcome}. Startup without default namespaces and full installation validation remain unexecuted.`,
        [
          "install",
          "load",
          "attach",
          "detach",
          "unload",
          "clean-base-load",
          "base-search-path-load",
          "installation-validation",
        ],
        [
          ...(lifecycleObservation.outcome === "incomplete"
            ? ["install"]
            : ["install", "load", "attach", "detach", "unload"]),
          ...(cleanBaseObservation.outcome === "incomplete" ? [] : ["base-search-path-load"]),
        ],
      ),
      stage(
        "namespace-source",
        "unexecuted",
        "Packing does not prove the full source and namespace check surface.",
        inventory.filter((file) => file === "NAMESPACE" || file.startsWith("R/")),
      ),
      stage(
        "documentation",
        "unexecuted",
        "Rd extraction is not documentation consistency checking.",
        rd,
      ),
      absent(
        "data",
        data,
        data.length === 0
          ? "The audited archive has no data directory entries."
          : "Data checks have not executed.",
      ),
      stage(
        "examples",
        examples === undefined
          ? "unexecuted"
          : examplePaths.length === 0
            ? "inapplicable"
            : "passed",
        examples === undefined
          ? "Examples were explicitly skipped."
          : "Default-applicable extracted Rd blocks executed unchanged, with explicit library setup, in fresh sessions. The inventory records excluded blocks.",
        examplePaths,
        attempted("example"),
      ),
      stage(
        "package-tests",
        testPaths.length === 0 ? "unexecuted" : "passed",
        "Top-level R scripts execute unchanged in fresh sessions with copied tests fixtures. Unsupported .Rin and absent entrypoints do not prove the package-test stage.",
        testPaths,
        attempted("test"),
      ),
      stage(
        "test-output",
        "passed",
        "Compare exact decoded stdout/stderr and separately observed conditions under policy 1. Only independently probed native text transport may be reversed.",
        outputPaths,
        observedPaths,
      ),
      stage(
        "output-order",
        "passed",
        "Compare complete stdout/stderr event sequences. The oracle order comes from a second fresh GNU R session whose streams share one file handle, accepted only when exactly one stream assignment reproduces the separate exact streams.",
        outputPaths,
        orderedPaths,
      ),
      stage(
        "conditions",
        "passed",
        "Compare condition classes, calls, messages, and ordering only when both observers captured them completely.",
        outputPaths,
        observedPaths,
      ),
      absent(
        "vignettes",
        vignettes,
        vignettes.length === 0
          ? "The audited archive has no vignettes or installed vignette files."
          : "Vignette execution and rebuilding have not executed.",
      ),
      absent(
        "installed-documentation",
        vignettes,
        vignettes.length === 0
          ? "The audited archive has no inst/doc or vignette entries."
          : "Installed-documentation checks have not executed.",
      ),
      absent(
        "native-build-portability",
        native,
        native.length === 0
          ? "The audited archive has no src or configure/cleanup files."
          : "Native checks have not executed.",
      ),
      stage("manual", "unexecuted", "Manual generation and validation have not executed.", rd),
    ],
  });
  const payload = {
    ...report,
    dependencyObservation,
    descriptionAssessment,
    declarationAssessment,
    sourceDependencyAssessment,
    sourceDependencyInputFailures,
    licenseAssessment,
    authorsObservation,
    authorFieldsObservation,
    authorMetadataAssessment,
    lifecycleObservation,
    cleanBaseObservation,
    runners: {
      tests: { outcome: tests.outcome, firstBlocker: tests.firstBlocker },
      examples:
        examples === undefined
          ? null
          : {
              outcome: examples.outcome,
              firstBlocker: examples.firstBlocker,
            },
    },
    executionProfile: {
      conditionObservation: {
        boundary: "globalCallingHandlers-after-source-handlers",
        setupSha256: hash(packageConditionObserverSetup),
        readSha256: hash(packageConditionObserverRead),
        maxRecords: 10000,
        maxBytes: 8388608,
        completionPresenceCheck: true,
      },
      execution: "inline",
      runtimeProfile: "package-test",
      rng:
        args.rngSeed === null
          ? { policy: "session-default" }
          : {
              policy: "explicit-seed-v1",
              seed: args.rngSeed,
              kinds: ["Mersenne-Twister", "Inversion", "Rejection"],
            },
      oracleRepeat: args.oracleRepeat,
      sourcePlatform: artifact.sourcePlatform,
      capture: "native-rscript-top-level-v1",
      outputOrderCapture: "merged-handle-unique-alignment-v1",
      oracle: {
        version: oracle.version,
        packageVersion: oracle.packageVersion,
        newlineTransport: oracle.newlineTransport,
        installationExitCode: oracle.installation.exitCode,
        installationSignal: oracle.installation.signal,
      },
      limitations: [
        "Condition observation covers only conditions that reach global calling handlers after source handlers.",
        "Native output order is observed in a separate fresh session; an ambiguous, inconsistent or incomplete alignment leaves output-order unexecuted for that script.",
        "NativR failed evaluations do not expose partial output through the public inline API.",
        "Fixture preparation currently admits only UTF-8 files whose bytes round-trip exactly through virtual writeLines/readBin.",
      ],
    },
    inventory: {
      paths: inventory,
      nestedRFiles: tests.nestedRFiles,
      testFixtures: testFiles.map((file) => ({ path: file.path, sha256: hash(file.data) })),
      examples: examples?.entrypoints ?? null,
    },
    execution,
  };
  const output = path.resolve(args.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        output,
        p7Eligible: report.p7Eligible,
        firstBlocker: report.firstBlocker,
        comparisons: report.observations.map((item) => ({
          path: item.path,
          outcome: item.comparison.outcome,
          rawDifference: item.comparison.rawDifference,
          difference: item.comparison.adaptedDifference,
        })),
      },
      null,
      2,
    ),
  );
  process.exitCode = report.p7Eligible ? 0 : 1;
} finally {
  await oracle?.dispose();
  await removeTemporary(temporary);
}

async function removeTemporary(directory) {
  const relative = path.relative(path.resolve(os.tmpdir()), directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Unsafe package-check temporary directory.");
  await rm(directory, { recursive: true, force: true });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function rString(value) {
  return JSON.stringify(value);
}
function parseArguments(values) {
  const result = {
    tests: [],
    skipExamples: false,
    oracleRepeat: false,
    rngSeed: 20261016,
    rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    maxSteps: 300_000_000,
    maxVectorLength: 50_000_000,
  };
  for (let i = 0; i < values.length; i += 1) {
    const flag = values[i];
    if (flag === "--") continue;
    if (flag === "--skip-examples") {
      result.skipExamples = true;
      continue;
    }
    if (flag === "--oracle-repeat") {
      result.oracleRepeat = true;
      continue;
    }
    if (
      ![
        "--package",
        "--source",
        "--output",
        "--rscript",
        "--test",
        "--max-steps",
        "--max-vector-length",
        "--rng-seed",
      ].includes(flag)
    )
      throw new Error(`Unknown argument: ${flag}`);
    const value = values[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--test") result.tests.push(value);
    else if (flag === "--rng-seed") {
      const seed = Number(value);
      if (value !== "none" && (!Number.isSafeInteger(seed) || Math.abs(seed) > 2_147_483_647))
        throw new Error("--rng-seed requires a 32-bit integer or 'none'.");
      result.rngSeed = value === "none" ? null : seed;
    } else if (flag === "--max-steps" || flag === "--max-vector-length") {
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number <= 0)
        throw new Error(`Invalid limit for ${flag}`);
      result[flag === "--max-steps" ? "maxSteps" : "maxVectorLength"] = number;
    } else result[flag.slice(2)] = value;
  }
  if (!result.package || !result.output)
    throw new Error(
      "Usage: pnpm package:check --package NAME --output REPORT.json [--rscript PATH] [--source ARCHIVE] [--test PATH] [--skip-examples] [--rng-seed N|none] [--oracle-repeat]",
    );
  return result;
}
