import {
  PACKAGE_EXAMPLES_RESOURCE_PATH,
  PACKAGE_HELP_RESOURCE_PATH,
  type PackageExamplesManifest,
  type PackageHelpManifest,
} from "./rd-examples.js";
import { PACKAGE_TESTS_RESOURCE_PATH, type PackageTestsManifest } from "./package-tests.js";
import { PACKAGE_VIGNETTES_RESOURCE_PATH, type PackageVignettesManifest } from "./vignettes.js";
import type { NativRPackageArtifact, PackageDependency } from "./types.js";

export type PackageCheckKind =
  | "metadata"
  | "namespace"
  | "attachment"
  | "documentation"
  | "examples"
  | "tests"
  | "saved-output"
  | "vignettes";

export type PackageCheckStatus = "passed" | "failed" | "blocked" | "not-applicable";

export interface PackageCheckStep {
  readonly id: string;
  readonly kind: PackageCheckKind;
  readonly label: string;
  readonly code?: string;
  readonly blocker?: string;
  /** Evidence-backed reason that this check facet is outside the browser-admissible contract. */
  readonly notApplicableReason?: string;
  /** Normalized reference output for a saved-output comparison step. */
  readonly expectedOutput?: string;
}

export interface PackageCheckPlan {
  readonly format: "nativr-package-check-plan";
  readonly formatVersion: 1;
  readonly package: { readonly name: string; readonly version: string };
  readonly steps: readonly PackageCheckStep[];
}

export interface PackageCheckEvaluation {
  readonly value?: unknown;
  readonly warnings: readonly unknown[];
  readonly output: readonly { readonly stream: string; readonly text: string }[];
}

/** Minimal session surface accepted by the build-time package-check runner. */
export interface PackageCheckExecutor {
  reset(): Promise<void>;
  evalDetailed(code: string): Promise<PackageCheckEvaluation>;
}

export interface PackageCheckStepResult {
  readonly id: string;
  readonly kind: PackageCheckKind;
  readonly status: PackageCheckStatus;
  readonly message?: string;
  /** Non-fatal runtime warnings retained for example and test evidence. */
  readonly warningCount?: number;
}

export interface PackageCheckResult {
  readonly plan: PackageCheckPlan;
  readonly steps: readonly PackageCheckStepResult[];
  /** True only when every applicable check passed and no known check facet is blocked. */
  readonly passed: boolean;
  readonly firstBlocker?: PackageCheckStepResult;
}

const PACKAGE_LIFECYCLE_HOOKS = Object.freeze([
  ".onLoad",
  ".onAttach",
  ".onUnload",
  ".onDetach",
  ".First.lib",
  ".Last.lib",
]);

/**
 * Build a deterministic browser-admissible analogue of the applicable R package-check surface.
 * The plan never executes package code and is safe to inspect before a runtime is created.
 */
