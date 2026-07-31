import { createHash } from "node:crypto";

import {
  parseDcf,
  parsePackageDependencies,
  requiredDcfField,
  validatePackageIdentity,
} from "./dcf.js";
import { readPackageSource } from "./source.js";
import type { PackageSourceFile } from "./source.js";
import {
  PackageCompatibilityError,
  type NativRPackageArtifact,
  type PackageCompatibilityIssue,
  type PackagePackLimits,
  type PackagePackOptions,
} from "./types.js";
export { comparePackageVersions, resolvePackageArtifacts } from "./resolve.js";
export { installPackagesFromRepository } from "./repository.js";

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
export { PackageCompatibilityError } from "./types.js";

export const DEFAULT_PACKAGE_PACK_LIMITS: PackagePackLimits = Object.freeze({
  maxFiles: 4_096,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
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
const SUPPORTED_NAMESPACE_DIRECTIVES = new Set(["export", "import", "importFrom", "S3method"]);
const R_SOURCE_PATH = /^R\/(?:[^/]+\/)*[^/]+\.[Rr]$/u;

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
  const resources = files.flatMap((file) => {
    const installedPath = installedResourcePath(file.path);
    return installedPath === undefined
      ? []
      : [{ path: installedPath, data: Buffer.from(file.data).toString("base64") }];
  });
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
        "error",
        "Internal lazy-data archives require a future audited data converter.",
        file.path,
      );
    } else if (/^(?:data|demo)\/.*\.(?:rda|rdata|rds)$/iu.test(file.path)) {
      addIssue(
        issues,
        "NRPKG1005",
        "warning",
        "GNU R binary data is preserved but not yet decoded by NativR.",
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
