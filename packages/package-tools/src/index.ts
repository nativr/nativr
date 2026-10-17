import type { PackageDescriptionCheck } from "./description-check.js";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import bz2 from "bz2";

import {
  parseDcf,
  parsePackageDependencies,
  requiredDcfField,
  validatePackageIdentity,
} from "./dcf.js";
import { readPackageSource } from "./source.js";
import type { PackageSourceFile } from "./source.js";
export { comparePackageSavedOutput } from "./saved-output.js";
export { inspectPackageLicense } from "./license-check.js";
export type { PackageLicenseAssessment } from "./license-check.js";
export { inspectPackageDescription } from "./description-check.js";
export type { PackageDescriptionAssessment, PackageDescriptionCheck } from "./description-check.js";
export { inspectPackageNamespaceSource, s3Consistent } from "./namespace-source-check.js";
export type {
  NamespaceSourceAssessment,
  NamespaceSourceCheck,
  NamespaceSourceInput,
} from "./namespace-source-check.js";
export {
  BASE_PRIORITY_PACKAGES,
  DEFAULT_INSTALLED_PACKAGES,
  inspectPackageSourceDependencies,
} from "./source-dependency-check.js";
export { collectPackageSourceDependencyInputs } from "./source-dependency-inputs.js";
export type { PackageSourceDependencyInputs } from "./source-dependency-inputs.js";
export type {
  PackageDependencySource,
  PackageDependencySourceRole,
  PackageDependencySourcePosition,
  PackageDependencySourceSpan,
  PackageDependencySourceParser,
  PackageSourceDependencyReason,
  PackageSourceDependencyLocation,
  PackageSourceDependencyReference,
  PackageSourceDependencyUnresolved,
  PackageSourceDependencyAssessment,
  PackageSourceDependencyOptions,
} from "./source-dependency-check.js";
export {
  comparePackageCheckObservation,
  createPackageCheckReport,
  PACKAGE_CHECK_STAGES,
} from "./check.js";
import {
  extractPackageExamples,
  extractPackageHelp,
  PACKAGE_EXAMPLES_RESOURCE_PATH,
  PACKAGE_HELP_RESOURCE_PATH,
} from "./rd-examples.js";
import { extractPackageVignettes, PACKAGE_VIGNETTES_RESOURCE_PATH } from "./vignettes.js";
import {
  PackageCompatibilityError,
  type NativRPackageArtifact,
  type PackageCompatibilityIssue,
  type PackageExampleRunOptions,
  type PackageExampleRunResult,
  type PackageExampleScript,
  type PackagePackLimits,
  type PackagePackOptions,
  type PackageTestRunOptions,
  type PackageTestRunResult,
  type PackageTestScript,
} from "./types.js";
export { comparePackageVersions, resolvePackageArtifacts } from "./resolve.js";
export { installPackagesFromRepository, preflightPackagesFromRepository } from "./repository.js";

export type {
  NativRPackageArtifact,
  PackageCompatibilityIssue,
  PackageCheckObservation,
  PackageCheckComparisonOptions,
  PackageCheckTransportAdaptation,
  PackageCheckAppliedAdaptation,
  PackageCheckDifference,
  PackageCheckComparison,
  PackageCheckStageId,
  PackageCheckStage,
  PackageCheckProvenance,
  PackageCheckEvidence,
  PackageCheckReport,
  PackageExampleRunOptions,
  PackageExampleRunResult,
  PackageExampleScript,
  PackageDependency,
  PackageDependencyKind,
  PackagePackLimits,
  PackagePackOptions,
  PackageSavedOutputComparison,
  PackageSavedOutputComparisonOptions,
  PackageTestRunOptions,
  PackageTestRunResult,
  PackageTestScript,
  PackagedPureRBundle,
  ResolvePackageOptions,
  ResolvedPackageSet,
  RepositoryInstallOptions,
  RepositoryInstallResult,
  RepositoryPreflightBlocker,
  RepositoryPreflightOptions,
  RepositoryPreflightResult,
} from "./types.js";
export { PackageCompatibilityError } from "./types.js";