export function createPackageCheckPlan(artifact: NativRPackageArtifact): PackageCheckPlan {
  const name = artifact.package.name;
  const packageLiteral = rString(name);
  const versionLiteral = rString(artifact.package.version);
  const examples = readManifest<PackageExamplesManifest>(artifact, PACKAGE_EXAMPLES_RESOURCE_PATH);
  const help = readManifest<PackageHelpManifest>(artifact, PACKAGE_HELP_RESOURCE_PATH);
  const tests = readManifest<PackageTestsManifest>(artifact, PACKAGE_TESTS_RESOURCE_PATH);
  const vignettes = readManifest<PackageVignettesManifest>(
    artifact,
    PACKAGE_VIGNETTES_RESOURCE_PATH,
  );
  const steps: PackageCheckStep[] = [
    Object.freeze({
      id: "metadata",
      kind: "metadata",
      label: "installed DESCRIPTION identity",
      code: `description <- utils::packageDescription(${packageLiteral}); stopifnot(identical(description$Package, ${packageLiteral}), identical(description$Version, ${versionLiteral})); invisible(NULL)`,
    }),
    Object.freeze({
      id: "namespace",
      kind: "namespace",
      label: "namespace load",
      // The quiet probe preserves ordinary namespace-only behavior on success. On failure, replay
      // through library() in this isolated check session so the first import diagnostic is retained.
      code: `if (!requireNamespace(${packageLiteral}, quietly = TRUE)) library(${packageLiteral}, character.only = TRUE); invisible(NULL)`,
    }),
    Object.freeze({
      id: "attachment",
      kind: "attachment",
      label: "package attachment",
      code: `library(${packageLiteral}, character.only = TRUE); stopifnot(paste0("package:", ${packageLiteral}) %in% search()); invisible(NULL)`,
    }),
  ];

  if (help === undefined) {
    steps.push(
      Object.freeze({
        id: "documentation:index",
        kind: "documentation",
        label: "installed help index",
        blocker: "No deterministic installed help manifest is available.",
      }),
    );
  } else {
    const aliases = unique(help.topics.flatMap((topic) => topic.aliases));
    const documentedExports = unique([
      ...expandDocumentationAliases(aliases),
      ...PACKAGE_LIFECYCLE_HOOKS,
    ]);
    steps.push(
      Object.freeze({
        id: "documentation:exports",
        kind: "documentation",
        label: "export documentation coverage",
        code: `exports <- getNamespaceExports(${packageLiteral}); documented <- ${rCharacter(documentedExports)}; undocumented <- setdiff(exports, documented); undocumented <- undocumented[!startsWith(undocumented, ".__T__")]; if (length(undocumented)) stop("undocumented exports: ", paste(undocumented, collapse = ", ")); invisible(NULL)`,
      }),
      ...help.topics.map((topic) =>
        Object.freeze({
          id: `documentation:${topic.name}`,
          kind: "documentation" as const,
          label: `help topic ${topic.name}`,
          code: `utils::help(${rString(topic.name)}, package = ${packageLiteral}); invisible(NULL)`,
        }),
      ),
    );
  }

  if (examples === undefined || examples.topics.length === 0) {
    steps.push(
      Object.freeze({
        id: "examples",
        kind: "examples",
        label: "installed examples",
      }),
    );
  } else {
    steps.push(
      ...examples.topics.map((topic) => {
        const optionalDependency = unguardedOptionalExampleDependency(
          topic.blocks,
          artifact.dependencies,
        );
        return Object.freeze({
          id: `example:${topic.name}`,
          kind: "examples" as const,
          label: `example topic ${topic.name}`,
          ...(optionalDependency === undefined
            ? {
                code: `utils::example(${rString(topic.name)}, package = ${packageLiteral}, echo = FALSE); invisible(NULL)`,
              }
            : {
                notApplicableReason: unavailableOptionalPackageMessage(
                  "Example",
                  optionalDependency,
                ),
              }),
        });
      }),
    );
  }

  if (tests === undefined || tests.scripts.length === 0) {
    steps.push(Object.freeze({ id: "tests", kind: "tests", label: "top-level package tests" }));
  } else {
    for (const test of tests.scripts) {
      steps.push(
        Object.freeze({
          id: `test:${test.path}`,
          kind: "tests",
          label: `package test ${test.path}`,
          code: packageTestCode(name, test.path),
        }),
      );
      if (test.expectedOutput.length > 0) {
        const expectedResource = artifact.bundle.resources.find(
          (resource) =>
            resource.path === `.nativr/tests/${test.expectedOutput.replaceAll("\\", "/")}`,
        );
        const referenceOutput =
          expectedResource === undefined
            ? undefined
            : Buffer.from(expectedResource.data, "base64").toString("utf8");
        const notApplicableReason =
          referenceOutput === undefined ? undefined : nonPortableSavedOutputReason(referenceOutput);
        steps.push(
          Object.freeze({
            id: `saved-output:${test.path}`,
            kind: "saved-output",
            label: `saved output ${test.expectedOutput}`,
            ...(expectedResource === undefined
              ? { blocker: `Saved-output resource '${test.expectedOutput}' is missing.` }
              : notApplicableReason !== undefined
                ? { notApplicableReason }
                : {
                    code: packageSavedOutputCode(name, test.path),
                    expectedOutput: normalizeSavedOutput(referenceOutput as string),
                  }),
          }),
        );
      }
    }
  }

  if (vignettes === undefined || vignettes.vignettes.length === 0) {
    steps.push(
      Object.freeze({
        id: "vignettes",
        kind: "vignettes",
        label: "vignette build",
      }),
    );
  } else {
    for (const vignette of vignettes.vignettes) {
      steps.push(
        Object.freeze({
          id: `vignette:${vignette.topic}`,
          kind: "vignettes",
          label: `vignette ${vignette.topic}`,
          ...(vignette.output.length > 0
            ? {
                code: `stopifnot(nzchar(utils::vignette(${rString(vignette.topic)}, package = ${packageLiteral})$File)); invisible(NULL)`,
              }
            : {
                blocker:
                  "The source vignette has no installed rendered output and browser-side vignette builds are not implemented.",
              }),
        }),
      );
    }
  }

  return Object.freeze({
    format: "nativr-package-check-plan",
    formatVersion: 1,
    package: Object.freeze({ name, version: artifact.package.version }),
    steps: Object.freeze(steps),
  });
}

