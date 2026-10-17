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
  readonly policy: "literal-source-references-v1";
  /** A bounded inventory can find failures but never establishes dependency closure. */
  readonly status: "failed" | "unexecuted";
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

type Node = Record<string, unknown> & { kind: string };
type Loader = "library" | "require" | "requireNamespace";
type Argument = { name?: string; value: unknown };
const packageName = /^[A-Za-z](?:[A-Za-z0-9.]*[A-Za-z0-9])?$/u;
// Independently observed Priority=base metadata in the pinned GNU R 4.6.1 oracle.
const basePackages = new Set([
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
const loaders = new Set<string>(["library", "require", "requireNamespace"]);
const quotedCalls = new Set(["quote", "expression", "substitute", "bquote", "alist"]);
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
 * The manual explicitly describes dependency scanning as non-exhaustive. Declaration
 * roles were separately checked with independently authored GNU R 4.6.1 packages.
 * No source expression, parser diagnostic text, or implementation body is returned.
 */
export function inspectPackageSourceDependencies(
  description: string,
  sources: readonly PackageDependencySource[],
  parse: PackageDependencySourceParser,
): PackageSourceDependencyAssessment {
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
      if (reason === undefined && role !== "package") reason = "unverified-source-role";
      if (reason === undefined && validTarget === ownPackage) reason = "self-reference";
      if (reason === undefined && validTarget !== undefined) {
        if (basePackages.has(validTarget)) {
          reason = "base-package";
          status = "passed";
        } else if (
          declaredIn.some(
            (field) =>
              field === "Depends" ||
              field === "Suggests" ||
              field === "Enhances" ||
              (field === "Imports" && kind !== "library" && kind !== "require"),
          )
        ) {
          reason = "declared-package";
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
    type Work = { value: unknown; quoted: boolean };
    const work: Work[] = ast === undefined ? [] : [{ value: ast, quoted: false }];
    const seen = new Set<unknown>();
    while (work.length > 0) {
      if (seen.size >= maxNodesPerFile) {
        addUnresolved("ast-limit");
        break;
      }
      const entry = work.pop();
      if (entry === undefined) break;
      if (seen.has(entry.value)) {
        addUnresolved("unsupported-ast");
        continue;
      }
      seen.add(entry.value);
      const node = asNode(entry.value);
      if (node === undefined) {
        addUnresolved("unsupported-ast");
        continue;
      }
      const uncertain =
        parsed.reason !== undefined
          ? parsed.reason
          : bindingLimit
            ? "ast-limit"
            : entry.quoted
              ? "quoted-syntax"
              : undefined;
      let quotedChildren = entry.quoted;
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
        if (name !== undefined && quotedCalls.has(name)) quotedChildren = true;
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
        } else if (name !== undefined && dynamicCalls.has(name)) {
          addUnresolved(uncertain ?? "dynamic-evaluation", node);
        } else if (
          callee === undefined ||
          (callee.kind !== "Identifier" && callee.kind !== "NamespaceExpression")
        ) {
          addUnresolved(uncertain ?? "computed-callee", node);
        }
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
      for (let index = childNodes.length - 1; index >= 0; index -= 1)
        work.push({ value: childNodes[index], quoted: quotedChildren });
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
  return {
    schemaVersion: 1,
    policy: "literal-source-references-v1",
    status: references.some((reference) => reference.status === "failed") ? "failed" : "unexecuted",
    descriptionSha256: sha256(description),
    files,
    references,
    unresolved,
    checks,
    limitations: [
      "Literal syntax inventory does not establish execution, reachability, availability, exported members, conditional use, or transitive dependency closure.",
      "Only supplied files are inventoried; tests, examples, vignettes and generated code require separate coverage.",
      "Package-code declaration rules are independently observed; test/example roles and self references remain unexecuted.",
      "Quoted syntax, computed targets/controls, known local loader bindings and dynamic evaluation remain unexecuted; aliases and runtime search-path changes are not resolved.",
      "File passed status describes syntax inventory only; this assessment never passes the complete metadata stage or P7.",
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
