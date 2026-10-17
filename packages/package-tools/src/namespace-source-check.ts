import type { PackageDependencySourceParser } from "./source-dependency-check.js";

/**
 * Namespace and R-source checks for the package-check `namespace-source` stage (RFC-0008).
 *
 * Every rule was derived from public documentation (Writing R Extensions, chapter 7) and from the
 * outcomes of native GNU R 4.6.1 `R CMD check` on independently authored fixture packages. No
 * package implementation, `tools` source, or codetools source was read. Only names, paths and
 * outcome classes are reported; source text never leaves this module.
 */

export type NamespaceSourceStatus = "passed" | "failed" | "unexecuted";

export interface NamespaceSourceCheck {
  readonly id: string;
  readonly status: NamespaceSourceStatus;
  readonly reason: string;
  /** NOTE-class findings, which do not fail the stage. */
  readonly notes?: readonly string[];
}

export interface NamespaceSourceInput {
  readonly packageName: string;
  /** Encoding declared in DESCRIPTION, if any. */
  readonly encoding?: string;
  /** Packages attached by Depends (excluding R). */
  readonly depends: readonly string[];
  /** NAMESPACE text, or undefined when the archive has none. */
  readonly namespace: string | undefined;
  /** R files in collation order, with their raw bytes for the ASCII check. */
  readonly sources: readonly { readonly path: string; readonly bytes: Uint8Array }[];
  /** Whether the archive has an INDEX file or demo index. */
  readonly hasIndex: boolean;
  /**
   * Public exports of core packages: name to formal names (null for non-callable exports). From
   * the black-box GNU R 4.6.1 surface inventory.
   */
  readonly coreExports: ReadonlyMap<string, ReadonlyMap<string, readonly string[] | null>>;
}

export interface NamespaceSourceAssessment {
  readonly schemaVersion: 1;
  readonly policy: "namespace-source-v1";
  readonly status: NamespaceSourceStatus;
  readonly checks: readonly NamespaceSourceCheck[];
  /** Undefined global functions or variables reported as a NOTE, sorted. */
  readonly undefinedGlobals: readonly string[];
}

type Node = Record<string, unknown> & { kind: string };

const DIRECTIVES = new Set([
  "export",
  "exportPattern",
  "exportClasses",
  "exportClassPattern",
  "exportMethods",
  "import",
  "importFrom",
  "importClassesFrom",
  "importMethodsFrom",
  "S3method",
  "useDynLib",
  "if",
]);
const FOREIGN = new Set([".C", ".Call", ".Fortran", ".External", ".External2"]);
// Calls whose arguments are not evaluated in the caller (observed natively).
const UNEVALUATED = new Set(["quote", "bquote", "substitute", "expression", "with", "alist"]);
// Names the native analysis treats as defined without a binding.
const IMPLICIT = new Set([".packageName", "...", ".Generic", ".Class", ".Method", ".Random.seed"]);