export const DEFAULT_PACKAGE_PACK_LIMITS: PackagePackLimits = Object.freeze({
  maxFiles: 16_384,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 192 * 1024 * 1024,
  maxPathDepth: 32,
});

const INSTALL_HOOKS = new Set([
  "configure",
  "configure.win",
  "configure.ucrt",
  "cleanup",
  "cleanup.win",
  "cleanup.ucrt",
]);
const LEGAL_FILES = new Set(["LICENSE", "LICENCE", "COPYING", "NOTICE"]);
const SUPPORTED_NAMESPACE_DIRECTIVES = new Set([
  "export",
  "exportPattern",
  "exportMethods",
  "import",
  "importFrom",
  "S3method",
]);
const R_SOURCE_PATH = /^R\/(?:[^/]+\/)*[^/]+\.[Rr]$/u;
const PACKAGE_SOURCE_RESOURCE_ROOT = ".nativr/source";

/** Execute unchanged top-level tests/*.R scripts from a source package using a caller-owned R session. */
export async function runPackageTests(
  source: string | URL,
  evaluate: (script: PackageTestScript) => Promise<unknown>,
  options: PackageTestRunOptions = {},
): Promise<PackageTestRunResult> {
  const { files, sourceSha256, name, version, encoding } = await loadAuditedPackageSource(
    source,
    options,
  );

  const entrypoints = files
    .filter((file) => /^tests\/[^/]+\.[Rr]$/u.test(file.path))
    .sort((left, right) => compareCPath(left.path, right.path));
  const nestedRFiles = files
    .filter((file) => /^tests\/.+\/[^/]+\.[Rr]$/u.test(file.path))
    .map((file) => file.path)
    .sort(compareCPath);
  const savedOutputFiles = files.filter((file) => /^tests\/[^/]+\.Rout\.save$/iu.test(file.path));
  const outputExpectations = savedOutputFiles.map((file) => file.path).sort(compareCPath);
  const savedOutputByPath = new Map(
    savedOutputFiles.map((file) => [file.path.toLowerCase(), file] as const),
  );
  const paths = entrypoints.map((file) => file.path);
  if (options.paths !== undefined) {
    if (options.paths.length === 0 || new Set(options.paths).size !== options.paths.length) {
      throw new Error("Selected package-test paths must be non-empty and unique.");
    }
    for (const selected of options.paths) {
      if (!paths.includes(selected)) {
        throw new Error(`Package test '${selected}' is not a top-level tests/*.R entrypoint.`);
      }
    }
  }
  const selected =
    options.paths === undefined
      ? entrypoints
      : entrypoints.filter((file) => options.paths?.includes(file.path));
  const base = {
    package: { name, version },
    sourceSha256,
    entrypoints: paths,
    nestedRFiles,
    outputExpectations,
  };
  if (entrypoints.length === 0) {
    return {
      ...base,
      executed: [],
      outcome: nestedRFiles.length === 0 ? "no-tests" : "no-entrypoint",
      firstBlocker:
        nestedRFiles.length === 0
          ? null
          : {
              code: "no-entrypoint",
              message: "Package has nested R test files but no top-level tests/*.R entrypoint.",
            },
    };
  }

  const executed: { path: string; status: "completed" | "failed" }[] = [];
  for (const file of selected) {
    const savedOutput = savedOutputByPath.get(
      file.path.replace(/\.[Rr]$/u, ".Rout.save").toLowerCase(),
    );
    const script: PackageTestScript = {
      path: file.path,
      source: decodePackageText(file, "Package test", encoding),
      ...(savedOutput === undefined
        ? {}
        : {
            expectedOutput: {
              path: savedOutput.path,
              source: decodePackageText(savedOutput, "Package test output", encoding),
            },
          }),
    };
    try {
      await evaluate(script);
      executed.push({ path: file.path, status: "completed" });
    } catch (error) {
      executed.push({ path: file.path, status: "failed" });
      return {
        ...base,
        executed,
        outcome: "failed",
        firstBlocker: {
          code: "test-error",
          path: file.path,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  return {
    ...base,
    executed,
    outcome: selected.length === entrypoints.length ? "completed" : "partial",
    firstBlocker: null,
  };
}

/** Execute every default-applicable Rd example topic from an audited source package. */
export async function runPackageExamples(
  source: string | URL,
  evaluate: (script: PackageExampleScript) => Promise<unknown>,
  options: PackageExampleRunOptions = {},
): Promise<PackageExampleRunResult> {
  const { files, sourceSha256, name, version, encoding } = await loadAuditedPackageSource(
    source,
    options,
  );
  const topics = files
    .filter((file) => /^man\/(?:.*\/)?[^/]+\.Rd$/iu.test(file.path))
    .sort((left, right) => compareCPath(left.path, right.path))
    .flatMap((file) => {
      const extracted = extractPackageExamples([
        { path: file.path, source: decodePackageText(file, "Rd source", encoding) },
      ]);
      return (extracted?.topics ?? []).map((topic) => ({ path: file.path, topic }));
    });
  const entrypoints = topics.map(({ path, topic }) => ({
    path,
    topic: topic.name,
    applicableBlocks: topic.blocks.filter(
      (block) => block.kind === "run" && block.source.trim().length > 0,
    ).length,
    excludedDontrunBlocks: topic.blocks.filter(
      (block) => block.kind === "dontrun" && block.source.trim().length > 0,
    ).length,
    excludedDonttestBlocks: topic.blocks.filter(
      (block) => block.kind === "donttest" && block.source.trim().length > 0,
    ).length,
  }));
  const paths = entrypoints.map((entry) => entry.path);
  if (options.paths !== undefined) {
    if (options.paths.length === 0 || new Set(options.paths).size !== options.paths.length) {
      throw new Error("Selected package-example paths must be non-empty and unique.");
    }
    for (const selected of options.paths) {
      if (!paths.includes(selected)) {
        throw new Error(`Package example '${selected}' is not a man/*.Rd example entrypoint.`);
      }
    }
  }
  const selected =
    options.paths === undefined
      ? topics
      : topics.filter((entry) => options.paths?.includes(entry.path));
  const base = { package: { name, version }, sourceSha256, entrypoints };
  if (topics.length === 0) {
    return {
      ...base,
      executed: [],
      outcome: "no-examples",
      firstBlocker: {
        code: "no-examples",
        message: "Package has no indexed man/*.Rd example topics.",
      },
    };
  }
  if (
    !selected.some(({ topic }) =>
      topic.blocks.some((block) => block.kind === "run" && block.source.trim().length > 0),
    )
  ) {
    return {
      ...base,
      executed: [],
      outcome: "no-applicable",
      firstBlocker: {
        code: "no-applicable",
        message: "Selected example topics contain no default-applicable Rd code blocks.",
      },
    };
  }
  const executed: { path: string; topic: string; status: "completed" | "failed" }[] = [];
  for (const { path, topic } of selected) {
    const source = topic.blocks
      .filter((block) => block.kind === "run")
      .map((block) => block.source)
      .join("\n");
    if (source.trim().length === 0) continue;
    try {
      await evaluate({ path, topic: topic.name, source });
      executed.push({ path, topic: topic.name, status: "completed" });
    } catch (error) {
      executed.push({ path, topic: topic.name, status: "failed" });
      return {
        ...base,
        executed,
        outcome: "failed",
        firstBlocker: {
          code: "example-error",
          path,
          topic: topic.name,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  return {
    ...base,
    executed,
    outcome: selected.length === topics.length ? "completed" : "partial",
    firstBlocker: null,
  };
}

async function loadAuditedPackageSource(
  source: string | URL,
  options: {
    readonly limits?: Partial<PackagePackLimits>;
    readonly expectedSourceSha256?: string;
    readonly expectedPackage?: { readonly name: string; readonly version: string };
  },
): Promise<{
  readonly files: readonly PackageSourceFile[];
  readonly sourceSha256: string | null;
  readonly name: string;
  readonly version: string;
  readonly encoding: "utf-8" | "latin1";
}> {
  const limits = effectiveLimits(options.limits);
  const sourcePath = source instanceof URL ? fileURLToPath(source) : source;
  const sourceStat = await stat(sourcePath);
  let sourceSha256: string | null = null;
  if (sourceStat.isFile()) {
    if (sourceStat.size > limits.maxTotalBytes) {
      throw new Error("Package source archive exceeds the configured byte limit.");
    }
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(sourcePath)) hash.update(chunk as Uint8Array);
    sourceSha256 = hash.digest("hex");
  }
  if (options.expectedSourceSha256 !== undefined) {
    if (!/^[a-f0-9]{64}$/u.test(options.expectedSourceSha256)) {
      throw new Error("Expected package source SHA-256 must be a lowercase 64-digit hex digest.");
    }
    if (sourceSha256 !== options.expectedSourceSha256) {
      throw new Error(
        `Package source SHA-256 mismatch: expected ${options.expectedSourceSha256}, received ${sourceSha256 ?? "directory"}.`,
      );
    }
  }
  const files = await readPackageSource(source, limits);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const description = decodeDescription(requiredFile(byPath, "DESCRIPTION"));
  const name = requiredDcfField(description.fields, "Package");
  const version = requiredDcfField(description.fields, "Version");
  validatePackageIdentity(name, version);
  if (
    options.expectedPackage !== undefined &&
    (options.expectedPackage.name !== name || options.expectedPackage.version !== version)
  ) {
    throw new Error(
      `Package source identity ${name} ${version} does not match ${options.expectedPackage.name} ${options.expectedPackage.version}.`,
    );
  }
  return { files, sourceSha256, name, version, encoding: description.encoding };
}

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
  const namespace = decodePackageText(
    requiredFile(byPath, "NAMESPACE"),
    "NAMESPACE",
    decodedDescription.encoding,
  );
  const name = requiredDcfField(fields, "Package");
  const version = requiredDcfField(fields, "Version");
  validatePackageIdentity(name, version);
  const dependencies = parsePackageDependencies(fields);
  const issues: PackageCompatibilityIssue[] = [];
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
    const data = normalizeInstalledResource(file, limits);
    installedResourceBytes += data.byteLength;
    if (installedResourceBytes > limits.maxTotalBytes) {
      throw new Error(
        `Installed package resources exceed the ${limits.maxTotalBytes}-byte normalized limit.`,
      );
    }
    resources.push({ path: installedPath, data: Buffer.from(data).toString("base64") });
  }
  if (
    resources.some(
      (resource) =>
        resource.path === PACKAGE_SOURCE_RESOURCE_ROOT ||
        resource.path.startsWith(`${PACKAGE_SOURCE_RESOURCE_ROOT}/`),
    )
  ) {
    throw new Error(`Package resource path '${PACKAGE_SOURCE_RESOURCE_ROOT}' is reserved.`);
  }
  const sourceEvaluationResources = files
    .filter((file) => file.path.startsWith("tools/"))
    .map((file) => ({
      path: `${PACKAGE_SOURCE_RESOURCE_ROOT}/${file.path}`,
      data: Buffer.from(file.data).toString("base64"),
    }));
  resources.push(...sourceEvaluationResources);
  for (const reservedPath of [
    PACKAGE_EXAMPLES_RESOURCE_PATH,
    PACKAGE_HELP_RESOURCE_PATH,
    PACKAGE_VIGNETTES_RESOURCE_PATH,
  ]) {
    if (resources.some((resource) => resource.path === reservedPath)) {
      throw new Error(`Package resource path '${reservedPath}' is reserved.`);
    }
  }
  const examples = extractPackageExamples(
    files
      .filter((file) => /^man\/(?:.*\/)?[^/]+\.Rd$/iu.test(file.path))
      .map((file) => ({
        path: file.path,
        source: decodePackageText(file, "Rd source", decodedDescription.encoding),
      })),
  );
  let generatedPackageMetadata = false;
  if (examples !== undefined) {
    resources.push({
      path: PACKAGE_EXAMPLES_RESOURCE_PATH,
      data: Buffer.from(JSON.stringify(examples), "utf8").toString("base64"),
    });
    generatedPackageMetadata = true;
  }
  const help = extractPackageHelp(
    files
      .filter((file) => /^man\/(?:.*\/)?[^/]+\.Rd$/iu.test(file.path))
      .map((file) => ({
        path: file.path,
        source: decodePackageText(file, "Rd source", decodedDescription.encoding),
      })),
  );
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

function normalizeInstalledResource(
  file: PackageSourceFile,
  limits: PackagePackLimits,
): Uint8Array {
  const serializable = /^(?:R\/(?:.*\/)?sysdata|(?:data|demo)\/.*)\.(?:rda|rdata|rds)$/iu.test(
    file.path,
  );
  if (!serializable || file.data[0] !== 0x42 || file.data[1] !== 0x5a || file.data[2] !== 0x68) {
    return file.data;
  }
  let output: Uint8Array;
  try {
    output = bz2.decompress(file.data);
  } catch (error) {
    throw new Error(`Package resource '${file.path}' contains invalid bzip2 data.`, {
      cause: error,
    });
  }
  if (output.byteLength > limits.maxFileBytes) {
    throw new Error(
      `Package resource '${file.path}' expands beyond the ${limits.maxFileBytes}-byte normalized limit.`,
    );
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
        "error",
        "JVM code is unavailable in the browser runtime.",
        file.path,
      );
    }
    if (INSTALL_HOOKS.has(file.path)) {
      addIssue(
        issues,
        "NRPKG1003",
        "error",
        "Host installation hooks are not executed.",
        file.path,
      );
    }
    if (/^R\/(?:.*\/)?sysdata\.(?:rda|rdata)$/iu.test(file.path)) {
      addIssue(
        issues,
        "NRPKG1004",
        "warning",
        "Internal sysdata uses build-time bzip2 normalization when needed and the browser runtime's bounded GNU R serialization decoder; unsupported serialized value types and compression remain explicit.",
        file.path,
      );
    } else if (/^(?:data|demo)\/.*\.(?:rda|rdata|rds)$/iu.test(file.path)) {
      addIssue(
        issues,
        "NRPKG1005",
        "warning",
        "GNU R binary data uses build-time bzip2 normalization when needed and the bounded browser XDR/gzip decoder; unsupported compression or value types still fail explicitly.",
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

function skipBalancedCall(source: string, openingIndex: number): number {
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
    else if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error("NAMESPACE contains an unterminated declaration.");
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
  return LEGAL_FILES.has(sourcePath) ? sourcePath : undefined;
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

export interface PackageDependencyDeclarationAssessment {
  readonly policy:
    "namespace-declarations-v1" | "namespace-declarations-v2" | "namespace-declarations-v3";
  readonly imports: readonly string[];
  readonly missing: readonly string[];
  readonly checks: readonly PackageDescriptionCheck[];
  readonly limitations: readonly string[];
}

/** Static namespace declarations only; dynamic code references and transitive closure are separate. */
export function inspectPackageDependencyDeclarations(
  description: string,
  namespace: string,
): PackageDependencyDeclarationAssessment {
  const imports = new Set<string>();
  const limitations = [
    "Conditional namespaces, escaped package names, computed import controls, dynamic code references and transitive dependencies are not audited.",
  ];
  const id = "dependencies:namespace-declarations";
  try {
    const issues: PackageCompatibilityIssue[] = [];
    inspectNamespace(namespace, issues);
    if (issues.length > 0)
      throw new Error("NAMESPACE is outside the supported static declaration surface.");
    const source = stripNamespaceComments(namespace);
    let index = 0;
    while (index < source.length) {
      while (/\s/u.test(source[index] ?? "")) index++;
      if (index === source.length) break;
      const match = /^([A-Za-z][A-Za-z0-9.]*)\s*\(/u.exec(source.slice(index));
      if (match === null) throw new Error("Unsupported namespace declaration.");
      const opening = index + match[0].length - 1;
      const end = skipBalancedCall(source, opening);
      if (match[1] === "import" || match[1] === "importFrom") {
        const args = splitNamespaceDeclarationArguments(source.slice(opening + 1, end - 1));
        let hasExcept = false;
        for (const argument of match[1] === "importFrom" ? args.slice(0, 1) : args) {
          const named =
            /^\s*(?:([A-Za-z][A-Za-z0-9.]*)|"([A-Za-z][A-Za-z0-9.]*)"|'([A-Za-z][A-Za-z0-9.]*)'|`([A-Za-z][A-Za-z0-9.]*)`)\s*=\s*([^]*)$/u.exec(
              argument,
            );
          const value = named?.[5] ?? argument;
          if (
            match[1] === "import" &&
            !hasExcept &&
            (named?.[1] ?? named?.[2] ?? named?.[3] ?? named?.[4]) === "except"
          ) {
            hasExcept = true;
            const list = /^\s*c\(([^]*)\)\s*$/u.exec(value);
            const exclusions =
              list === null
                ? [value]
                : list[1]!.trim() === ""
                  ? []
                  : splitNamespaceDeclarationArguments(list[1]!);
            for (const exclusion of exclusions) namespaceDeclarationLiteral(exclusion, false);
          } else imports.add(namespaceDeclarationLiteral(value, true));
        }
      }
      index = end;
    }
    // Observable GNU R 4.6.1 installed.packages() Priority=base catalog.
    const declared = new Set([
      "base",
      "compiler",
      "datasets",
      "grDevices",
      "graphics",
      "grid",
      "methods",
      "parallel",
      "splines",
      "stats",
      "stats4",
      "tcltk",
      "tools",
      "utils",
    ]);
    for (const dependency of parsePackageDependencies(parseDcf(description)))
      if (dependency.kind === "Imports" || dependency.kind === "Depends")
        declared.add(dependency.name);
    const missing = [...imports].filter((name) => !declared.has(name)).sort(compareCPath);
    return {
      policy: "namespace-declarations-v3",
      imports: [...imports],
      missing,
      checks: [
        {
          id,
          status: missing.length === 0 ? "passed" : "failed",
          message:
            missing.length === 0
              ? "Namespace imports are declared in Imports/Depends or belong to base packages."
              : `Namespace dependencies missing from Imports/Depends: ${missing.join(", ")}`,
        },
      ],
      limitations,
    };
  } catch (error) {
    return {
      policy: "namespace-declarations-v3",
      imports: [...imports],
      missing: [],
      checks: [
        {
          id,
          status: "unexecuted",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      limitations,
    };
  }
}

function namespaceDeclarationLiteral(source: string, packageName: boolean): string {
  const text = source.trim();
  const quoted = /^(?:"([^"\\]*)"|'([^'\\]*)'|`([^`\\]*)`)$/u.exec(text);
  const value = quoted === null ? text : (quoted[1] ?? quoted[2] ?? quoted[3]!);
  if (
    (packageName && !/^[A-Za-z][A-Za-z0-9.]*$/u.test(value)) ||
    (!packageName && quoted === null && !/^[A-Za-z.][A-Za-z0-9._]*$/u.test(value))
  )
    throw new Error("Unsupported namespace import literal.");
  return value;
}

function splitNamespaceDeclarationArguments(source: string): readonly string[] {
  const args: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      args.push(source.slice(start, index));
      start = index + 1;
    }
    if (depth < 0) throw new Error("Malformed namespace argument.");
  }
  if (quote !== undefined || depth !== 0) throw new Error("Unterminated namespace argument.");
  args.push(source.slice(start));
  if (args.some((value) => value.trim() === "")) throw new Error("Empty namespace argument.");
  return args;
}
