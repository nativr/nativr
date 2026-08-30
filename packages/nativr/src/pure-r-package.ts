import type { ProgramNode } from "@nativr/ast";
import type { PureRPackageBundle } from "@nativr/protocol";
import {
  isCanonicalBase64,
  REvaluationError,
  RResourceLimitError,
  RUnsupportedFeatureError,
} from "@nativr/runtime";
import type {
  RuntimeLimits,
  RuntimePackageDefinition,
  RuntimePackageDependency,
  RuntimePackageImport,
  RuntimeS3Method,
} from "@nativr/runtime";

const PACKAGE_NAME = /^[A-Za-z](?:[A-Za-z0-9.]*[A-Za-z0-9])?$/u;
const PACKAGE_DATASETS_RESOURCE_PATH = ".nativr/datasets-v1.json";
const PACKAGE_DATA_RESOURCE = /^data\/([^/]+)\.(?:r|rdata|rda|tab|txt|csv)(?:\.gz)?$/iu;

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
      ...parseDependencies(description.get("Depends"), "Depends"),
      ...parseDependencies(description.get("Imports"), "Imports"),
      ...namespace.imports.map<RuntimePackageDependency>((entry) => ({
        package: entry.package,
        kind: "Imports",
      })),
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
    const datasets = parsePackageDatasets(resources, name);
    return {
      name,
      version,
      lazyData: descriptionLogicalFlag(description.get("LazyData"), "LazyData", name),
      descriptionFields: Object.freeze(
        [...description].map(([fieldName, value]) => Object.freeze({ name: fieldName, value })),
      ),
      resourceTextEncoding,
      dependencies,
      imports: namespace.imports,
      exports: namespace.exports,
      exportPatterns: namespace.exportPatterns,
      classExports: namespace.classExports,
      methodExports: namespace.methodExports,
      s3Methods: namespace.s3Methods,
      programs: Object.freeze(programs),
      textResources,
      resources: Object.freeze(resources),
      ...(datasets.length === 0 ? {} : { datasets }),
    };
  });
}

function parsePackageDatasets(
  resources: readonly { readonly path: string; readonly data: string }[],
  packageName: string,
): readonly { readonly name: string; readonly resource: string }[] {
  const manifest = resources.find((resource) => resource.path === PACKAGE_DATASETS_RESOURCE_PATH);
  if (manifest === undefined) return [];
  let value: unknown;
  try {
    const binary = globalThis.atob(manifest.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    throw new REvaluationError(
      "NRE2231",
      `Package '${packageName}' contains a malformed LazyData manifest.`,
      { cause: error },
    );
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("format" in value) ||
    value.format !== "nativr-package-datasets" ||
    !("formatVersion" in value) ||
    value.formatVersion !== 1 ||
    !("datasets" in value) ||
    !Array.isArray(value.datasets)
  ) {
    throw new REvaluationError(
      "NRE2231",
      `Package '${packageName}' contains an invalid LazyData manifest.`,
    );
  }
  const availableResources = new Set(
    resources.flatMap((resource) => {
      const basename = PACKAGE_DATA_RESOURCE.exec(resource.path)?.[1];
      return basename === undefined ? [] : [basename];
    }),
  );
  const names = new Set<string>();
  const datasets = value.datasets.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("name" in entry) ||
      typeof entry.name !== "string" ||
      entry.name.length === 0 ||
      entry.name.includes("/") ||
      entry.name.includes("\\") ||
      !("resource" in entry) ||
      typeof entry.resource !== "string" ||
      !availableResources.has(entry.resource) ||
      names.has(entry.name)
    ) {
      throw new REvaluationError(
        "NRE2231",
        `Package '${packageName}' contains an invalid LazyData manifest entry.`,
      );
    }
    names.add(entry.name);
    return Object.freeze({ name: entry.name, resource: entry.resource });
  });
  return Object.freeze(datasets);
}

function descriptionLogicalFlag(
  value: string | undefined,
  field: string,
  packageName: string,
): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true") return true;
  if (normalized === "no" || normalized === "false") return false;
  throw new REvaluationError(
    "NRE2229",
    `Package '${packageName}' DESCRIPTION has invalid ${field} value '${value.trim()}'.`,
  );
}

function packageTextEncoding(value: string | undefined, packageName: string): "utf8" | "latin1" {
  if (value === undefined || /^utf-?8$/iu.test(value.trim())) return "utf8";
  if (/^latin-?1$/iu.test(value.trim())) return "latin1";
  throw new RUnsupportedFeatureError(
    "NRU6190",
    `Package '${packageName}' declares unsupported text encoding '${value}'.`,
  );
}