export function inspectPackageNamespaceSource(
  input: NamespaceSourceInput,
  parse: PackageDependencySourceParser,
): NamespaceSourceAssessment {
  const checks: NamespaceSourceCheck[] = [];
  const add = (id: string, status: NamespaceSourceStatus, reason: string, notes?: string[]) =>
    checks.push({ id, status, reason, ...(notes === undefined ? {} : { notes }) });

  // Namespace presence and directives.
  const directives: { name: string; args: { name?: string; value: Node }[] }[] = [];
  if (input.namespace === undefined) {
    add("namespace:present", "failed", "The package has no NAMESPACE file.");
  } else {
    add("namespace:present", "passed", "NAMESPACE file present.");
    const parsed = safeParse(parse, input.namespace);
    let valid = parsed !== undefined;
    for (const statement of statements(parsed)) {
      const call = asNode(statement);
      const name = call?.kind === "CallExpression" ? identifier(call.callee) : undefined;
      if (name === undefined || !DIRECTIVES.has(name)) {
        valid = false;
        continue;
      }
      if (name === "if") {
        valid = false;
        continue;
      }
      directives.push({ name, args: callArguments(call) });
    }
    add(
      "namespace:directives",
      valid ? "passed" : "unexecuted",
      valid
        ? "Every NAMESPACE directive is a known, unconditional directive."
        : "NAMESPACE has conditional or unrecognized directives, which this check does not evaluate.",
    );
  }

  // Archive structure items that packing already validated.
  add(
    "package:directory",
    "passed",
    "The archive's package directory and DESCRIPTION name agree (validated when packed).",
  );
  add(
    "package:subdirectories",
    input.sources.length > 0 ? "passed" : "unexecuted",
    input.sources.length > 0 ? "R/ contains R source files." : "R/ contains no R source files.",
  );
  add(
    "package:index",
    input.hasIndex ? "unexecuted" : "passed",
    input.hasIndex
      ? "INDEX or demo index validation is not specified yet."
      : "No INDEX file or demo index to validate.",
  );

  // Per-file ASCII and syntax checks.
  const parsedFiles: { path: string; ast: unknown }[] = [];
  const declaredEncoding = input.encoding !== undefined && input.encoding.trim() !== "";
  for (const source of input.sources) {
    const nonAscii = source.bytes.some((byte) => byte > 0x7f);
    add(
      `code:non-ascii:${source.path}`,
      !nonAscii || declaredEncoding ? "passed" : "unexecuted",
      !nonAscii
        ? "ASCII only."
        : declaredEncoding
          ? "Non-ASCII bytes with a declared DESCRIPTION Encoding."
          : "Non-ASCII bytes without a declared Encoding; the native outcome class is not yet specified.",
    );
    let text: string | undefined;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
    } catch {
      text = undefined;
    }
    const result = text === undefined ? undefined : safeParseResult(parse, text);
    const syntaxOk =
      result !== undefined &&
      !result.diagnostics.some((diagnostic) => diagnostic.severity !== "info");
    add(
      `code:syntax:${source.path}`,
      result === undefined ? "unexecuted" : syntaxOk ? "passed" : "failed",
      result === undefined
        ? "The file could not be decoded or parsed."
        : syntaxOk
          ? "The file parses without diagnostics."
          : "The file has syntax errors.",
    );
    if (syntaxOk) parsedFiles.push({ path: source.path, ast: result.ast });
  }

  // Top-level definitions.
  const topLevel = new Map<string, Node>();
  for (const file of parsedFiles)
    for (const statement of statements(file.ast)) {
      const node = asNode(statement);
      if (node?.kind === "AssignmentExpression") {
        const name = identifier(node.target);
        const value = asNode(node.value);
        if (name !== undefined && value !== undefined) topLevel.set(name, value);
      }
    }

  // Visible names: package namespace, imports, base, and attached Depends.
  const visible = new Set<string>([...topLevel.keys(), ...IMPLICIT]);
  let unknownImports = false;
  const addPackageExports = (pkg: string, names?: readonly string[]) => {
    const exports = input.coreExports.get(pkg);
    if (names !== undefined) for (const name of names) visible.add(name);
    else if (exports === undefined) unknownImports = true;
    else for (const name of exports.keys()) visible.add(name);
  };
  addPackageExports("base");
  for (const pkg of input.depends) addPackageExports(pkg);
  for (const directive of directives) {
    const values = directive.args.map((argument) => literalName(argument.value));
    if (directive.name === "import")
      for (const pkg of values) if (pkg !== undefined) addPackageExports(pkg);
    if (directive.name === "importFrom" && values[0] !== undefined)
      addPackageExports(
        values[0],
        values.slice(1).filter((value): value is string => value !== undefined),
      );
  }

  // Replacement functions: the right-hand side argument must be named 'value'.
  for (const [name, value] of topLevel) {
    if (!name.endsWith("<-") || value.kind !== "FunctionExpression") continue;
    const formals = parameterNames(value);
    add(
      `replacement:${name}`,
      formals[formals.length - 1] === "value" ? "passed" : "failed",
      formals[formals.length - 1] === "value"
        ? "The last argument is named 'value'."
        : "The argument for the right-hand side must be named 'value'.",
    );
  }

  // S3 generic/method consistency for registered methods (observed rule, RFC-0008).
  for (const directive of directives) {
    if (directive.name !== "S3method") continue;
    const generic = literalName(directive.args[0]?.value);
    const cls = literalName(directive.args[1]?.value);
    const fun = literalName(directive.args[2]?.value) ?? `${generic}.${cls}`;
    const id = `s3:${generic}.${cls}`;
    if (generic === undefined || cls === undefined) {
      add(id, "unexecuted", "The S3method directive has computed arguments.");
      continue;
    }
    const method = topLevel.get(fun);
    const localGeneric = topLevel.get(generic);
    const genericFormals =
      localGeneric?.kind === "FunctionExpression"
        ? parameterNames(localGeneric)
        : coreFormals(input.coreExports, generic);
    if (method?.kind !== "FunctionExpression" || genericFormals === undefined) {
      add(id, "unexecuted", "The method or its generic's formals are not statically known.");
      continue;
    }
    const consistent = s3Consistent(genericFormals, parameterNames(method));
    add(
      id,
      consistent ? "passed" : "failed",
      consistent
        ? "The method's arguments are consistent with the generic."
        : "The method's arguments are inconsistent with the generic.",
    );
  }

  // Foreign function calls and possible problems.
  const undefinedGlobals = new Set<string>();
  const notes: string[] = [];
  let foreignCount = 0;
  for (const [name, value] of topLevel) {
    if (value.kind !== "FunctionExpression") continue;
    const findings = analyzeFunction(value, visible, name);
    for (const finding of findings.notes) notes.push(finding);
    for (const item of findings.undefined) undefinedGlobals.add(item);
    foreignCount += findings.foreign.length;
    for (const [index, foreign] of findings.foreign.entries())
      add(
        `foreign:${name}:${index + 1}`,
        foreign.hasPackage ? "unexecuted" : "failed",
        foreign.hasPackage
          ? "Foreign calls need the Native ABI and are not executed."
          : "Foreign function call without a 'PACKAGE' argument.",
      );
  }
  if (foreignCount === 0) add("foreign:none", "passed", "No foreign function calls.");
  add(
    "code:possible-problems",
    unknownImports ? "unexecuted" : "passed",
    unknownImports
      ? "Imports from non-core packages are not resolvable from the core surface inventory."
      : undefinedGlobals.size === 0
        ? "No undefined global functions or variables."
        : "NOTE: undefined global functions or variables.",
    notes.length === 0 ? undefined : notes.sort(),
  );

  return {
    schemaVersion: 1,
    policy: "namespace-source-v1",
    status: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.every((check) => check.status === "passed")
        ? "passed"
        : "unexecuted",
    checks,
    undefinedGlobals: [...undefinedGlobals].sort(),
  };
}

