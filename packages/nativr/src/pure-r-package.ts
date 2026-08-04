import type { ProgramNode } from "@nativr/ast";
import type { PureRPackageBundle } from "@nativr/protocol";
import { REvaluationError, RResourceLimitError, RUnsupportedFeatureError } from "@nativr/runtime";
import type {
  RuntimeLimits,
  RuntimePackageDefinition,
  RuntimePackageDependency,
  RuntimePackageImport,
  RuntimeS3Method,
} from "@nativr/runtime";

const PACKAGE_NAME = /^[A-Za-z](?:[A-Za-z0-9.]*[A-Za-z0-9])?$/u;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const NAMESPACE_DIRECTIVE = /([A-Za-z][A-Za-z0-9.]*)\s*\(([^()]*)\)/gu;
const MAX_PACKAGE_RESOURCE_BYTES = 64 * 1024 * 1024;

export function compilePureRPackages(
  bundles: readonly PureRPackageBundle[],
  parse: (source: string) => ProgramNode,
  limits: RuntimeLimits,
): readonly RuntimePackageDefinition[] {
  validateBundleBudget(bundles, limits);
  const names = new Set<string>();
  return bundles.map((bundle) => {
    const description = parseDescription(bundle.description);
    const name = requiredDescriptionField(description, "Package");
    const version = requiredDescriptionField(description, "Version");
    const resourceTextEncoding = packageTextEncoding(description.get("Encoding"), name);
    if (!PACKAGE_NAME.test(name)) {
      throw new REvaluationError("NRE2227", `Invalid package name '${name}' in DESCRIPTION.`);
    }
    if (names.has(name)) {
      throw new REvaluationError("NRE2220", `Package '${name}' was supplied more than once.`);
    }
    names.add(name);
    if (description.get("NeedsCompilation")?.trim().toLowerCase() === "yes") {
      throw new RUnsupportedFeatureError(
        "NRU6176",
        `Package '${name}' declares native compilation and is not a pure-R bundle.`,
      );
    }
    if ((description.get("LinkingTo") ?? "").trim().length > 0) {
      throw new RUnsupportedFeatureError(
        "NRU6176",
        `Package '${name}' declares LinkingTo and is not a source-only pure-R bundle.`,
      );
    }
    const namespace = parseNamespace(bundle.namespace, name);
    const dependencyRequirements = [
      ...parseDependencies(description.get("Depends")),
      ...parseDependencies(description.get("Imports")),
      ...namespace.imports.map<RuntimePackageDependency>((entry) => ({ package: entry.package })),
    ].filter((dependency) => dependency.package !== "R" && dependency.package !== name);
    const dependencies = Object.freeze(
      dependencyRequirements.filter(
        (dependency, index) =>
          dependencyRequirements.findIndex(
            (candidate) =>
              candidate.package === dependency.package &&
              candidate.constraint?.operator === dependency.constraint?.operator &&
              candidate.constraint?.version === dependency.constraint?.version,
          ) === index,
      ),
    );
    // Source order is semantic: package-tools has already applied DESCRIPTION Collate order.
    const sources = [...bundle.rSources];
    const seenPaths = new Set<string>();
    const programs = sources.map((entry) => {
      if (!isPackageSourcePath(entry.path) || seenPaths.has(entry.path)) {
        throw new REvaluationError(
          "NRE2228",
          `Package '${name}' contains invalid or duplicate source path '${entry.path}'.`,
        );
      }
      seenPaths.add(entry.path);
      return parse(entry.source);
    });
    const textResources = Object.freeze([
      Object.freeze({ path: "DESCRIPTION", text: bundle.description }),
      Object.freeze({ path: "NAMESPACE", text: bundle.namespace }),
      ...sources.map((entry) => Object.freeze({ path: entry.path, text: entry.source })),
    ]);
    const seenResourcePaths = new Set<string>();
    const resources = [...(bundle.resources ?? [])]
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map((resource) => {
        if (
          !isPackageResourcePath(resource.path) ||
          seenResourcePaths.has(resource.path) ||
          textResources.some((text) => text.path === resource.path)
        ) {
          throw new REvaluationError(
            "NRE2231",
            `Package '${name}' contains invalid or duplicate resource path '${resource.path}'.`,
          );
        }
        if (!isCanonicalBase64(resource.data)) {
          throw new REvaluationError(
            "NRE2232",
            `Package '${name}' resource '${resource.path}' is not canonical base64.`,
          );
        }
        seenResourcePaths.add(resource.path);
        return Object.freeze({ path: resource.path, data: resource.data });
      });
    return {
      name,
      version,
      descriptionFields: Object.freeze(
        [...description].map(([fieldName, value]) => Object.freeze({ name: fieldName, value })),
      ),
      resourceTextEncoding,
      dependencies,
      imports: namespace.imports,
      exports: namespace.exports,
      methodExports: namespace.methodExports,
      s3Methods: namespace.s3Methods,
      programs: Object.freeze(programs),
      textResources,
      resources: Object.freeze(resources),
    };
  });
}