/** Execute every runnable check in isolation and retain the first deterministic blocker. */
export async function runPackageChecks(
  artifact: NativRPackageArtifact,
  executor: PackageCheckExecutor,
): Promise<PackageCheckResult> {
  const plan = createPackageCheckPlan(artifact);
  const results: PackageCheckStepResult[] = [];
  if (
    artifact.compatibility.packaging !== "ready" ||
    artifact.compatibility.issues.some((issue) => issue.severity === "error")
  ) {
    results.push(
      Object.freeze({
        id: "packaging",
        kind: "metadata",
        status: "blocked",
        message: "The source artifact is not browser-packaging ready.",
      }),
    );
  }
  for (const step of plan.steps) {
    if (step.blocker !== undefined) {
      results.push(
        Object.freeze({
          id: step.id,
          kind: step.kind,
          status: "blocked",
          message: step.blocker,
        }),
      );
      continue;
    }
    if (step.code === undefined) {
      results.push(
        Object.freeze({
          id: step.id,
          kind: step.kind,
          status: "not-applicable",
          ...(step.notApplicableReason === undefined ? {} : { message: step.notApplicableReason }),
        }),
      );
      continue;
    }
    await executor.reset();
    try {
      const evaluation = await evaluatePackageCheckStep(artifact, executor, step);
      const actionableWarnings = evaluation.warnings.filter(
        (warning) => !isUnavailableOptionalPackageWarning(artifact, warning),
      );
      const warningEvidence =
        actionableWarnings.length > 0 && warningsAreNonFatal(step.kind)
          ? { warningCount: actionableWarnings.length }
          : {};
      if (actionableWarnings.length > 0 && !warningsAreNonFatal(step.kind)) {
        results.push(
          Object.freeze({
            id: step.id,
            kind: step.kind,
            status: "failed",
            message: `Check emitted ${actionableWarnings.length} warning(s).`,
            warningCount: actionableWarnings.length,
          }),
        );
      } else if (step.expectedOutput !== undefined) {
        const actualOutput = normalizeSavedOutput(
          evaluation.output.map((event) => event.text).join(""),
        );
        if (actualOutput === step.expectedOutput) {
          results.push(
            Object.freeze({ id: step.id, kind: step.kind, status: "passed", ...warningEvidence }),
          );
        } else {
          results.push(
            Object.freeze({
              id: step.id,
              kind: step.kind,
              status: "failed",
              message: firstOutputDifference(step.expectedOutput, actualOutput),
              ...warningEvidence,
            }),
          );
        }
      } else {
        results.push(
          Object.freeze({ id: step.id, kind: step.kind, status: "passed", ...warningEvidence }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const unavailableOptionalDependency =
        step.kind === "tests" || step.kind === "examples" || step.kind === "saved-output"
          ? unavailableOptionalPackageInError(artifact, error)
          : undefined;
      const unavailableHostCapability =
        step.kind === "tests" || step.kind === "examples" || step.kind === "saved-output"
          ? unavailableHostCapabilityInError(message)
          : undefined;
      const stepLabel =
        step.kind === "examples"
          ? "Example"
          : step.kind === "saved-output"
            ? "Saved-output test"
            : "Test";
      results.push(
        unavailableOptionalDependency !== undefined
          ? Object.freeze({
              id: step.id,
              kind: step.kind,
              status: "not-applicable",
              message: unavailableOptionalPackageMessage(stepLabel, unavailableOptionalDependency),
            })
          : unavailableHostCapability !== undefined
            ? Object.freeze({
                id: step.id,
                kind: step.kind,
                status: "not-applicable",
                message: unavailableHostCapabilityMessage(stepLabel, unavailableHostCapability),
              })
            : Object.freeze({ id: step.id, kind: step.kind, status: "failed", message }),
      );
    }
  }
  const firstBlocker = results.find(
    (result) => result.status === "failed" || result.status === "blocked",
  );
  return Object.freeze({
    plan,
    steps: Object.freeze(results),
    passed: firstBlocker === undefined,
    ...(firstBlocker === undefined ? {} : { firstBlocker }),
  });
}

async function evaluatePackageCheckStep(
  artifact: NativRPackageArtifact,
  executor: PackageCheckExecutor,
  step: PackageCheckStep,
): Promise<PackageCheckEvaluation> {
  if (step.kind !== "tests" || !step.id.startsWith("test:")) {
    return executor.evalDetailed(step.code ?? "invisible(NULL)");
  }
  const path = step.id.slice("test:".length);
  const setup = await executor.evalDetailed(packageTestSetupCode(artifact.package.name, path));
  const expressionCount = packageTestExpressionCount(setup.value);
  if (expressionCount === undefined) {
    return executor.evalDetailed(step.code ?? "invisible(NULL)");
  }
  const warnings: unknown[] = [...setup.warnings];
  const output: { readonly stream: string; readonly text: string }[] = [...setup.output];
  for (let index = 1; index <= expressionCount; index += 1) {
    try {
      const evaluation = await executor.evalDetailed(packageTestExpressionCode(index));
      warnings.push(...evaluation.warnings);
      output.push(...evaluation.output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith(`expression ${index}:`)) throw error;
      throw new Error(`expression ${index}: ${message}`, { cause: error });
    }
  }
  return { value: null, warnings, output };
}

function packageTestSetupCode(packageName: string, path: string): string {
  const packageLiteral = rString(packageName);
  return `library(${packageLiteral}, character.only = TRUE); ${packageTestWorkspaceCode(packageLiteral)}; test_path <- file.path(.nativr_package_check_workdir, ${rString(path)}); .nativr_package_check_expressions <- parse(text = paste(readLines(test_path), collapse = "\\n")); setwd(.nativr_package_check_workdir); length(.nativr_package_check_expressions)`;
}

function packageTestExpressionCode(index: number): string {
  return `tryCatch(eval(.nativr_package_check_expressions[[${index}L]]), error = function(error) { handler <- getOption("error"); if (is.null(handler)) stop("expression ", ${index}L, ": ", conditionMessage(error)); handler(); invisible(NULL) }); invisible(NULL)`;
}

function packageTestExpressionCount(value: unknown): number | undefined {
  let candidate: unknown = value;
  if (Array.isArray(value) && value.length === 1) {
    candidate = (value as readonly unknown[])[0];
  }
  return typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0
    ? candidate
    : undefined;
}

function warningsAreNonFatal(kind: PackageCheckKind): boolean {
  return kind === "examples" || kind === "tests" || kind === "saved-output";
}

function isUnavailableOptionalPackageWarning(
  artifact: NativRPackageArtifact,
  warning: unknown,
): boolean {
  if (typeof warning !== "object" || warning === null) return false;
  const candidate = warning as { readonly code?: unknown; readonly message?: unknown };
  if (candidate.code !== "NRW1115" || typeof candidate.message !== "string") return false;
  return artifact.dependencies.some(
    (dependency) =>
      isOptionalPackageDependency(dependency) &&
      candidate.message === `there is no package called '${dependency.name}'`,
  );
}

function unavailableOptionalPackageInError(
  artifact: NativRPackageArtifact,
  error: unknown,
): PackageDependency | undefined {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      readonly code?: unknown;
      readonly details?: {
        readonly operation?: unknown;
        readonly package?: unknown;
        readonly packageInstalled?: unknown;
      };
    };
    if (
      candidate.code === "NRE2234" &&
      candidate.details?.operation === "system.file" &&
      typeof candidate.details.package === "string" &&
      candidate.details.packageInstalled === false
    ) {
      const packageName = candidate.details.package;
      const dependency = artifact.dependencies.find(
        (entry) => isOptionalPackageDependency(entry) && entry.name === packageName,
      );
      if (dependency !== undefined) return dependency;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return artifact.dependencies.find(
    (dependency) =>
      isOptionalPackageDependency(dependency) &&
      (message.includes(`There is no installed package called '${dependency.name}'.`) ||
        message.includes(`there is no package called '${dependency.name}'`) ||
        message.includes(`Package '${dependency.name}' missing`) ||
        message.includes(`Package "${dependency.name}" missing`) ||
        message.includes(`This function requires the package '${dependency.name}'.`) ||
        message.includes(`This function requires the package "${dependency.name}".`) ||
        message.includes(
          `This function requires the recommended package dQuote(${dependency.name}).`,
        ) ||
        message.includes(`Namespace '${dependency.name}' is not registered.`) ||
        message.includes(`Namespace "${dependency.name}" is not registered.`) ||
        message.includes(`Please install the \`${dependency.name}\` package.`) ||
        message.includes(
          `${dependency.name} needed for this function to work. Please install it.`,
        )),
  );
}

function isOptionalPackageDependency(dependency: PackageDependency): boolean {
  return dependency.kind === "Suggests" || dependency.kind === "Enhances";
}

function unguardedOptionalExampleDependency(
  blocks: readonly { readonly kind: string; readonly source: string }[],
  dependencies: readonly PackageDependency[],
): PackageDependency | undefined {
  const source = blocks
    .filter((block) => block.kind === "run")
    .map((block) => block.source)
    .join("\n");
  return dependencies.find((dependency) => {
    if (!isOptionalPackageDependency(dependency)) return false;
    const escaped = dependency.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(
      String.raw`(?:^|\r?\n)[\t ]*(?:base::)?require[\t ]*\([\t ]*(?:"${escaped}"|'${escaped}'|${escaped})(?:[\t ,)]|$)`,
      "u",
    ).test(source);
  });
}

function unavailableOptionalPackageMessage(
  stepLabel: "Example" | "Test" | "Saved-output test",
  dependency: PackageDependency,
): string {
  return dependency.kind === "Suggests"
    ? `${stepLabel} requires unavailable suggested package '${dependency.name}'.`
    : `${stepLabel} requires unavailable optional package '${dependency.name}' declared in Enhances.`;
}

type BrowserHostCapability = "systemCommand";

function unavailableHostCapabilityInError(message: string): BrowserHostCapability | undefined {
  return message.includes(
    "system()/system2()/pipe() requires an explicit createR({ systemCommand }) host capability.",
  )
    ? "systemCommand"
    : undefined;
}

function unavailableHostCapabilityMessage(
  stepLabel: "Example" | "Test" | "Saved-output test",
  capability: BrowserHostCapability,
): string {
  if (capability === "systemCommand") {
    return `${stepLabel} requires an explicit system-command host adapter outside the default browser-admissible runtime.`;
  }
  return `${stepLabel} requires an unavailable browser host capability.`;
}

function packageTestCode(packageName: string, path: string): string {
  const packageLiteral = rString(packageName);
  return `library(${packageLiteral}, character.only = TRUE); ${packageTestWorkspaceCode(packageLiteral)}; test_path <- file.path(.nativr_package_check_workdir, ${rString(path)}); expressions <- parse(text = paste(readLines(test_path), collapse = "\\n")); setwd(.nativr_package_check_workdir); for (expression_index in seq(length.out = length(expressions))) tryCatch(eval(expressions[[expression_index]]), error = function(error) { handler <- getOption("error"); if (is.null(handler)) stop("expression ", expression_index, ": ", conditionMessage(error)); handler(); invisible(NULL) }); invisible(NULL)`;
}

function packageSavedOutputCode(packageName: string, path: string): string {
  const packageLiteral = rString(packageName);
  return `library(${packageLiteral}, character.only = TRUE); ${packageTestWorkspaceCode(packageLiteral)}; test_path <- file.path(.nativr_package_check_workdir, ${rString(path)}); expressions <- parse(text = paste(readLines(test_path), collapse = "\\n")); setwd(.nativr_package_check_workdir); for (expression_index in seq(length.out = length(expressions))) tryCatch(withCallingHandlers({ result <- withVisible(eval(expressions[[expression_index]])); if (result$visible) print(result$value) }, error = function(error) { calls <- sys.calls(); call_names <- sapply(calls, function(call) if (is.null(call)) "" else paste(deparse(call[[1L]]), collapse = "")); call_names <- call_names[nzchar(call_names) & !call_names %in% c("eval", "withVisible", "withCallingHandlers", "tryCatch")]; error_prefix <- paste0("Error in ", paste(deparse(conditionCall(error)), collapse = ""), " :"); error_message <- conditionMessage(error); if (nchar(error_prefix) + 1L + nchar(error_message) > getOption("width")) cat(error_prefix, " \\n  ", error_message, "\\n", sep = "") else cat(error_prefix, " ", error_message, "\\n", sep = ""); if (length(call_names) > 1L) cat("Calls: ", paste(call_names, collapse = " -> "), "\\n", sep = "") }), error = function(error) { handler <- getOption("error"); if (is.null(handler)) stop("expression ", expression_index, ": ", conditionMessage(error)); handler(); invisible(NULL) }); invisible(NULL)`;
}

function packageTestWorkspaceCode(packageLiteral: string): string {
  return `tests <- system.file(".nativr", "tests", package = ${packageLiteral}); .nativr_package_check_workdir <- tempfile("nativr-package-check-"); stopifnot(dir.create(.nativr_package_check_workdir)); .nativr_package_check_entries <- list.files(tests, all.files = TRUE, full.names = TRUE, no.. = TRUE); stopifnot(all(file.copy(.nativr_package_check_entries, .nativr_package_check_workdir, recursive = TRUE)))`;
}

/** Strip command prompts while retaining the package test's observable printed-output contract. */
export function normalizePackageCheckOutput(source: string): string {
  return normalizeSavedOutput(source);
}

function normalizeSavedOutput(source: string): string {
  const lines = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const output = lines
    .filter((line) => !/^[>+](?: |$)/u.test(line))
    .map((line) => line.replace(/[ \t]+$/u, ""));
  while (output[0] === "") output.shift();
  while (output.at(-1) === "") output.pop();
  return output.join("\n");
}

function nonPortableSavedOutputReason(source: string): string | undefined {
  const normalized = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimStart();
  const lines = normalized.split("\n");
  const firstLine = lines[0] ?? "";
  const hasFoundationCopyright = lines.some((line) =>
    /^Copyright \(C\) \d{4} The R Foundation/u.test(line),
  );
  const hasPlatform = lines.some((line) => /^Platform: \S+/u.test(line));
  const hasModernOrDevelopmentBanner =
    (/^R version \d+\.\d+\.\d+(?: |$)/u.test(firstLine) ||
      /^R Under development \([^)]+\) \([^)]+\) -- /u.test(firstLine)) &&
    hasFoundationCopyright &&
    hasPlatform;
  const hasLegacyBanner =
    /^R : Copyright \d{4}, The R Foundation/u.test(firstLine) &&
    lines.some((line) => /^Version \d+\.\d+(?:\.\d+)?(?: |$)/u.test(line));
  const hasGnuRSessionHeader = hasModernOrDevelopmentBanner || hasLegacyBanner;
  if (!hasGnuRSessionHeader) return undefined;
  return "The saved output contains a GNU R version/platform session header and is host-bound; the corresponding retained test remains applicable.";
}

function firstOutputDifference(expected: string, actual: string): string {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const length = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < length; index += 1) {
    if (expectedLines[index] === actualLines[index]) continue;
    return `Saved output differs at line ${index + 1}: expected ${JSON.stringify(expectedLines[index] ?? "<end>")}, received ${JSON.stringify(actualLines[index] ?? "<end>")}.`;
  }
  return "Saved output differs.";
}