/**
 * Observed rule: compare arguments before `...` position by position; a method needs `...`
 * when the generic has it or when it is shorter; it may be longer only when the generic has `...`.
 */
export function s3Consistent(generic: readonly string[], method: readonly string[]): boolean {
  const genericDots = generic.includes("...");
  const methodDots = method.includes("...");
  if (genericDots && !methodDots) return false;
  const before = (formals: readonly string[]) => {
    const index = formals.indexOf("...");
    return index < 0 ? formals : formals.slice(0, index);
  };
  const g = before(generic);
  const m = before(method);
  for (let index = 0; index < Math.min(g.length, m.length); index += 1)
    if (g[index] !== m[index]) return false;
  if (m.length < g.length && !methodDots) return false;
  if (m.length > g.length && !genericDots) return false;
  return true;
}

function coreFormals(
  coreExports: NamespaceSourceInput["coreExports"],
  name: string,
): readonly string[] | undefined {
  for (const exports of coreExports.values()) {
    const formals = exports.get(name);
    if (formals !== undefined && formals !== null) return formals;
  }
  return undefined;
}

interface FunctionFindings {
  readonly undefined: Set<string>;
  readonly notes: string[];
  readonly foreign: { hasPackage: boolean }[];
}

function analyzeFunction(
  root: Node,
  visible: ReadonlySet<string>,
  label: string,
): FunctionFindings {
  const findings: FunctionFindings = { undefined: new Set(), notes: [], foreign: [] };
  const visit = (fn: Node, scopes: readonly Set<string>[], where: string) => {
    const locals = new Set(parameterNames(fn));
    collectLocals(fn.body, locals);
    const chain = [...scopes, locals];
    const known = (name: string) => visible.has(name) || chain.some((scope) => scope.has(name));
    const report = (name: string, kind: "function" | "variable" | "superassign") => {
      if (/^\.\.\d+$/u.test(name)) return;
      if (kind !== "superassign" && known(name)) return;
      if (kind === "superassign" && (visible.has(name) || scopes.some((scope) => scope.has(name))))
        return;
      findings.undefined.add(name);
      findings.notes.push(
        kind === "function"
          ? `${where}: no visible global function definition for '${name}'`
          : kind === "variable"
            ? `${where}: no visible binding for global variable '${name}'`
            : `${where}: no visible binding for '<<-' assignment to '${name}'`,
      );
    };
    const walk = (value: unknown): void => {
      const node = asNode(value);
      if (node === undefined) return;
      switch (node.kind) {
        case "Identifier":
          if (typeof node.name === "string") report(node.name, "variable");
          return;
        case "FunctionExpression":
          visit(node, chain, `${where} : <anonymous>`);
          return;
        case "FormulaExpression":
          return;
        case "NamespaceExpression":
          return;
        case "SubsetExpression":
          walk(node.target);
          if (node.operator === "$" || node.operator === "@") return;
          for (const argument of records(node.arguments)) walk(argument.value);
          return;
        case "AssignmentExpression": {
          const target = identifier(node.target);
          if ((node.operator === "<<-" || node.operator === "->>") && target !== undefined)
            report(target, "superassign");
          walk(node.value);
          return;
        }
        case "ReplacementExpression": {
          const target = asNode(node.target);
          if (target?.kind === "SubsetExpression") {
            walk(target.target);
            if (target.operator !== "$" && target.operator !== "@")
              for (const argument of records(target.arguments)) walk(argument.value);
          } else if (target?.kind === "CallExpression") {
            const callee = identifier(target.callee);
            if (callee !== undefined) report(`${callee}<-`, "function");
            for (const argument of records(target.arguments)) walk(argument.value);
          }
          walk(node.value);
          return;
        }
        case "IfExpression": {
          const condition = asNode(node.condition);
          walk(node.condition);
          if (!(condition?.kind === "LogicalLiteral" && condition.value === false))
            walk(node.consequence);
          walk(node.alternative);
          return;
        }
        case "CallExpression": {
          const callee = asNode(node.callee);
          const name = identifier(callee);
          if (name !== undefined) {
            if (FOREIGN.has(name))
              findings.foreign.push({
                hasPackage: records(node.arguments).some((argument) => argument.name === "PACKAGE"),
              });
            report(name, "function");
            if (UNEVALUATED.has(name)) {
              if (name === "with") walk(records(node.arguments)[0]?.value);
              return;
            }
          } else walk(node.callee);
          for (const argument of records(node.arguments)) walk(argument.value);
          return;
        }
        case "BinaryExpression":
          if (typeof node.operator === "string" && /^%.*%$/u.test(node.operator))
            report(node.operator, "function");
          walk(node.left);
          walk(node.right);
          return;
        default:
          for (const child of syntaxChildren(node)) walk(child);
      }
    };
    // Defaults are evaluated in the function frame, so they see its own formals and locals.
    for (const parameter of records(fn.parameters)) walk(parameter.defaultValue);
    walk(fn.body);
  };
  visit(root, [], label);
  return findings;
}

