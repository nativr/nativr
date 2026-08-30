import { createHash } from "node:crypto";

import bz2 from "bz2";
import xzDecompress from "xz-decompress";

import {
  parseDcf,
  parsePackageDependencies,
  requiredDcfField,
  validatePackageIdentity,
} from "./dcf.js";
import { readPackageSource } from "./source.js";
import type { PackageSourceFile } from "./source.js";
import {
  extractPackageDatasets,
  extractPackageExamples,
  extractPackageHelp,
  PACKAGE_DATASETS_RESOURCE_PATH,
  PACKAGE_EXAMPLES_RESOURCE_PATH,
  PACKAGE_HELP_RESOURCE_PATH,
} from "./rd-examples.js";
import { extractPackageVignettes, PACKAGE_VIGNETTES_RESOURCE_PATH } from "./vignettes.js";
import {
  extractPackageTests,
  PACKAGE_TESTS_RESOURCE_PATH,
  PACKAGE_TESTS_RESOURCE_ROOT,
} from "./package-tests.js";
import {
  PackageCompatibilityError,
  type NativRPackageArtifact,
  type PackageCompatibilityIssue,
  type PackagePackLimits,
  type PackagePackOptions,
} from "./types.js";

const { XzReadableStream } = xzDecompress;
export { comparePackageVersions, resolvePackageArtifacts } from "./resolve.js";
export { installPackagesFromRepository } from "./repository.js";
export {
  createPackageCheckPlan,
  normalizePackageCheckOutput,
  runPackageChecks,
} from "./package-check.js";

export type {
  NativRPackageArtifact,
  PackageCompatibilityIssue,
  PackageDependency,
  PackageDependencyKind,
  PackagePackLimits,
  PackagePackOptions,
  PackagedPureRBundle,
  ResolvePackageOptions,
  ResolvedPackageSet,
  RepositoryInstallOptions,
  RepositoryInstallResult,
} from "./types.js";
export type {
  PackageCheckEvaluation,
  PackageCheckExecutor,
  PackageCheckKind,
  PackageCheckPlan,
  PackageCheckResult,
  PackageCheckStatus,
  PackageCheckStep,
  PackageCheckStepResult,
} from "./package-check.js";
export { PackageCompatibilityError } from "./types.js";
export {
  extractPackageTests,
  PACKAGE_TESTS_RESOURCE_PATH,
  PACKAGE_TESTS_RESOURCE_ROOT,
} from "./package-tests.js";
export type {
  ExtractedPackageTests,
  PackageTestScript,
  PackageTestsManifest,
} from "./package-tests.js";

export const DEFAULT_PACKAGE_PACK_LIMITS: PackagePackLimits = Object.freeze({
  maxFiles: 16_384,
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalBytes: 192 * 1024 * 1024,
  maxPathDepth: 32,
});

const CONFIGURE_HOOKS = new Set(["configure", "configure.win", "configure.ucrt"]);
const CLEANUP_HOOKS = new Set(["cleanup", "cleanup.win", "cleanup.ucrt"]);
const LEGAL_FILES = new Set(["LICENSE", "LICENCE", "COPYING", "NOTICE"]);
const INSTALLED_NEWS_FILES = new Set(["NEWS", "NEWS.Rd", "NEWS.md"]);
const SUPPORTED_NAMESPACE_DIRECTIVES = new Set([
  "export",
  "exportClasses",
  "exportPattern",
  "exportMethods",
  "import",
  "importFrom",
  "importMethodsFrom",
  "S3method",
]);
const R_SOURCE_PATH = /^R\/(?:[^/]+\/)*[^/]+\.[RSqrs]$/u;
const PACKAGE_SOURCE_RESOURCE_ROOT = ".nativr/source";
const TARGET_R_VERSION = "4.6.1";
const TARGET_R_OS = "browser";
const TARGET_CORE_NAMESPACE_EXPORTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  utils: Object.freeze(["packageDescription"]),
});