function packageTextEncoding(value: string | undefined, packageName: string): "utf8" | "latin1" {
  if (value === undefined || /^utf-?8$/iu.test(value.trim())) return "utf8";
  if (/^latin-?1$/iu.test(value.trim())) return "latin1";
  throw new RUnsupportedFeatureError(
    "NRU6190",
    `Package '${packageName}' declares unsupported text encoding '${value}'.`,
  );
}

function isCanonicalBase64(value: string): boolean {
  if (!CANONICAL_BASE64.test(value)) return false;
  if (value.endsWith("==")) {
    return BASE64_ALPHABET.indexOf(value[value.length - 3] ?? "") % 16 === 0;
  }
  if (value.endsWith("=")) {
    return BASE64_ALPHABET.indexOf(value[value.length - 2] ?? "") % 4 === 0;
  }
  return true;
}

function isPackageSourcePath(value: string): boolean {
  if (!value.startsWith("R/") || !/\.[Rr]$/u.test(value) || value.includes("\\")) return false;
  const parts = value.split("/");
  return parts.every(
    (part) =>
      part.length > 0 &&
      part !== "." &&
      part !== ".." &&
      ![...part].some((character) => character.codePointAt(0)! <= 0x1f),
  );
}

function validateBundleBudget(bundles: readonly PureRPackageBundle[], limits: RuntimeLimits): void {
  let sourceCount = 0;
  let sourceUnits = 0;
  let resourceCount = 0;
  let resourceBytes = 0;
  for (const bundle of bundles) {
    sourceCount += bundle.rSources.length;
    sourceUnits += bundle.description.length + bundle.namespace.length;
    for (const entry of bundle.rSources) {
      sourceUnits += entry.path.length + entry.source.length;
    }
    for (const resource of bundle.resources ?? []) {
      resourceCount += 1;
      resourceBytes += resource.path.length + Math.ceil((resource.data.length * 3) / 4);
    }
    if (sourceCount > limits.maxVectorLength || sourceUnits > limits.maxVectorLength) {
      throw new RResourceLimitError("NRL4002", "Pure-R package bundle source limit exceeded.", {
        details: {
          maxSourceFiles: limits.maxVectorLength,
          maxSourceUnits: limits.maxVectorLength,
          sourceCount,
          sourceUnits,
        },
      });
    }
    if (
      resourceCount > limits.maxVectorLength ||
      !Number.isSafeInteger(resourceBytes) ||
      resourceBytes > MAX_PACKAGE_RESOURCE_BYTES
    ) {
      throw new RResourceLimitError("NRL4002", "Pure-R package resource limit exceeded.", {
        details: {
          maxResourceFiles: limits.maxVectorLength,
          maxResourceBytes: MAX_PACKAGE_RESOURCE_BYTES,
          resourceCount,
          resourceBytes,
        },
      });
    }
  }
}

function isPackageResourcePath(value: string): boolean {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    [...value].some((character) => character.codePointAt(0)! <= 0x1f)
  ) {
    return false;
  }
  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function parseDescription(source: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>();
  let current: string | undefined;
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    if (/^[ \t]/u.test(rawLine)) {
      if (current !== undefined) {
        fields.set(current, `${fields.get(current) ?? ""}\n${rawLine}`.trim());
      }
      continue;
    }
    if (rawLine.trim().length === 0) continue;
    const separator = rawLine.indexOf(":");
    if (separator <= 0) {
      throw new REvaluationError("NRE2229", "Malformed package DESCRIPTION field.");
    }
    current = rawLine.slice(0, separator).trim();
    fields.set(current, rawLine.slice(separator + 1).trim());
  }
  return fields;
}

function requiredDescriptionField(fields: ReadonlyMap<string, string>, name: string): string {
  const value = fields.get(name)?.trim();
  if (value === undefined || value.length === 0) {
    throw new REvaluationError("NRE2229", `Package DESCRIPTION is missing '${name}'.`);
  }
  return value;
}

function parseDependencies(value: string | undefined): readonly RuntimePackageDependency[] {
  if (value === undefined || value.trim().length === 0) return [];
  return value.split(",").map((entry) => {
    const match =
      /^([A-Za-z][A-Za-z0-9.]*)(?:\s*\(\s*(>=|<=|==|>|<|!=)\s*([0-9]+(?:[.-][0-9]+)*)\s*\))?$/u.exec(
        entry.trim(),
      );
    if (match?.[1] === undefined) {
      throw new REvaluationError("NRE2229", `Malformed package dependency '${entry.trim()}'.`);
    }
    const operator = match[2] as ">=" | "<=" | "==" | ">" | "<" | "!=" | undefined;
    const version = match[3];
    return {
      package: match[1],
      ...(operator === undefined || version === undefined
        ? {}
        : { constraint: { operator, version } }),
    };
  });
}