/** Names bound anywhere in a function body, not descending into nested functions. */
function collectLocals(value: unknown, locals: Set<string>): void {
  const node = asNode(value);
  if (node === undefined || node.kind === "FunctionExpression") return;
  if (
    node.kind === "AssignmentExpression" &&
    (node.operator === "<-" || node.operator === "=" || node.operator === "->")
  ) {
    const name = identifier(node.target);
    if (name !== undefined) locals.add(name);
  }
  if (node.kind === "ForExpression") {
    const name = identifier(node.variable);
    if (name !== undefined) locals.add(name);
  }
  if (node.kind === "CallExpression") {
    const name = identifier(node.callee);
    if (name !== undefined && UNEVALUATED.has(name) && name !== "with") return;
    if (name === "local") {
      // local() evaluates in a new frame; its bindings stay local to it but are visible inside.
      for (const argument of records(node.arguments)) collectLocals(argument.value, locals);
      return;
    }
  }
  for (const child of syntaxChildren(node)) collectLocals(child, locals);
  if (node.kind === "CallExpression")
    for (const argument of records(node.arguments)) collectLocals(argument.value, locals);
  if (node.kind === "ReplacementExpression") collectLocals(node.value, locals);
}

function* syntaxChildren(node: Node): Iterable<unknown> {
  switch (node.kind) {
    case "Program":
    case "Block":
      if (Array.isArray(node.body)) yield* node.body;
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
      yield node.value;
      return;
    case "CallExpression":
      yield node.callee;
      return;
    case "IfExpression":
      yield node.condition;
      yield node.consequence;
      yield node.alternative;
      return;
    case "ForExpression":
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
      yield node.value;
      return;
    case "SubsetExpression":
      yield node.target;
      return;
    default:
      return;
  }
}

function safeParse(parse: PackageDependencySourceParser, text: string): unknown {
  return safeParseResult(parse, text)?.ast;
}
function safeParseResult(
  parse: PackageDependencySourceParser,
  text: string,
): ReturnType<PackageDependencySourceParser> | undefined {
  try {
    return parse(text);
  } catch {
    return undefined;
  }
}
function statements(ast: unknown): unknown[] {
  const node = asNode(ast);
  return node !== undefined && Array.isArray(node.body) ? (node.body as unknown[]) : [];
}
function callArguments(call: Node | undefined): { name?: string; value: Node }[] {
  return records(call?.arguments).flatMap((argument) => {
    const value = asNode(argument.value);
    if (value === undefined) return [];
    return [typeof argument.name === "string" ? { name: argument.name, value } : { value }];
  });
}
function parameterNames(fn: Node): string[] {
  return records(fn.parameters)
    .map((parameter) => parameter.name)
    .filter((name): name is string => typeof name === "string");
}
function asNode(value: unknown): Node | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.kind === "string" ? (record as Node) : undefined;
}
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => item !== null && typeof item === "object",
  );
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
