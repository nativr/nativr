import { createHash } from "node:crypto";
import { parseDcf, parsePackageDependencies } from "./dcf.js";
import type { PackageDependencyKind } from "./types.js";

export type PackageDependencySourceRole = "package" | "test" | "example";
export interface PackageDependencySource {
  readonly path: string;
  readonly source: string;
  readonly role?: PackageDependencySourceRole;
}
export interface PackageDependencySourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}
export interface PackageDependencySourceSpan {
  readonly start: PackageDependencySourcePosition;
  readonly end: PackageDependencySourcePosition;
}
/** Structural injection keeps the standalone packager independent of parser/Wasm packages. */
export type PackageDependencySourceParser = (source: string) => {
  readonly ast: unknown;
  readonly diagnostics: readonly { readonly severity: string }[];
};
export type PackageSourceDependencyReason =
  | "base-package"
  | "declared-package"
  | "undeclared-package"
  | "self-reference"
  | "unverified-source-role"
  | "invalid-description"
  | "invalid-package-literal"
  | "computed-package"
  | "computed-character-only"
  | "ambiguous-arguments"
  | "quoted-syntax"
  | "shadowed-binding"
  | "computed-callee"
  | "dynamic-evaluation"
  | "outside-static-scope"
  | "uninstalled-test-reference"
  | "unsupported-ast"
  | "parse-diagnostics"
  | "parse-failed"
  | "ast-limit";
export interface PackageSourceDependencyLocation {
  readonly path: string;
  readonly role: PackageDependencySourceRole;
  readonly span?: PackageDependencySourceSpan;
}
export interface PackageSourceDependencyReference extends PackageSourceDependencyLocation {
  readonly kind: "::" | ":::" | "library" | "require" | "requireNamespace";
  readonly package: string | null;
  readonly declaredIn: readonly PackageDependencyKind[];
  readonly status: "passed" | "failed" | "unexecuted";
  readonly reason: PackageSourceDependencyReason;
}
export interface PackageSourceDependencyUnresolved extends PackageSourceDependencyLocation {
  readonly reason: PackageSourceDependencyReason;
}
export interface PackageSourceDependencyAssessment {
  readonly schemaVersion: 1;
  readonly policy: "literal-source-references-v2";
  /** Passed only when every finding was classified; closure is checked separately. */
  readonly status: "passed" | "failed" | "unexecuted";
  readonly descriptionSha256: string;
  readonly files: readonly {
    readonly path: string;
    readonly role: PackageDependencySourceRole;
    readonly sha256: string;
    readonly status: "passed" | "unexecuted";
  }[];
  readonly references: readonly PackageSourceDependencyReference[];
  readonly unresolved: readonly PackageSourceDependencyUnresolved[];
  readonly checks: readonly {
    readonly id: string;
    readonly status: "passed" | "failed" | "unexecuted";
    readonly reason: PackageSourceDependencyReason;
  }[];
  readonly limitations: readonly string[];
}

export interface PackageSourceDependencyOptions {
  /**
   * Packages treated as installed for test-role references. The default is the base and
   * recommended packages of GNU R 4.6.1; callers add the bundle's packed closure (RFC-0008).
   */
  readonly installed?: ReadonlySet<string>;
}