function isPackageSourcePath(value: string): boolean {
  if (!value.startsWith("R/") || !/\.[RSqrs]$/u.test(value) || value.includes("\\")) return false;
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
      resourceBytes > limits.maxPackageResourceBytes
    ) {
      throw new RResourceLimitError("NRL4002", "Pure-R package resource limit exceeded.", {
        details: {
          maxResourceFiles: limits.maxVectorLength,
          maxResourceBytes: limits.maxPackageResourceBytes,
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

function parseDependencies(
  value: string | undefined,
  kind: "Depends" | "Imports",
): readonly RuntimePackageDependency[] {
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
      kind,
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
  readonly exportPatterns: readonly string[];
  readonly classExports: readonly string[];
  readonly methodExports: readonly string[];
  readonly s3Methods: readonly RuntimeS3Method[];
} {
  const normalized = stripNamespaceComments(source);
  const imports = new Map<string, Set<string> | undefined>();
  const methodImports = new Map<string, Set<string>>();
  const exports: string[] = [];
  const exportPatterns: string[] = [];
  const classExports: string[] = [];
  const methodExports: string[] = [];
  const s3Methods: RuntimeS3Method[] = [];
  for (const directive of scanNamespaceDirectives(normalized, packageName)) {
    const name = directive.name;
    const arguments_ =
      name === "exportPattern"
        ? [parseNamespacePattern(directive.argumentsSource, packageName)]
        : parseNamespaceArguments(directive.argumentsSource, packageName);
    switch (name) {
      case "export":
        exports.push(...arguments_);
        break;
      case "exportPattern":
        if (arguments_.length !== 1) {
          throw namespaceError(packageName, "exportPattern requires exactly one pattern");
        }
        exportPatterns.push(arguments_[0] ?? "");
        break;
      case "exportClasses":
        classExports.push(...arguments_);
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
      case "importMethodsFrom": {
        const dependency = arguments_[0];
        if (dependency === undefined || arguments_.length < 2) {
          throw namespaceError(packageName, "importMethodsFrom requires a package and methods");
        }
        const selected = methodImports.get(dependency) ?? new Set<string>();
        for (const imported of arguments_.slice(1)) selected.add(imported);
        methodImports.set(dependency, selected);
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
        const generic = unquoteNamespaceSymbol(
          separator < 0 ? qualifiedGeneric : qualifiedGeneric.slice(separator + separatorLength),
        );
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
  return {
    imports: Object.freeze(
      [...new Set([...imports.keys(), ...methodImports.keys()])].map((package_) => {
        const hasBindingImport = imports.has(package_);
        const names = imports.get(package_);
        const methodNames = methodImports.get(package_);
        return {
          package: package_,
          ...(!hasBindingImport
            ? { names: Object.freeze([]) }
            : names === undefined
              ? {}
              : { names: Object.freeze([...names]) }),
          ...(methodNames === undefined ? {} : { methodNames: Object.freeze([...methodNames]) }),
        };
      }),
    ),
    exports: Object.freeze([...new Set(exports)]),
    exportPatterns: Object.freeze([...new Set(exportPatterns)]),
    classExports: Object.freeze([...new Set(classExports)]),
    methodExports: Object.freeze([...new Set(methodExports)]),
    s3Methods: Object.freeze(s3Methods),
  };
}

function scanNamespaceDirectives(
  source: string,
  packageName: string,
): readonly { readonly name: string; readonly argumentsSource: string }[] {
  const directives: { name: string; argumentsSource: string }[] = [];
  let index = 0;
  while (index < source.length) {
    while (/\s/u.test(source[index] ?? "")) index += 1;
    if (index >= source.length) break;
    const nameMatch = /^[A-Za-z][A-Za-z0-9.]*/u.exec(source.slice(index));
    const name = nameMatch?.[0];
    if (name === undefined) {
      throw namespaceError(packageName, "contains malformed or conditional declarations");
    }
    index += name.length;
    while (/\s/u.test(source[index] ?? "")) index += 1;
    if (source[index] !== "(") {
      throw namespaceError(packageName, `declaration '${name}' is malformed`);
    }
    const openingIndex = index;
    let depth = 0;
    let quote: string | undefined;
    let escaped = false;
    let closingIndex: number | undefined;
    for (; index < source.length; index += 1) {
      const character = source[index] ?? "";
      if (quote !== undefined) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          closingIndex = index;
          index += 1;
          break;
        }
      }
    }
    if (closingIndex === undefined || quote !== undefined || depth !== 0) {
      throw namespaceError(packageName, `declaration '${name}' is malformed`);
    }
    directives.push({
      name,
      argumentsSource: source.slice(openingIndex + 1, closingIndex),
    });
  }
  return directives;
}

function parseNamespacePattern(source: string, packageName: string): string {
  const literal = source.trim();
  const quote = literal[0];
  if (
    literal.length < 2 ||
    (quote !== '"' && quote !== "'") ||
    literal[literal.length - 1] !== quote
  ) {
    throw namespaceError(packageName, "exportPattern requires one quoted regular expression");
  }
  let output = "";
  for (let index = 1; index < literal.length - 1; index += 1) {
    const character = literal[index] ?? "";
    if (character !== "\\") {
      if (character === quote) {
        throw namespaceError(packageName, "exportPattern contains an unescaped quote");
      }
      output += character;
      continue;
    }
    index += 1;
    const escaped = literal[index];
    if (escaped === undefined || index >= literal.length - 1) {
      throw namespaceError(packageName, "exportPattern ends with an incomplete escape");
    }
    const decoded = new Map([
      ["a", "\u0007"],
      ["b", "\b"],
      ["f", "\f"],
      ["n", "\n"],
      ["r", "\r"],
      ["t", "\t"],
      ["v", "\u000b"],
      ["\\", "\\"],
      [quote, quote],
    ]).get(escaped);
    if (decoded === undefined) {
      throw namespaceError(packageName, `exportPattern contains unsupported escape '\\${escaped}'`);
    }
    output += decoded;
  }
  return output;
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

function unquoteNamespaceSymbol(value: string): string {
  if (value.length < 2) return value;
  const quote = value[0];
  return (quote === "`" || quote === "'" || quote === '"') && value.at(-1) === quote
    ? value.slice(1, -1)
    : value;
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