/** Inspect any directory or source tarball and return a deterministic artifact plus diagnostics. */
export async function inspectPackage(
  source: string | URL,
  options: PackagePackOptions = {},
): Promise<NativRPackageArtifact> {
  const limits = effectiveLimits(options.limits);
  const files = await readPackageSource(source, limits);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const sourcePlatform = options.sourcePlatform ?? "unix";
  const decodedDescription = decodeDescription(requiredFile(byPath, "DESCRIPTION"));
  const description = decodedDescription.source;
  const fields = decodedDescription.fields;
  const namespaceSource = decodePackageText(
    requiredFile(byPath, "NAMESPACE"),
    "NAMESPACE",
    decodedDescription.encoding,
  );
  const name = requiredDcfField(fields, "Package");
  const version = requiredDcfField(fields, "Version");
  validatePackageIdentity(name, version);
  const dependencies = parsePackageDependencies(fields);
  const issues: PackageCompatibilityIssue[] = [];
  const namespace = selectPlatformNamespace(namespaceSource, sourcePlatform, issues);
  inspectInstallSurface(files, fields, namespace, sourcePlatform, issues);

  const rSources = collateRSourceFiles(files, fields, sourcePlatform).map((file) => ({
    path: file.path,
    source: decodePackageText(file, "R source", decodedDescription.encoding),
  }));
  const resources: { path: string; data: string }[] = [];
  let installedResourceBytes = 0;
  for (const file of files) {
    const installedPath = installedResourcePath(file.path);
    if (installedPath === undefined) continue;
    const data = await normalizeInstalledResource(file, limits);
    installedResourceBytes += data.byteLength;
    if (installedResourceBytes > limits.maxTotalBytes) {
      throw new Error(
        `Installed package resources exceed the ${limits.maxTotalBytes}-byte normalized limit.`,
      );
    }
    resources.push({ path: installedPath, data: Buffer.from(data).toString("base64") });
  }
  for (const reservedRoot of [PACKAGE_SOURCE_RESOURCE_ROOT, PACKAGE_TESTS_RESOURCE_ROOT]) {
    if (
      resources.some(
        (resource) =>
          resource.path === reservedRoot || resource.path.startsWith(`${reservedRoot}/`),
      )
    ) {
      throw new Error(`Package resource path '${reservedRoot}' is reserved.`);
    }
  }
  const sourceEvaluationResources = files
    .filter((file) => file.path.startsWith("tools/"))
    .map((file) => ({
      path: `${PACKAGE_SOURCE_RESOURCE_ROOT}/${file.path}`,
      data: Buffer.from(file.data).toString("base64"),
    }));
  resources.push(...sourceEvaluationResources);
  for (const reservedPath of [
    PACKAGE_DATASETS_RESOURCE_PATH,
    PACKAGE_EXAMPLES_RESOURCE_PATH,
    PACKAGE_HELP_RESOURCE_PATH,
    PACKAGE_VIGNETTES_RESOURCE_PATH,
    PACKAGE_TESTS_RESOURCE_PATH,
  ]) {
    if (resources.some((resource) => resource.path === reservedPath)) {
      throw new Error(`Package resource path '${reservedPath}' is reserved.`);
    }
  }
  const rdSources = files
    .filter((file) => /^man\/(?:.*\/)?[^/]+\.Rd$/iu.test(file.path))
    .map((file) => ({
      path: file.path,
      source: decodePackageText(file, "Rd source", decodedDescription.encoding),
    }));
  let generatedPackageMetadata = false;
  const datasets = extractPackageDatasets(
    rdSources,
    resources.map((resource) => resource.path),
  );
  if (datasets !== undefined) {
    resources.push({
      path: PACKAGE_DATASETS_RESOURCE_PATH,
      data: Buffer.from(JSON.stringify(datasets), "utf8").toString("base64"),
    });
    generatedPackageMetadata = true;
  }
  const examples = extractPackageExamples(rdSources);
  if (examples !== undefined) {
    resources.push({
      path: PACKAGE_EXAMPLES_RESOURCE_PATH,
      data: Buffer.from(JSON.stringify(examples), "utf8").toString("base64"),
    });
    generatedPackageMetadata = true;
  }
  const help = extractPackageHelp(rdSources);
  if (help !== undefined) {
    resources.push({
      path: PACKAGE_HELP_RESOURCE_PATH,
      data: Buffer.from(JSON.stringify(help), "utf8").toString("base64"),
    });
    generatedPackageMetadata = true;
  }
  const vignettes = extractPackageVignettes(files, (file) =>
    decodePackageText(file, "vignette source", decodedDescription.encoding),
  );
  if (vignettes !== undefined) {
    resources.push({
      path: PACKAGE_VIGNETTES_RESOURCE_PATH,
      data: Buffer.from(JSON.stringify(vignettes), "utf8").toString("base64"),
    });
    generatedPackageMetadata = true;
  }
  if (options.includeTests === true) {
    const tests = extractPackageTests(files);
    if (tests !== undefined) {
      resources.push(...tests.resources, {
        path: PACKAGE_TESTS_RESOURCE_PATH,
        data: Buffer.from(JSON.stringify(tests.manifest), "utf8").toString("base64"),
      });
      generatedPackageMetadata = true;
    }
  }
  if (generatedPackageMetadata || sourceEvaluationResources.length > 0) {
    resources.sort((left, right) => compareCPath(left.path, right.path));
  }
  const compatibility = {
    packaging: issues.some((issue) => issue.severity === "error")
      ? ("blocked" as const)
      : ("ready" as const),
    execution: "unchecked" as const,
    issues: Object.freeze(sortIssues(issues)),
  };
  const license = fields.get("License");
  const unsigned = {
    format: "nativr-pure-r-package" as const,
    formatVersion: 1 as const,
    sourcePlatform,
    package: {
      name,
      version,
      ...(license === undefined ? {} : { license }),
    },
    dependencies: Object.freeze(dependencies),
    bundle: {
      description,
      namespace,
      rSources: Object.freeze(rSources),
      resources: Object.freeze(resources),
    },
    compatibility,
  };
  const value = createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
  return Object.freeze({
    ...unsigned,
    integrity: Object.freeze({ algorithm: "sha256" as const, value }),
  });
}