function parseNamespace(
  source: string,
  packageName: string,
): {
  readonly imports: readonly RuntimePackageImport[];
  readonly exports: readonly string[];
  readonly methodExports: readonly string[];
  readonly s3Methods: readonly RuntimeS3Method[];
} {
  const normalized = stripNamespaceComments(source);
  const imports = new Map<string, Set<string> | undefined>();
  const exports: string[] = [];
  const methodExports: string[] = [];
  const s3Methods: RuntimeS3Method[] = [];
  let consumed = "";
  let lastIndex = 0;
  for (const directive of normalized.matchAll(NAMESPACE_DIRECTIVE)) {
    const index = directive.index;
    consumed += normalized.slice(lastIndex, index).replace(/\s+/gu, "");
    lastIndex = index + directive[0].length;
    const name = directive[1] ?? "";
    const arguments_ = parseNamespaceArguments(directive[2] ?? "", packageName);
    switch (name) {
      case "export":
        exports.push(...arguments_);
        break;
      case "exportMethods":
        methodExports.push(...arguments_);
        break;
      case "import":
        for (const dependency of arguments_) imports.set(dependency, undefined);
        break;
      case "importFrom": {
        const dependency = arguments_[0];
        if (dependency === undefined || arguments_.length < 2) {
          throw namespaceError(packageName, "importFrom requires a package and bindings");
        }
        const existing = imports.get(dependency);
        if (existing !== undefined || !imports.has(dependency)) {
          const selected = existing ?? new Set<string>();
          for (const imported of arguments_.slice(1)) selected.add(imported);
          imports.set(dependency, selected);
        }
        break;
      }
      case "S3method": {
        const qualifiedGeneric = arguments_[0];
        const className = arguments_[1];
        if (qualifiedGeneric === undefined || className === undefined || arguments_.length > 3) {
          throw namespaceError(packageName, "S3method requires a generic and class");
        }
        const separator = qualifiedGeneric.indexOf("::");
        const genericPackage = separator < 0 ? undefined : qualifiedGeneric.slice(0, separator);
        const separatorLength = qualifiedGeneric.startsWith(":::", separator) ? 3 : 2;
        const generic =
          separator < 0 ? qualifiedGeneric : qualifiedGeneric.slice(separator + separatorLength);
        if (
          generic.length === 0 ||
          (genericPackage !== undefined && !PACKAGE_NAME.test(genericPackage))
        ) {
          throw namespaceError(packageName, "S3method contains an invalid qualified generic");
        }
        s3Methods.push({
          generic,
          ...(genericPackage === undefined ? {} : { genericPackage }),
          class: className,
          method: arguments_[2] ?? `${generic}.${className}`,
        });
        break;
      }
      case "useDynLib":
        throw new RUnsupportedFeatureError(
          "NRU6176",
          `Package '${packageName}' NAMESPACE requests a native library.`,
        );
      default:
        throw new RUnsupportedFeatureError(
          "NRU6177",
          `Package '${packageName}' NAMESPACE directive '${name}' is not implemented.`,
        );
    }
  }
  consumed += normalized.slice(lastIndex).replace(/\s+/gu, "");
  if (consumed.length > 0) {
    throw namespaceError(packageName, "contains malformed or conditional declarations");
  }
  return {
    imports: Object.freeze(
      [...imports].map(([package_, names]) => ({
        package: package_,
        ...(names === undefined ? {} : { names: Object.freeze([...names]) }),
      })),
    ),
    exports: Object.freeze([...new Set(exports)]),
    methodExports: Object.freeze([...new Set(methodExports)]),
    s3Methods: Object.freeze(s3Methods),
  };
}

function parseNamespaceArguments(source: string, packageName: string): readonly string[] {
  if (source.trim().length === 0) return [];
  return source.split(",").map((entry) => {
    const value = entry.trim().replace(/^(?:"([^"]*)"|'([^']*)'|`([^`]*)`)$/u, "$1$2$3");
    if (value.length === 0 || /\s/u.test(value)) {
      throw namespaceError(packageName, `contains invalid argument '${entry.trim()}'`);
    }
    return value;
  });
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
        } else if (character === '"' || character === "'" || character === "`") {
          quote = character;
        } else if (character === "#") {
          return line.slice(0, index);
        }
      }
      return line;
    })
    .join("\n");
}

function namespaceError(packageName: string, detail: string): REvaluationError {
  return new REvaluationError("NRE2230", `Package '${packageName}' NAMESPACE ${detail}.`);
}