type Node = Record<string, unknown> & { kind: string };
type Loader = "library" | "require" | "requireNamespace";
type Argument = { name?: string; value: unknown };
const packageName = /^[A-Za-z](?:[A-Za-z0-9.]*[A-Za-z0-9])?$/u;
// Independently observed Priority=base metadata in the pinned GNU R 4.6.1 oracle.
const basePackages: ReadonlySet<string> = new Set([
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
// Priority=recommended packages of GNU R 4.6.1 (R Installation and Administration).
const recommendedPackages = new Set([
  "boot",
  "class",
  "cluster",
  "codetools",
  "foreign",
  "KernSmooth",
  "lattice",
  "MASS",
  "Matrix",
  "mgcv",
  "nlme",
  "nnet",
  "rpart",
  "spatial",
  "survival",
]);
/** Priority=base packages of GNU R 4.6.1; they depend only on each other. */
export const BASE_PRIORITY_PACKAGES: ReadonlySet<string> = basePackages;
/** Base and recommended packages: the default installed set for test-role references. */
export const DEFAULT_INSTALLED_PACKAGES: ReadonlySet<string> = new Set([
  ...basePackages,
  ...recommendedPackages,
]);
// Inert placeholders that cannot contain package references (x[, 1] and ...).
const inertFeatures = new Set(["missing argument", "dots"]);
const loaders = new Set<string>(["library", "require", "requireNamespace"]);
const dynamicCalls = new Set([
  "eval",
  "evalq",
  "parse",
  "do.call",
  "get",
  "getExportedValue",
  "getFromNamespace",
  "as.call",
  "str2lang",
  "str2expression",
  "loadNamespace",
  "getNamespace",
]);
const maxNodesPerFile = 100_000;

/**
 * Independent literal-reference assessment using caller-owned normalized syntax only.
 * Scope: https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Checking-packages
 * Policy v2 (RFC-0008) follows native GNU R 4.6.1 `R CMD check` outcomes on independently
 * authored fixture packages: quoted syntax is scanned; dynamic and computed forms are outside the
 * static check; examples report undeclared packages; tests report only installed ones.
 * No source expression, parser diagnostic text, or implementation body is returned.
 */
export function inspectPackageSourceDependencies(
  description: string,
  sources: readonly PackageDependencySource[],
  parse: PackageDependencySourceParser,
  options: PackageSourceDependencyOptions = {},
): PackageSourceDependencyAssessment {
  const installed = options.installed ?? DEFAULT_INSTALLED_PACKAGES;
  const outsideScope: PackageSourceDependencyUnresolved[] = [];
  const references: PackageSourceDependencyReference[] = [];
  const unresolved: PackageSourceDependencyUnresolved[] = [];
  const files: PackageSourceDependencyAssessment["files"][number][] = [];
  const declarations = new Map<string, PackageDependencyKind[]>();
  let ownPackage: string | undefined;
  let validDescription = true;
  try {
    const fields = parseDcf(description);
    ownPackage = fields.get("Package");
    for (const dependency of parsePackageDependencies(fields)) {
      const kinds = declarations.get(dependency.name) ?? [];
      if (!kinds.includes(dependency.kind)) kinds.push(dependency.kind);
      declarations.set(dependency.name, kinds);
    }
  } catch {
    validDescription = false;
  }

  const parsedSources = sources.map((source) => {
    try {
      const result = parse(source.source);
      return {
        source,
        ast: result.ast,
        reason: result.diagnostics.some((diagnostic) => diagnostic.severity !== "info")
          ? ("parse-diagnostics" as const)
          : undefined,
      };
    } catch {
      return { source, ast: undefined, reason: "parse-failed" as const };
    }
  });
  // Package files share bindings. Deliberately overapproximate scope, including
  // function parameters: conservative unresolved findings avoid false violations.
  const bindings = new Set<string>();
  let bindingLimit = false;
  for (const parsed of parsedSources) {
    const bindingStack: unknown[] = parsed.ast === undefined ? [] : [parsed.ast];
    const bindingSeen = new Set<unknown>();
    while (bindingStack.length > 0 && bindingSeen.size < maxNodesPerFile) {
      const value = bindingStack.pop();
      if (bindingSeen.has(value)) continue;
      bindingSeen.add(value);
      const node = asNode(value);
      if (node === undefined) continue;
      if (node.kind === "AssignmentExpression") {
        const name = identifier(node.target);
        if (name !== undefined) bindings.add(name);
      }
      if (node.kind === "ForExpression") {
        const name = identifier(node.variable);
        if (name !== undefined) bindings.add(name);
      }
      if (node.kind === "FunctionExpression") {
        let parameterCount = 0;
        for (const parameter of recordItems(node.parameters)) {
          if (parameterCount++ >= maxNodesPerFile) {
            bindingLimit = true;
            break;
          }
          if (typeof parameter.name === "string") bindings.add(parameter.name);
        }
      }
      for (const child of children(node)) {
        if (bindingStack.length + bindingSeen.size >= maxNodesPerFile) {
          bindingLimit = true;
          break;
        }
        bindingStack.push(child);
      }
    }
    if (bindingStack.length > 0) bindingLimit = true;
  }
  for (const parsed of parsedSources) {
    const { source, ast } = parsed;
    const role = source.role ?? "package";
    const location = (value?: unknown): PackageSourceDependencyLocation => {
      const span = sourceSpan(asNode(value)?.span, source.source.length);
      return { path: source.path, role, ...(span === undefined ? {} : { span }) };
    };
    const startUnresolved = unresolved.length;
    const addUnresolved = (reason: PackageSourceDependencyReason, value?: unknown): void => {
      unresolved.push({ ...location(value), reason });
    };
    const addReference = (
      value: Node,
      kind: PackageSourceDependencyReference["kind"],
      target: string | undefined,
      uncertain?: PackageSourceDependencyReason,
    ): void => {
      const validTarget = target !== undefined && packageName.test(target) ? target : undefined;
      const declaredIn = validTarget === undefined ? [] : (declarations.get(validTarget) ?? []);
      let reason = uncertain;
      let status: PackageSourceDependencyReference["status"] = "unexecuted";
      if (reason === undefined && target !== undefined && validTarget === undefined)
        reason = "invalid-package-literal";
      if (reason === undefined && validTarget === undefined) reason = "computed-package";
      if (reason === undefined && !validDescription) reason = "invalid-description";
      if (reason === undefined && validTarget === ownPackage) {
        reason = "self-reference";
        status = "passed";
      }
      if (reason === undefined && validTarget !== undefined) {
        // In package code, attaching an Imports-only package is reported as undeclared.
        const attachRestricted = role === "package" && (kind === "library" || kind === "require");
        if (basePackages.has(validTarget)) {
          reason = "base-package";
          status = "passed";
        } else if (
          declaredIn.some(
            (field) =>
              field === "Depends" ||
              field === "Suggests" ||
              field === "Enhances" ||
              (field === "Imports" && !attachRestricted),
          )
        ) {
          reason = "declared-package";
          status = "passed";
        } else if (role === "test" && !installed.has(validTarget)) {
          reason = "uninstalled-test-reference";
          status = "passed";
        } else {
          reason = "undeclared-package";
          status = "failed";
        }
      }
      const finalReason = reason ?? "computed-package";
      references.push({
        ...location(value),
        kind,
        package: validTarget ?? null,
        declaredIn: [...declaredIn],
        status,
        reason: finalReason,
      });
      if (status === "unexecuted") addUnresolved(finalReason, value);
    };
    if (parsed.reason !== undefined) addUnresolved(parsed.reason);
    if (bindingLimit) addUnresolved("ast-limit");
    if (!validDescription) addUnresolved("invalid-description");
    const work: unknown[] = ast === undefined ? [] : [ast];
    const seen = new Set<unknown>();
    while (work.length > 0) {
      if (seen.size >= maxNodesPerFile) {
        addUnresolved("ast-limit");
        break;
      }
      const entry = work.pop();
      if (seen.has(entry)) {
        addUnresolved("unsupported-ast");
        continue;
      }
      seen.add(entry);
      const node = asNode(entry);
      if (node === undefined) {
        addUnresolved("unsupported-ast");
        continue;
      }
      // Native checks scan quoted syntax like other code, so quoting adds no uncertainty.
      const uncertain =
        parsed.reason !== undefined ? parsed.reason : bindingLimit ? "ast-limit" : undefined;
      if (node.kind === "NamespaceExpression") {
        if (node.operator === "::" || node.operator === ":::")
          addReference(
            node,
            node.operator,
            literalName(node.namespace),
            uncertain ?? (bindings.has(node.operator) ? "shadowed-binding" : undefined),
          );
        else addUnresolved("unsupported-ast", node);
      } else if (node.kind === "CallExpression") {
        const callee = asNode(node.callee);
        const directName = identifier(callee);
        const qualifiedName =
          callee?.kind === "NamespaceExpression" && literalName(callee.namespace) === "base"
            ? literalName(callee.member)
            : undefined;
        const name = directName ?? qualifiedName;
        if (name !== undefined && loaders.has(name)) {
          const loader = name as Loader;
          const matched = loaderArguments(loader, node.arguments);
          const masked = directName !== undefined && bindings.has(directName);
          const namespaceMasked =
            qualifiedName !== undefined &&
            callee !== undefined &&
            typeof callee.operator === "string" &&
            bindings.has(callee.operator);
          const control = matched.characterOnly;
          const targetNode = asNode(matched.package);
          const computedControl =
            control !== undefined &&
            !(
              asNode(control)?.kind === "LogicalLiteral" &&
              typeof asNode(control)?.value === "boolean"
            );
          const characterOnly = asNode(control)?.value === true;
          const target =
            targetNode?.kind === "StringLiteral" && typeof targetNode.value === "string"
              ? targetNode.value
              : loader !== "requireNamespace" && !characterOnly && !computedControl
                ? identifier(targetNode)
                : undefined;
          addReference(
            node,
            loader,
            target,
            uncertain ??
              (masked || namespaceMasked ? "shadowed-binding" : undefined) ??
              (matched.ambiguous ? "ambiguous-arguments" : undefined) ??
              (computedControl ? "computed-character-only" : undefined),
          );
        } else if (
          (name !== undefined && dynamicCalls.has(name)) ||
          callee === undefined ||
          (callee.kind !== "Identifier" && callee.kind !== "NamespaceExpression")
        ) {
          // Dynamic evaluation and computed callees are outside the native static check.
          if (uncertain === undefined)
            outsideScope.push({ ...location(node), reason: "outside-static-scope" });
          else addUnresolved(uncertain, node);
        }
      } else if (
        node.kind === "UnsupportedExpression" &&
        typeof node.feature === "string" &&
        inertFeatures.has(node.feature)
      ) {
        // Inert placeholder syntax.
      } else if (
        node.kind === "UnsupportedExpression" ||
        node.kind === "ConstantExpression" ||
        !knownKinds.has(node.kind)
      )
        addUnresolved("unsupported-ast", node);
      const childNodes: unknown[] = [];
      for (const child of children(node)) {
        if (childNodes.length + seen.size + work.length >= maxNodesPerFile) {
          addUnresolved("ast-limit", node);
          break;
        }
        childNodes.push(child);
      }
      for (let index = childNodes.length - 1; index >= 0; index -= 1) work.push(childNodes[index]);
    }
    files.push({
      path: source.path,
      role,
      sha256: sha256(source.source),
      status: unresolved.length === startUnresolved ? "passed" : "unexecuted",
    });
  }
  const checks: PackageSourceDependencyAssessment["checks"][number][] = references.map(
    (reference, index) => ({
      id: `source-dependency:reference:${index + 1}:${reference.role}:${reference.path}:${reference.span?.start.offset ?? 0}`,
      status: reference.status,
      reason: reference.reason,
    }),
  );
  for (const [index, item] of unresolved.entries())
    checks.push({
      id: `source-dependency:unresolved:${index + 1}:${item.role}:${item.path}:${item.span?.start.offset ?? 0}`,
      status: "unexecuted",
      reason: item.reason,
    });
  for (const [index, item] of outsideScope.entries())
    checks.push({
      id: `source-dependency:outside-scope:${index + 1}:${item.role}:${item.path}:${item.span?.start.offset ?? 0}`,
      status: "passed",
      reason: item.reason,
    });
  return {
    schemaVersion: 1,
    policy: "literal-source-references-v2",
    status: references.some((reference) => reference.status === "failed")
      ? "failed"
      : files.length > 0 && checks.every((check) => check.status === "passed")
        ? "passed"
        : "unexecuted",
    descriptionSha256: sha256(description),
    files,
    references,
    unresolved,
    checks,
    limitations: [
      "Literal syntax inventory does not establish execution, reachability, availability, exported members, or conditional use; transitive closure is checked separately.",
      "Only supplied files are inventoried; vignettes, demos and generated code require separate coverage.",
      "Dynamic evaluation and computed callees are outside the native static check and are recorded, not resolved.",
      "Computed targets/controls and known local loader bindings remain unexecuted; aliases and runtime search-path changes are not resolved.",
      "Test-role findings depend on the declared installed set, by default the GNU R 4.6.1 base and recommended packages.",
    ],
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function asNode(value: unknown): Node | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.kind === "string" ? (record as Node) : undefined;
}
function records(value: unknown): Record<string, unknown>[] {
  return Array.from(recordItems(value));
}
function* recordItems(value: unknown): Iterable<Record<string, unknown>> {
  if (!Array.isArray(value)) return;
  for (const item of value)
    if (item !== null && typeof item === "object") yield item as Record<string, unknown>;
}
function identifier(value: unknown): string | undefined {
  const node = asNode(value);
  return node?.kind === "Identifier" && typeof node.name === "string" ? node.name : undefined;
}
function literalName(value: unknown): string | undefined {
  const node = asNode(value);
  return node?.kind === "StringLiteral" && typeof node.value === "string"
    ? node.value
    : identifier(node);
}
function sourceSpan(value: unknown, length: number): PackageDependencySourceSpan | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const position = (item: unknown): PackageDependencySourcePosition | undefined => {
    if (item === null || typeof item !== "object") return undefined;
    const point = item as Record<string, unknown>;
    const { offset, line, column } = point;
    if (
      typeof offset !== "number" ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > length ||
      typeof line !== "number" ||
      !Number.isInteger(line) ||
      line < 1 ||
      typeof column !== "number" ||
      !Number.isInteger(column) ||
      column < 1
    )
      return undefined;
    return { offset, line, column };
  };
  const start = position(record.start);
  const end = position(record.end);
  return start !== undefined && end !== undefined && start.offset <= end.offset
    ? { start, end }
    : undefined;
}

function loaderArguments(
  loader: Loader,
  value: unknown,
): {
  package: unknown;
  characterOnly?: unknown;
  ambiguous: boolean;
} {
  if (!Array.isArray(value) || value.length > maxNodesPerFile)
    return { package: undefined, ambiguous: true };
  const arguments_: Argument[] = records(value).map((argument) => ({
    ...(typeof argument.name === "string" ? { name: argument.name } : {}),
    value: argument.value,
  }));
  const formals =
    loader === "library"
      ? [
          "package",
          "help",
          "pos",
          "lib.loc",
          "character.only",
          "logical.return",
          "warn.conflicts",
          "quietly",
        ]
      : loader === "require"
        ? ["package", "lib.loc", "quietly", "warn.conflicts", "character.only"]
        : ["package"];
  const matched = new Map<string, unknown>();
  const consumed = new Set<number>();
  let ambiguous =
    arguments_.length !== value.length ||
    arguments_.some((argument) => identifier(argument.value) === "...");
  // Exact named arguments win before partial matching, then positional matching.
  for (const [index, argument] of arguments_.entries()) {
    if (argument.name === undefined || !formals.includes(argument.name)) continue;
    if (matched.has(argument.name)) ambiguous = true;
    matched.set(argument.name, argument.value);
    consumed.add(index);
  }
  for (const [index, argument] of arguments_.entries()) {
    if (consumed.has(index) || argument.name === undefined) continue;
    const candidates = formals.filter((formal) => formal.startsWith(argument.name ?? ""));
    if (candidates.length === 1) {
      const formal = candidates[0];
      if (formal !== undefined) {
        if (matched.has(formal)) ambiguous = true;
        matched.set(formal, argument.value);
      }
    } else if (candidates.length > 1 || loader === "require") ambiguous = true;
    consumed.add(index);
  }
  for (const [index, argument] of arguments_.entries()) {
    if (consumed.has(index)) continue;
    if (identifier(argument.value) === "...") {
      ambiguous = true;
      continue;
    }
    const formal = formals.find((name) => !matched.has(name));
    if (formal !== undefined) matched.set(formal, argument.value);
    else if (loader === "require") ambiguous = true;
  }
  return {
    package: matched.get("package"),
    characterOnly: matched.get("character.only"),
    ambiguous,
  };
}

const knownKinds = new Set([
  "Program",
  "Block",
  "Identifier",
  "DoubleLiteral",
  "ComplexLiteral",
  "IntegerLiteral",
  "StringLiteral",
  "LogicalLiteral",
  "NullLiteral",
  "MissingLiteral",
  "UnaryExpression",
  "BinaryExpression",
  "AssignmentExpression",
  "ReplacementExpression",
  "CallExpression",
  "FunctionExpression",
  "IfExpression",
  "ForExpression",
  "WhileExpression",
  "RepeatExpression",
  "BreakExpression",
  "NextExpression",
  "ReturnExpression",
  "SubsetExpression",
  "NamespaceExpression",
  "FormulaExpression",
  "PipeExpression",
]);
/** Traverse only normalized syntax fields, never arbitrary values or runtime constants. */
function* children(node: Node): Iterable<unknown> {
  switch (node.kind) {
    case "Program":
    case "Block":
      if (Array.isArray(node.body)) yield* node.body;
      else yield undefined;
      return;
    case "UnaryExpression":
      yield node.operand;
      return;
    case "BinaryExpression":
    case "PipeExpression":
      yield node.left;
      yield node.right;
      return;
    case "AssignmentExpression":
    case "ReplacementExpression":
      yield node.target;
      yield node.value;
      return;
    case "CallExpression":
      yield node.callee;
      for (const argument of recordItems(node.arguments)) yield argument.value;
      return;
    case "FunctionExpression":
      for (const parameter of recordItems(node.parameters))
        if (parameter.defaultValue !== undefined) yield parameter.defaultValue;
      yield node.body;
      return;
    case "IfExpression":
      yield node.condition;
      yield node.consequence;
      if (node.alternative !== undefined) yield node.alternative;
      return;
    case "ForExpression":
      yield node.variable;
      yield node.sequence;
      yield node.body;
      return;
    case "WhileExpression":
      yield node.condition;
      yield node.body;
      return;
    case "RepeatExpression":
      yield node.body;
      return;
    case "ReturnExpression":
      if (node.value !== undefined) yield node.value;
      return;
    case "SubsetExpression":
      yield node.target;
      for (const argument of recordItems(node.arguments)) yield argument.value;
      return;
    case "NamespaceExpression":
      yield node.namespace;
      yield node.member;
      return;
    case "FormulaExpression":
      if (node.left !== undefined) yield node.left;
      yield node.right;
      return;
    default:
      return;
  }
}