async function normalizeInstalledResource(
  file: PackageSourceFile,
  limits: PackagePackLimits,
): Promise<Uint8Array> {
  const serializable = /^(?:R\/(?:.*\/)?sysdata|(?:data|demo)\/.*)\.(?:rda|rdata|rds)$/iu.test(
    file.path,
  );
  if (!serializable) return file.data;
  let output = file.data;
  if (file.data[0] === 0x42 && file.data[1] === 0x5a && file.data[2] === 0x68) {
    try {
      output = bz2.decompress(file.data);
    } catch (error) {
      throw new Error(`Package resource '${file.path}' contains invalid bzip2 data.`, {
        cause: error,
      });
    }
  } else if (
    file.data[0] === 0xfd &&
    file.data[1] === 0x37 &&
    file.data[2] === 0x7a &&
    file.data[3] === 0x58 &&
    file.data[4] === 0x5a
  ) {
    output = await decompressXzResource(file, limits.maxFileBytes);
  }
  if (output.byteLength > limits.maxFileBytes) {
    throw new Error(
      `Package resource '${file.path}' expands beyond the ${limits.maxFileBytes}-byte normalized limit.`,
    );
  }
  return output;
}

async function decompressXzResource(
  file: PackageSourceFile,
  maxOutputBytes: number,
): Promise<Uint8Array> {
  const compressed = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(file.data);
      controller.close();
    },
  });
  const reader = new XzReadableStream(compressed).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maxOutputBytes) {
        await reader.cancel();
        throw new Error(
          `Package resource '${file.path}' expands beyond the ${maxOutputBytes}-byte normalized limit.`,
        );
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("normalized limit")) throw error;
    throw new Error(`Package resource '${file.path}' contains invalid xz data.`, { cause: error });
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/** Build a loadable candidate, refusing install surfaces the current browser runtime cannot model. */
export async function packPackage(
  source: string | URL,
  options: PackagePackOptions = {},
): Promise<NativRPackageArtifact> {
  const artifact = await inspectPackage(source, options);
  if (artifact.compatibility.packaging === "blocked") throw new PackageCompatibilityError(artifact);
  return artifact;
}

/** Verify that a parsed JSON value is an intact v1 artifact before supplying its bundle to NativR. */
export function verifyPackageArtifact(value: unknown): value is NativRPackageArtifact {
  if (
    !isRecord(value) ||
    value.format !== "nativr-pure-r-package" ||
    value.formatVersion !== 1 ||
    (value.sourcePlatform !== "unix" && value.sourcePlatform !== "windows")
  ) {
    return false;
  }
  if (
    !isRecord(value.package) ||
    typeof value.package.name !== "string" ||
    typeof value.package.version !== "string" ||
    (value.package.license !== undefined && typeof value.package.license !== "string") ||
    !Array.isArray(value.dependencies) ||
    !value.dependencies.every(isPackageDependency) ||
    !isPackageBundle(value.bundle) ||
    !isCompatibility(value.compatibility)
  ) {
    return false;
  }
  const integrity = value.integrity;
  if (
    !isRecord(integrity) ||
    integrity.algorithm !== "sha256" ||
    typeof integrity.value !== "string" ||
    !/^[a-f0-9]{64}$/u.test(integrity.value)
  ) {
    return false;
  }
  const unsigned = { ...value };
  delete unsigned.integrity;
  const actual = createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
  return actual === integrity.value;
}