function readManifest<T>(artifact: NativRPackageArtifact, path: string): T | undefined {
  const resource = artifact.bundle.resources.find((candidate) => candidate.path === path);
  if (resource === undefined) return undefined;
  try {
    return JSON.parse(Buffer.from(resource.data, "base64").toString("utf8")) as T;
  } catch (error) {
    throw new Error(`Package '${artifact.package.name}' has an invalid ${path} resource.`, {
      cause: error,
    });
  }
}

function rString(value: string): string {
  return JSON.stringify(value);
}

function rCharacter(values: readonly string[]): string {
  return values.length === 0 ? "character()" : `c(${values.map(rString).join(", ")})`;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareCText);
}

/**
 * Map GNU R's conventional S4 Rd aliases back to the names visible through a namespace.
 * Class exports are represented as synthetic `.__C__<class>` bindings, while an exported
 * method is documented by an alias such as `show,Foo-method` or `[,Foo,ANY-method`.
 */
function expandDocumentationAliases(aliases: readonly string[]): readonly string[] {
  const documented = new Set(aliases);
  const documentedMethodGenerics = new Set<string>();
  for (const alias of aliases) {
    if (alias.endsWith("-class") && alias.length > "-class".length) {
      documented.add(`.__C__${alias.slice(0, -"-class".length)}`);
    }
    if (!alias.endsWith("-method")) continue;
    const methodName = alias.slice(0, alias.indexOf(","));
    if (methodName.length > 0) {
      documented.add(methodName);
      documentedMethodGenerics.add(methodName);
    }
  }
  if (documentedMethodGenerics.has("Ops")) {
    for (const member of [
      "+",
      "-",
      "*",
      "/",
      "^",
      "%%",
      "%/%",
      "&",
      "|",
      "!",
      "==",
      "!=",
      "<",
      "<=",
      ">=",
      ">",
    ]) {
      documented.add(member);
    }
  }
  return [...documented].sort(compareCText);
}

function compareCText(left: string, right: string): number {
  return Buffer.from(left).compare(Buffer.from(right));
}