function effectiveLimits(overrides: Partial<PackagePackLimits> | undefined): PackagePackLimits {
  const limits = { ...DEFAULT_PACKAGE_PACK_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Invalid package limit '${name}'.`);
  }
  return limits;
}

function inspectInstallSurface(
  files: readonly PackageSourceFile[],
  fields: ReadonlyMap<string, string>,
  namespace: string,
  sourcePlatform: "unix" | "windows",
  issues: PackageCompatibilityIssue[],
): void {
  for (const file of files) {
    const lowerPath = file.path.toLowerCase();
    if (file.path.startsWith("src/") || /\.(?:so|dll|dylib|a|o)$/u.test(lowerPath)) {
      addIssue(
        issues,
        "NRPKG1001",
        "error",
        "Native compiled code is not a pure-R install surface.",
        file.path,
      );
    }
    if (file.path.startsWith("java/") || lowerPath.endsWith(".jar")) {
      addIssue(
        issues,
        "NRPKG1002",
        "warning",
        "JVM source and archives are inert package assets: NativR does not compile or execute them, and behavior that requires a JVM remains unavailable.",
        file.path,
      );
    }
    if (CONFIGURE_HOOKS.has(file.path)) {
      addIssue(
        issues,
        "NRPKG1003",
        "error",
        "Host installation hooks are not executed.",
        file.path,
      );
    }
    if (CLEANUP_HOOKS.has(file.path)) {
      addIssue(
        issues,
        "NRPKG1015",
        "warning",
        "Host cleanup hooks are not executed; browser artifacts are assembled only from declared source resources and contain no host build byproducts.",
        file.path,
      );
    }
    if (/^R\/(?:.*\/)?sysdata\.(?:rda|rdata)$/iu.test(file.path)) {
      addIssue(
        issues,
        "NRPKG1004",
        "warning",
        "Internal sysdata uses build-time bzip2/xz normalization when needed and the browser runtime's bounded GNU R serialization decoder; unsupported serialized value types and compression remain explicit.",
        file.path,
      );
    } else if (/^(?:data|demo)\/.*\.(?:rda|rdata|rds)$/iu.test(file.path)) {
      addIssue(
        issues,
        "NRPKG1005",
        "warning",
        "GNU R binary data uses build-time bzip2/xz normalization when needed and the bounded browser XDR/gzip decoder; unsupported compression or value types still fail explicitly.",
        file.path,
      );
    }
  }
  if (fields.get("NeedsCompilation")?.trim().toLowerCase() === "yes") {
    addIssue(issues, "NRPKG1007", "error", "DESCRIPTION declares NeedsCompilation: yes.");
  }
  if ((fields.get("LinkingTo") ?? "").trim().length > 0) {
    addIssue(issues, "NRPKG1008", "error", "DESCRIPTION declares LinkingTo dependencies.");
  }
  if ((fields.get("SystemRequirements") ?? "").trim().length > 0) {
    addIssue(
      issues,
      "NRPKG1009",
      "warning",
      "SystemRequirements must be reviewed against browser capabilities.",
    );
  }
  const osType = fields.get("OS_type")?.trim().toLowerCase();
  if (osType !== undefined && osType !== "unix" && osType !== "windows") {
    addIssue(issues, "NRPKG1013", "error", `DESCRIPTION has invalid OS_type '${osType}'.`);
  } else if (osType !== undefined && osType !== sourcePlatform) {
    addIssue(
      issues,
      "NRPKG1014",
      "error",
      `Package requires OS_type '${osType}', but source platform '${sourcePlatform}' was selected.`,
    );
  }
  inspectNamespace(namespace, issues);
}

function inspectNamespace(source: string, issues: PackageCompatibilityIssue[]): void {
  let index = 0;
  const normalized = stripNamespaceComments(source);
  while (index < normalized.length) {
    while (/\s/u.test(normalized[index] ?? "")) index += 1;
    if (index >= normalized.length) break;
    const nameMatch = /^[A-Za-z][A-Za-z0-9.]*/u.exec(normalized.slice(index));
    const name = nameMatch?.[0];
    if (name === undefined) {
      addIssue(
        issues,
        "NRPKG1010",
        "error",
        "NAMESPACE contains conditional or malformed declarations.",
        "NAMESPACE",
      );
      return;
    }
    index += name.length;
    while (/\s/u.test(normalized[index] ?? "")) index += 1;
    if (normalized[index] !== "(") {
      addIssue(
        issues,
        "NRPKG1010",
        "error",
        `NAMESPACE declaration '${name}' is malformed.`,
        "NAMESPACE",
      );
      return;
    }
    index = skipBalancedCall(normalized, index);
    if (name === "useDynLib") {
      addIssue(
        issues,
        "NRPKG1011",
        "error",
        "NAMESPACE requests a native dynamic library.",
        "NAMESPACE",
      );
    } else if (!SUPPORTED_NAMESPACE_DIRECTIVES.has(name)) {
      addIssue(
        issues,
        "NRPKG1012",
        "error",
        `NAMESPACE directive '${name}' is not supported by the current loader.`,
        "NAMESPACE",
      );
    }
  }
}

function selectPlatformNamespace(
  source: string,
  sourcePlatform: "unix" | "windows",
  issues: PackageCompatibilityIssue[],
): string {
  const normalized = stripNamespaceComments(source);
  const selected: string[] = [];
  let index = 0;
  while (index < normalized.length) {
    while (/\s/u.test(normalized[index] ?? "")) index += 1;
    if (index >= normalized.length) break;
    const statementStart = index;
    const nameMatch = /^[A-Za-z][A-Za-z0-9.]*/u.exec(normalized.slice(index));
    const name = nameMatch?.[0];
    if (name === undefined) return namespaceSelectionError(issues);
    index += name.length;
    while (/\s/u.test(normalized[index] ?? "")) index += 1;
    if (normalized[index] !== "(") return namespaceSelectionError(issues);
    const callEnd = skipBalancedRegion(normalized, index, "(", ")");
    if (name !== "if") {
      selected.push(normalized.slice(statementStart, callEnd).trim());
      index = callEnd;
      continue;
    }

    const condition = normalized.slice(index + 1, callEnd - 1);
    const thenBranch = readNamespaceBranch(normalized, callEnd);
    if (thenBranch === undefined) return namespaceSelectionError(issues);
    const thenSource = thenBranch.source;
    index = skipNamespaceWhitespace(normalized, thenBranch.end);
    let elseSource = "";
    if (isNamespaceElse(normalized, index)) {
      const elseBranch = readNamespaceBranch(normalized, index + 4);
      if (elseBranch === undefined) return namespaceSelectionError(issues);
      elseSource = elseBranch.source;
      index = elseBranch.end;
    }
    let enabled: boolean;
    try {
      enabled = evaluateNamespaceCondition(condition, sourcePlatform);
    } catch {
      addIssue(
        issues,
        "NRPKG1015",
        "error",
        "NAMESPACE conditional is outside the safe platform-expression subset.",
        "NAMESPACE",
      );
      continue;
    }
    const branch = selectPlatformNamespace(
      enabled ? thenSource : elseSource,
      sourcePlatform,
      issues,
    );
    if (branch.trim().length > 0) selected.push(branch.trim());
  }
  return selected.length === 0 ? "" : `${selected.join("\n")}\n`;
}

interface NamespaceBranch {
  readonly source: string;
  readonly end: number;
}

function readNamespaceBranch(source: string, start: number): NamespaceBranch | undefined {
  const index = skipNamespaceWhitespace(source, start);
  if (source[index] === "{") {
    const end = skipBalancedRegion(source, index, "{", "}");
    return { source: source.slice(index + 1, end - 1), end };
  }
  const end = readNamespaceStatementEnd(source, index);
  return end === undefined ? undefined : { source: source.slice(index, end), end };
}

function readNamespaceStatementEnd(source: string, start: number): number | undefined {
  let index = skipNamespaceWhitespace(source, start);
  const nameMatch = /^[A-Za-z][A-Za-z0-9.]*/u.exec(source.slice(index));
  const name = nameMatch?.[0];
  if (name === undefined) return undefined;
  index = skipNamespaceWhitespace(source, index + name.length);
  if (source[index] !== "(") return undefined;
  const callEnd = skipBalancedRegion(source, index, "(", ")");
  if (name !== "if") return callEnd;
  const thenBranch = readNamespaceBranch(source, callEnd);
  if (thenBranch === undefined) return undefined;
  index = skipNamespaceWhitespace(source, thenBranch.end);
  if (!isNamespaceElse(source, index)) return thenBranch.end;
  return readNamespaceBranch(source, index + 4)?.end;
}

function skipNamespaceWhitespace(source: string, start: number): number {
  let index = start;
  while (/\s/u.test(source[index] ?? "")) index += 1;
  return index;
}

function isNamespaceElse(source: string, index: number): boolean {
  if (source.slice(index, index + 4) !== "else") return false;
  return !/[A-Za-z0-9.]/u.test(source[index + 4] ?? "");
}

function namespaceSelectionError(issues: PackageCompatibilityIssue[]): string {
  addIssue(
    issues,
    "NRPKG1010",
    "error",
    "NAMESPACE contains conditional or malformed declarations.",
    "NAMESPACE",
  );
  return "";
}

function evaluateNamespaceCondition(source: string, sourcePlatform: "unix" | "windows"): boolean {
  const expression = trimBalancedParentheses(source.trim());
  const orIndex = findTopLevelOperator(expression, "||");
  if (orIndex >= 0) {
    return (
      evaluateNamespaceCondition(expression.slice(0, orIndex), sourcePlatform) ||
      evaluateNamespaceCondition(expression.slice(orIndex + 2), sourcePlatform)
    );
  }
  const andIndex = findTopLevelOperator(expression, "&&");
  if (andIndex >= 0) {
    return (
      evaluateNamespaceCondition(expression.slice(0, andIndex), sourcePlatform) &&
      evaluateNamespaceCondition(expression.slice(andIndex + 2), sourcePlatform)
    );
  }
  if (expression.startsWith("!")) {
    return !evaluateNamespaceCondition(expression.slice(1), sourcePlatform);
  }
  const targetOsGrep =
    /^identical\(\s*1L\s*,\s*grep\(\s*["']([A-Za-z0-9._-]+)["']\s*,\s*R\.version\[\[\s*["']os["']\s*\]\]\s*\)\s*\)$/u.exec(
      expression,
    );
  if (targetOsGrep !== null) return TARGET_R_OS.includes(targetOsGrep[1] ?? "");
  const membershipIndex = findTopLevelOperator(expression, "%in%");
  if (membershipIndex >= 0) {
    const left = namespaceConditionScalar(expression.slice(0, membershipIndex), sourcePlatform);
    const right = namespaceConditionScalar(expression.slice(membershipIndex + 4), sourcePlatform);
    if (typeof left !== "string" || !Array.isArray(right)) {
      throw new Error("Unsupported NAMESPACE membership condition.");
    }
    return right.includes(left);
  }
  for (const operator of ["<=", ">=", "<", ">"] as const) {
    const operatorIndex = findTopLevelOperator(expression, operator);
    if (operatorIndex < 0) continue;
    const left = namespaceConditionScalar(expression.slice(0, operatorIndex), sourcePlatform);
    const right = namespaceConditionScalar(
      expression.slice(operatorIndex + operator.length),
      sourcePlatform,
    );
    const comparison = compareNamespaceVersions(left, right);
    if (operator === "<=") return comparison <= 0;
    if (operator === ">=") return comparison >= 0;
    if (operator === "<") return comparison < 0;
    return comparison > 0;
  }
  for (const operator of ["==", "!="] as const) {
    const operatorIndex = findTopLevelOperator(expression, operator);
    if (operatorIndex < 0) continue;
    const left = namespaceConditionScalar(expression.slice(0, operatorIndex), sourcePlatform);
    const right = namespaceConditionScalar(
      expression.slice(operatorIndex + operator.length),
      sourcePlatform,
    );
    const equal = namespaceConditionScalarsEqual(left, right);
    return operator === "==" ? equal : !equal;
  }
  const scalar = namespaceConditionScalar(expression, sourcePlatform);
  if (typeof scalar !== "boolean") throw new Error("NAMESPACE condition is not logical.");
  return scalar;
}

function namespaceConditionScalar(
  source: string,
  sourcePlatform: "unix" | "windows",
): NamespaceConditionScalar {
  const expression = trimBalancedParentheses(source.trim());
  if (expression === ".Platform$OS.type") return sourcePlatform;
  if (/^Sys\.getenv\(\s*["']R_OSTYPE["']\s*\)$/u.test(expression)) return sourcePlatform;
  if (/^tools:::\.OStype\(\s*\)$/u.test(expression)) return sourcePlatform;
  if (/^getRversion\(\s*\)$/u.test(expression)) {
    return Object.freeze({ kind: "r-version", value: TARGET_R_VERSION });
  }
  const namespaceExportsMatch = /^getNamespaceExports\(\s*["']([^"']+)["']\s*\)$/u.exec(expression);
  if (namespaceExportsMatch !== null) {
    const exports = TARGET_CORE_NAMESPACE_EXPORTS[namespaceExportsMatch[1] ?? ""];
    if (exports === undefined) throw new Error("Unknown core namespace in NAMESPACE condition.");
    return exports;
  }
  if (expression === "TRUE") return true;
  if (expression === "FALSE") return false;
  const stringMatch = /^(?:"([^"\\]*)"|'([^'\\]*)')$/u.exec(expression);
  if (stringMatch !== null) return stringMatch[1] ?? stringMatch[2] ?? "";
  throw new Error("Unsupported NAMESPACE condition scalar.");
}

type NamespaceConditionScalar =
  string | boolean | readonly string[] | Readonly<{ kind: "r-version"; value: string }>;

function namespaceConditionScalarsEqual(
  left: NamespaceConditionScalar,
  right: NamespaceConditionScalar,
): boolean {
  if (isRVersionScalar(left) || isRVersionScalar(right)) {
    return compareNamespaceVersions(left, right) === 0;
  }
  return left === right;
}

function compareNamespaceVersions(
  left: NamespaceConditionScalar,
  right: NamespaceConditionScalar,
): number {
  if (!isRVersionScalar(left) && !isRVersionScalar(right)) {
    throw new Error("NAMESPACE ordered comparison is limited to getRversion().");
  }
  const leftVersion = isRVersionScalar(left) ? left.value : versionString(left);
  const rightVersion = isRVersionScalar(right) ? right.value : versionString(right);
  const leftParts = parseRVersion(leftVersion);
  const rightParts = parseRVersion(rightVersion);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

function isRVersionScalar(
  value: NamespaceConditionScalar,
): value is Readonly<{ kind: "r-version"; value: string }> {
  return typeof value === "object" && !Array.isArray(value) && "kind" in value;
}

function versionString(value: NamespaceConditionScalar): string {
  if (typeof value !== "string") throw new Error("NAMESPACE version must be a string literal.");
  return value;
}

function parseRVersion(value: string): readonly number[] {
  if (!/^\d+(?:\.\d+)*$/u.test(value)) throw new Error("Unsupported R version literal.");
  return value.split(".").map((part) => Number.parseInt(part, 10));
}

function trimBalancedParentheses(source: string): string {
  let result = source;
  while (result.startsWith("(") && skipBalancedRegion(result, 0, "(", ")") === result.length) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function findTopLevelOperator(source: string, operator: string): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = 0; index <= source.length - operator.length; index += 1) {
    const character = source[index] ?? "";
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (depth === 0 && source.slice(index, index + operator.length) === operator) return index;
  }
  return -1;
}

function skipBalancedRegion(
  source: string,
  openingIndex: number,
  openingCharacter: "(" | "{",
  closingCharacter: ")" | "}",
): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === openingCharacter) depth += 1;
    else if (character === closingCharacter) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error("NAMESPACE contains an unterminated declaration.");
}

function skipBalancedCall(source: string, openingIndex: number): number {
  return skipBalancedRegion(source, openingIndex, "(", ")");
}

function stripNamespaceComments(source: string): string {
  return source
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => {
      let quote: string | undefined;
      let escaped = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index] ?? "";
        if (quote !== undefined) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === quote) quote = undefined;
        } else if (character === '"' || character === "'" || character === "`") quote = character;
        else if (character === "#") return line.slice(0, index);
      }
      return line;
    })
    .join("\n");
}

function collateRSourceFiles(
  files: readonly PackageSourceFile[],
  fields: ReadonlyMap<string, string>,
  sourcePlatform: "unix" | "windows",
): readonly PackageSourceFile[] {
  const selected = files
    .filter((file) => {
      if (!R_SOURCE_PATH.test(file.path)) return false;
      const relative = file.path.slice("R/".length);
      if (relative.startsWith("unix/")) return sourcePlatform === "unix";
      if (relative.startsWith("windows/")) return sourcePlatform === "windows";
      return true;
    })
    .sort((left, right) => compareCPath(left.path, right.path));
  const specification = fields.get(`Collate.${sourcePlatform}`) ?? fields.get("Collate");
  if (specification === undefined) return selected;
  const byRelativePath = new Map(selected.map((file) => [file.path.slice("R/".length), file]));
  const ordered: PackageSourceFile[] = [];
  const seen = new Set<string>();
  for (const relativePath of parseCollateSpecification(specification)) {
    if (seen.has(relativePath)) {
      throw new Error(`DESCRIPTION Collate repeats R source '${relativePath}'.`);
    }
    const file = byRelativePath.get(relativePath);
    if (file === undefined) {
      throw new Error(
        `DESCRIPTION Collate references unavailable R source '${relativePath}' for '${sourcePlatform}'.`,
      );
    }
    seen.add(relativePath);
    ordered.push(file);
  }
  const missing = [...byRelativePath.keys()].filter((path) => !seen.has(path));
  if (missing.length > 0) {
    throw new Error(`DESCRIPTION Collate omits R source '${missing[0] ?? ""}'.`);
  }
  return ordered;
}

function parseCollateSpecification(source: string): readonly string[] {
  const paths: string[] = [];
  let index = 0;
  while (index < source.length) {
    while (/\s/u.test(source[index] ?? "")) index += 1;
    if (index >= source.length) break;
    const quote = source[index] === '"' || source[index] === "'" ? source[index] : undefined;
    if (quote !== undefined) index += 1;
    let value = "";
    let closed = quote === undefined;
    while (index < source.length) {
      const character = source[index] ?? "";
      if (quote === undefined && /\s/u.test(character)) break;
      index += 1;
      if (quote !== undefined && character === quote) {
        closed = true;
        break;
      }
      if (character === "\\" && index < source.length) {
        value += source[index] ?? "";
        index += 1;
      } else {
        value += character;
      }
    }
    if (!closed) throw new Error("DESCRIPTION Collate contains an unterminated quoted path.");
    if (
      value.length === 0 ||
      value.includes("\\") ||
      value.startsWith("/") ||
      value.split("/").some((part) => part === "" || part === "." || part === "..")
    ) {
      throw new Error(`DESCRIPTION Collate contains unsafe R source path '${value}'.`);
    }
    paths.push(value);
    while (/\s/u.test(source[index] ?? "")) index += 1;
  }
  return paths;
}

function compareCPath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function installedResourcePath(sourcePath: string): string | undefined {
  if (sourcePath.startsWith("inst/")) return sourcePath.slice("inst/".length);
  if (/^R\/(?:.*\/)?sysdata\.(?:rda|rdata)$/iu.test(sourcePath)) return sourcePath;
  if (
    sourcePath.startsWith("data/") ||
    sourcePath.startsWith("demo/") ||
    sourcePath.startsWith("exec/")
  ) {
    return sourcePath;
  }
  return LEGAL_FILES.has(sourcePath) || INSTALLED_NEWS_FILES.has(sourcePath)
    ? sourcePath
    : undefined;
}

function requiredFile(
  files: ReadonlyMap<string, PackageSourceFile>,
  path: string,
): PackageSourceFile {
  const file = files.get(path);
  if (file === undefined) throw new Error(`Package source is missing '${path}'.`);
  return file;
}

function decodeDescription(file: PackageSourceFile): {
  readonly source: string;
  readonly fields: ReadonlyMap<string, string>;
  readonly encoding: "utf-8" | "latin1";
} {
  let utf8: string | undefined;
  try {
    utf8 = new TextDecoder("utf-8", { fatal: true }).decode(file.data);
  } catch {
    // DESCRIPTION can declare its own portable latin1 encoding in ASCII fields.
  }
  if (utf8 !== undefined) {
    const fields = parseDcf(utf8);
    const encoding = normalizePackageEncoding(fields.get("Encoding"));
    if (encoding === "utf-8") return { source: utf8, fields, encoding };
  }
  const latin1 = Buffer.from(file.data).toString("latin1");
  const fields = parseDcf(latin1);
  const encoding = normalizePackageEncoding(fields.get("Encoding"));
  if (encoding !== "latin1") {
    throw new Error("DESCRIPTION is not valid UTF-8 and does not declare Encoding: latin1.");
  }
  return { source: latin1, fields, encoding };
}

function normalizePackageEncoding(value: string | undefined): "utf-8" | "latin1" {
  if (value === undefined || /^utf-?8$/iu.test(value.trim())) return "utf-8";
  if (/^latin-?1$/iu.test(value.trim())) return "latin1";
  throw new Error(`Package Encoding '${value}' is not supported; use UTF-8 or latin1.`);
}

function decodePackageText(
  file: PackageSourceFile,
  label: string,
  encoding: "utf-8" | "latin1",
): string {
  if (encoding === "latin1") return Buffer.from(file.data).toString("latin1");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(file.data);
  } catch {
    throw new Error(`${label} '${file.path}' is not valid UTF-8.`);
  }
}

function addIssue(
  issues: PackageCompatibilityIssue[],
  code: string,
  severity: "error" | "warning",
  message: string,
  path?: string,
): void {
  issues.push({ code, severity, message, ...(path === undefined ? {} : { path }) });
}

function sortIssues(issues: readonly PackageCompatibilityIssue[]): PackageCompatibilityIssue[] {
  return [...issues].sort((left, right) =>
    `${left.severity}:${left.code}:${left.path ?? ""}`.localeCompare(
      `${right.severity}:${right.code}:${right.path ?? ""}`,
      "en",
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPackageDependency(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !["Depends", "Imports", "Suggests", "Enhances", "LinkingTo"].includes(
      typeof value.kind === "string" ? value.kind : "",
    )
  ) {
    return false;
  }
  if (value.constraint === undefined) return true;
  return (
    isRecord(value.constraint) &&
    typeof value.constraint.operator === "string" &&
    [">=", "<=", "==", ">", "<", "!="].includes(value.constraint.operator) &&
    typeof value.constraint.version === "string"
  );
}

function isPackageBundle(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.description === "string" &&
    typeof value.namespace === "string" &&
    Array.isArray(value.rSources) &&
    value.rSources.every(
      (entry) =>
        isRecord(entry) && typeof entry.path === "string" && typeof entry.source === "string",
    ) &&
    Array.isArray(value.resources) &&
    value.resources.every(
      (entry) =>
        isRecord(entry) && typeof entry.path === "string" && typeof entry.data === "string",
    )
  );
}

function isCompatibility(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.packaging === "ready" || value.packaging === "blocked") &&
    value.execution === "unchecked" &&
    Array.isArray(value.issues) &&
    value.issues.every(
      (issue) =>
        isRecord(issue) &&
        typeof issue.code === "string" &&
        (issue.severity === "error" || issue.severity === "warning") &&
        typeof issue.message === "string" &&
        (issue.path === undefined || typeof issue.path === "string"),
    )
  );
}
