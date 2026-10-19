import type { PackageDependencySourceParser } from "./source-dependency-check.js";

/**
 * Rd parsing and the package-check `documentation` stage (RFC-0008).
 *
 * The parser follows the published Rd format: Writing R Extensions, chapter 2, and "Parsing Rd
 * files" (D. Murdoch, R Core). Check rules follow native GNU R 4.6.1 `R CMD check` outcomes on
 * independently authored fixture packages. No `tools` source was read. Assessments return names,
 * paths and outcome classes; observation probes are constructed solely from public Rd usage.
 */

export interface RdText {
  readonly kind: "text";
  readonly text: string;
}
export interface RdMacro {
  readonly kind: "macro";
  readonly name: string;
  readonly option?: string;
  readonly args: readonly (readonly RdNode[])[];
}
export type RdNode = RdText | RdMacro;

// Sections and macros whose content is R-like code: strings are quoted and braces count only
// outside strings.
const R_LIKE = new Set([
  "usage",
  "examples",
  "code",
  "dontrun",
  "donttest",
  "dontshow",
  "testonly",
]);
// Verbatim-like contents (no nested macros other than escapes).
const VERBATIM = new Set([
  "alias",
  "name",
  "keyword",
  "concept",
  "docType",
  "encoding",
  "url",
  "preformatted",
  "out",
  "kbd",
  "samp",
  "verb",
  "env",
  "option",
  "eqn",
  "deqn",
]);

export function parseRd(text: string): RdNode[] {
  const state = { text, index: 0 };
  return parseSequence(state, "latex", false);
}

type Mode = "latex" | "rlike" | "verbatim" | "verbatim-percent";

function parseSequence(
  state: { text: string; index: number },
  mode: Mode,
  inBraces: boolean,
): RdNode[] {
  const nodes: RdNode[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer.length > 0) nodes.push({ kind: "text", text: buffer });
    buffer = "";
  };
  let quote: string | undefined;
  const verbatim = mode === "verbatim" || mode === "verbatim-percent";
  let literalBraces = 0;
  while (state.index < state.text.length) {
    const char = state.text[state.index] ?? "";
    if (char === "\\") {
      const next = state.text[state.index + 1] ?? "";
      if (next === "\\" || next === "{" || next === "}" || next === "%") {
        buffer += next;
        state.index += 2;
        continue;
      }
      if (quote !== undefined) {
        buffer += char + next;
        state.index += 2;
        continue;
      }
      if (verbatim) {
        buffer += char;
        state.index += 1;
        continue;
      }
      const match = /^[A-Za-z][A-Za-z0-9]*/u.exec(state.text.slice(state.index + 1));
      if (match === null) {
        buffer += char;
        state.index += 1;
        continue;
      }
      flush();
      const name = match[0];
      state.index += 1 + name.length;
      let option: string | undefined;
      if (
        state.text[state.index] === "[" &&
        (name === "link" || name === "Sexpr" || name === "enc")
      ) {
        const close = state.text.indexOf("]", state.index);
        if (close > 0) {
          option = state.text.slice(state.index + 1, close);
          state.index = close + 1;
        }
      }
      const args: RdNode[][] = [];
      while (state.text[state.index] === "{") {
        state.index += 1;
        const childMode: Mode =
          (name === "eqn" || name === "deqn") && args.length === 0
            ? "verbatim-percent"
            : VERBATIM.has(name) || (name === "href" && args.length === 0)
              ? "verbatim"
              : R_LIKE.has(name)
                ? "rlike"
                : name === "item" || name === "method" || name === "S3method" || name === "S4method"
                  ? mode
                  : "latex";
        args.push(parseSequence(state, childMode, true));
      }
      nodes.push({ kind: "macro", name, ...(option === undefined ? {} : { option }), args });
      continue;
    }
    if (quote === undefined && char === "%" && mode !== "verbatim-percent") {
      const end = state.text.indexOf("\n", state.index);
      state.index = end < 0 ? state.text.length : end;
      continue;
    }
    if (mode === "rlike") {
      if (quote === undefined && (char === '"' || char === "'" || char === "`")) quote = char;
      else if (quote === char) quote = undefined;
    }
    if (quote === undefined && char === "{") {
      if (verbatim) {
        literalBraces += 1;
        buffer += char;
        state.index += 1;
        continue;
      }
      flush();
      state.index += 1;
      nodes.push({ kind: "macro", name: "", args: [parseSequence(state, mode, true)] });
      continue;
    }
    if (quote === undefined && char === "}") {
      if (verbatim && literalBraces > 0) {
        literalBraces -= 1;
        buffer += char;
        state.index += 1;
        continue;
      }
      if (inBraces) {
        state.index += 1;
        flush();
        return nodes;
      }
    }
    buffer += char;
    state.index += 1;
  }
  flush();
  return nodes;
}

/** Plain text of nodes, rendering R-like usage macros as R syntax. */
export function rdText(nodes: readonly RdNode[]): string {
  let text = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      text += node.text;
      continue;
    }
    const arg = (index: number) => rdText(node.args[index] ?? []);
    switch (node.name) {
      case "dots":
      case "ldots":
        text += "...";
        break;
      case "R":
        text += "R";
        break;
      case "method":
      case "S3method": {
        const generic = arg(0).trim();
        const cls = arg(1).trim();
        text += /^[A-Za-z.][A-Za-z0-9._]*$/u.test(generic)
          ? `${generic}.${cls}`
          : `\`${generic}.${cls}\``;
        break;
      }
      case "S4method":
        text += `${arg(0).trim()}`;
        break;
      case "special":
      case "Sexpr":
        break;
      default:
        text += node.args.map((group) => rdText(group)).join("");
    }
  }
  return text;
}

export interface RdFile {
  readonly path: string;
  readonly text: string;
}

export interface DocumentationInput {
  readonly packageName: string;
  readonly rdFiles: readonly RdFile[];
  /** Exported object names after resolving export() and exportPattern(). */
  readonly exports: readonly string[];
  /** Top-level function formals of package code, with default-value syntax. */
  readonly functions: ReadonlyMap<string, readonly { name: string; defaultValue?: unknown }[]>;
  /** When supplied, only complete paired namespace observations can establish codoc success. */
  readonly loaded?: {
    readonly exportsStatus: DocumentationCheck["status"];
    readonly functions: ReadonlyMap<string, DocumentationCheck["status"]>;
  };
  /** Aliases of base and recommended packages (black-box catalog). */
  readonly installedAliases: ReadonlyMap<string, ReadonlySet<string>>;
  /** Installed Rd file basenames, independently observed for qualified-link fallback. */
  readonly installedFiles?: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface DocumentationCheck {
  readonly id: string;
  readonly status: "passed" | "failed" | "unexecuted";
  readonly reason: string;
}

export interface DocumentationAssessment {
  readonly schemaVersion: 1;
  readonly policy: "documentation-v4";
  readonly status: "passed" | "failed" | "unexecuted";
  readonly checks: readonly DocumentationCheck[];
}

export interface DocumentationProbe {
  readonly id: string;
  readonly name: string;
  /** Constructed solely from documented usage; always a single NULL-bodied function, or null. */
  readonly signature: string | null;
}

/** Collect public usage signatures without reading or serializing implementation bodies. */
export function collectDocumentationProbes(
  files: readonly RdFile[],
  parse: PackageDependencySourceParser,
): DocumentationProbe[] {
  const probes: DocumentationProbe[] = [];
  const occurrences = new Map<string, number>();
  for (const file of files) {
    try {
      const usage = parseRd(file.text)
        .filter((node): node is RdMacro => node.kind === "macro" && node.name === "usage")
        .flatMap((node) => node.args)
        .map((group) => rdText(group))
        .join("\n");
      const result = parse(usage);
      if (result.diagnostics.some((diagnostic) => diagnostic.severity !== "info")) continue;
      for (const entry of usageEntries(result.ast)) {
        if (entry.kind !== "function") continue;
        const base = `rd:codoc:${file.path}:${entry.name}`;
        const occurrence = (occurrences.get(base) ?? 0) + 1;
        occurrences.set(base, occurrence);
        let signature: string | null = null;
        try {
          const parameters = entry.args.map((arg) => {
            const name = `\`${arg.name.replaceAll("\\", "\\\\").replaceAll("`", "\\`")}\``;
            if (arg.defaultValue === undefined) return name;
            const span = asNode(arg.defaultValue)?.span as
              { start?: { offset?: number }; end?: { offset?: number } } | undefined;
            const start = span?.start?.offset;
            const end = span?.end?.offset;
            if (
              start === undefined ||
              end === undefined ||
              start < 0 ||
              end <= start ||
              end > usage.length
            )
              throw new Error("No documented default span.");
            return `${name} = ${usage.slice(start, end)}`;
          });
          const candidate = `function(${parameters.join(", ")}) NULL`;
          const parsed = parse(candidate);
          const body = (parsed.ast as { body?: unknown[] } | undefined)?.body;
          const fn = asNode(body?.[0]);
          if (
            entry.complete &&
            !parsed.diagnostics.some((item) => item.severity !== "info") &&
            body?.length === 1 &&
            fn?.kind === "FunctionExpression" &&
            asNode(fn.body)?.kind === "NullLiteral"
          )
            signature = candidate;
        } catch {
          // Unsupported/ambiguous documented syntax cannot become a successful observation.
        }
        probes.push({
          id: occurrence === 1 ? base : `${base}#${occurrence}`,
          name: entry.name,
          signature,
        });
      }
    } catch {
      // The inspector reports malformed Rd/usage independently.
    }
  }
  return probes;
}

interface ParsedRd {
  readonly path: string;
  readonly sections: Map<string, (readonly RdNode[])[]>;
  readonly aliases: string[];
  readonly links: { topic: string; pkg?: string }[];
}

export function inspectPackageDocumentation(
  input: DocumentationInput,
  parse: PackageDependencySourceParser,
): DocumentationAssessment {
  const checks: DocumentationCheck[] = [];
  const occurrences = new Map<string, number>();
  const add = (id: string, status: DocumentationCheck["status"], reason: string) => {
    const occurrence = (occurrences.get(id) ?? 0) + 1;
    occurrences.set(id, occurrence);
    checks.push({ id: occurrence === 1 ? id : `${id}#${occurrence}`, status, reason });
  };
  const parsed: ParsedRd[] = [];
  for (const file of input.rdFiles) {
    let nodes: RdNode[];
    try {
      nodes = parseRd(file.text);
    } catch {
      add(`rd:file:${file.path}`, "failed", "The Rd file could not be parsed.");
      continue;
    }
    const sections = new Map<string, (readonly RdNode[])[]>();
    for (const node of nodes)
      if (node.kind === "macro" && node.name !== "")
        sections.set(node.name, [...(sections.get(node.name) ?? []), ...node.args]);
    const count = (name: string) =>
      nodes.filter((node) => node.kind === "macro" && node.name === name).length;
    // \name and \title must exist and be unique (a native build-time ERROR otherwise).
    const required = count("name") === 1 && count("title") === 1;
    add(
      `rd:file:${file.path}`,
      required ? "passed" : "failed",
      required
        ? "The Rd file parses with a unique name and title."
        : "Sections \\title and \\name must exist and be unique.",
    );
    const aliases = (sections.get("alias") ?? []).map((group) => rdText(group).trim());
    const links: ParsedRd["links"] = [];
    collectLinks(nodes, links);
    parsed.push({ path: file.path, sections, aliases, links });
  }

  // Rd metadata: aliases are known per file.
  add(
    "rd:metadata",
    parsed.length === input.rdFiles.length ? "passed" : "unexecuted",
    "Names, titles and aliases were extracted from every Rd file.",
  );

  const packageAliases = new Set(parsed.flatMap((rd) => rd.aliases));
  const packageFiles = new Set(
    parsed.map((rd) => rd.path.replace(/^.*[/\\]/u, "").replace(/\.[Rr]d$/u, "")),
  );
  const allInstalled = new Set<string>();
  for (const aliases of input.installedAliases.values())
    for (const alias of aliases) allInstalled.add(alias);

  // Cross-references.
  for (const rd of parsed) {
    let status: DocumentationCheck["status"] = "passed";
    for (const link of rd.links) {
      // Native check accepts a qualified alias or Rd filename in that package. Its check is
      // stricter than the HTML renderer's cross-package fallback. Unqualified links use aliases.
      const known =
        link.pkg === undefined
          ? packageAliases.has(link.topic) || allInstalled.has(link.topic)
          : link.pkg === input.packageName
            ? packageAliases.has(link.topic) || packageFiles.has(link.topic)
            : input.installedAliases.get(link.pkg)?.has(link.topic) === true
              ? true
              : input.installedAliases.has(link.pkg)
                ? input.installedFiles?.get(link.pkg)?.has(link.topic)
                : undefined;
      if (known === undefined) status = status === "failed" ? status : "unexecuted";
      else if (!known) status = "failed";
    }
    add(
      `rd:links:${rd.path}`,
      status,
      status === "passed"
        ? "Every link target is a package or installed topic."
        : status === "failed"
          ? "Missing link targets."
          : "A link target cannot be resolved from the available alias and Rd file catalogs.",
    );
  }

  // Missing documentation entries for exported objects.
  if (input.loaded !== undefined)
    add(
      "rd:namespace-exports",
      input.loaded.exportsStatus,
      "Loaded namespace export names must be completely observed and agree with the oracle.",
    );
  const undocumented = input.exports.filter((name) => !packageAliases.has(name));
  add(
    "rd:missing-documentation",
    input.loaded !== undefined && input.loaded.exportsStatus !== "passed"
      ? "unexecuted"
      : undocumented.length === 0
        ? "passed"
        : "failed",
    input.loaded !== undefined && input.loaded.exportsStatus !== "passed"
      ? "The complete exported object inventory has not been established."
      : undocumented.length === 0
        ? "Every exported object has a documentation entry."
        : "Undocumented exported objects.",
  );

  // Usage: code/documentation consistency and documented arguments.
  for (const rd of parsed) {
    const usageGroups = rd.sections.get("usage");
    if (usageGroups === undefined) continue;
    const usageText = usageGroups.map((group) => rdText(group)).join("\n");
    let ast: unknown;
    try {
      const result = parse(usageText);
      ast = result.diagnostics.some((diagnostic) => diagnostic.severity !== "info")
        ? undefined
        : result.ast;
    } catch {
      ast = undefined;
    }
    if (ast === undefined) {
      add(`rd:usage:${rd.path}`, "failed", "The \\usage section is not syntactically valid R.");
      continue;
    }
    const entries = usageEntries(ast);
    const usageArguments = new Set(entries.flatMap((entry) => entry.args.map((arg) => arg.name)));
    const documented = new Set(
      (rd.sections.get("arguments") ?? []).flatMap((group) => argumentItems(group)),
    );
    const undocumentedArgs = [...usageArguments].filter((name) => !documented.has(name));
    const internal = (rd.sections.get("keyword") ?? []).some(
      (group) => rdText(group).trim() === "internal",
    );
    const extraArgs = [...documented].filter((name) => !usageArguments.has(name));
    // S3 methods documented with \method need no alias of their own.
    const methods = new Set<string>();
    for (const group of usageGroups) collectMethodNames(group, methods);
    const unaliased = entries.filter(
      (entry) =>
        entry.kind === "function" && !methods.has(entry.name) && !rd.aliases.includes(entry.name),
    );
    const usageOk =
      (internal || undocumentedArgs.length === 0) &&
      extraArgs.length === 0 &&
      unaliased.length === 0;
    add(
      `rd:usage:${rd.path}`,
      usageOk ? "passed" : "failed",
      usageOk
        ? "Usage arguments satisfy the internal-page policy, every documented argument is in usage, and usage functions have aliases."
        : "Usage arguments, documented arguments or aliases are inconsistent.",
    );
    for (const entry of entries) {
      if (entry.kind !== "function") continue;
      const base = `rd:codoc:${rd.path}:${entry.name}`;
      if (input.loaded !== undefined) {
        const occurrence = (occurrences.get(base) ?? 0) + 1;
        const id = occurrence === 1 ? base : `${base}#${occurrence}`;
        const status = input.loaded.functions.get(id) ?? "unexecuted";
        add(
          base,
          status,
          status === "passed"
            ? "Documented formals match loaded signatures in both runtimes."
            : status === "failed"
              ? "A loaded signature differs from documented formals."
              : "Complete paired loaded signature observations are unavailable.",
        );
        continue;
      }
      const code = input.functions.get(entry.name);
      if (code === undefined) {
        add(
          `rd:codoc:${rd.path}:${entry.name}`,
          "unexecuted",
          "Static function metadata is unavailable; loaded namespace metadata is needed to check this usage.",
        );
        continue;
      }
      const same =
        code.length === entry.args.length &&
        code.every(
          (formal, index) =>
            formal.name === entry.args[index]?.name &&
            sameSyntax(formal.defaultValue, entry.args[index]?.defaultValue),
        );
      add(
        `rd:codoc:${rd.path}:${entry.name}`,
        same ? "passed" : "failed",
        same
          ? "Documented arguments and defaults match the code."
          : "Code/documentation mismatch in argument names or default values.",
      );
    }
  }

  // Rd contents: a description is present in every file.
  const withoutDescription = parsed.filter(
    (rd) => rdText(rd.sections.get("description")?.[0] ?? []).trim() === "",
  );
  add(
    "rd:contents",
    withoutDescription.length === 0 ? "passed" : "unexecuted",
    withoutDescription.length === 0
      ? "Every Rd file has a description."
      : "An Rd file without a description is not yet specified.",
  );

  return {
    schemaVersion: 1,
    policy: "documentation-v4",
    status: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.every((check) => check.status === "passed")
        ? "passed"
        : "unexecuted",
    checks,
  };
}

function collectLinks(nodes: readonly RdNode[], links: ParsedRd["links"]): void {
  for (const node of nodes) {
    if (node.kind !== "macro") continue;
    if (node.name === "link") {
      const text = rdText(node.args[0] ?? []).trim();
      const option = node.option;
      if (option === undefined) links.push({ topic: text });
      else if (option.startsWith("=")) links.push({ topic: option.slice(1) });
      else {
        const [pkg, topic] = option.split(":");
        links.push({ pkg: pkg ?? "", topic: topic ?? text });
      }
      continue;
    }
    if (node.name === "linkS4class") {
      links.push({ topic: `${rdText(node.args[0] ?? []).trim()}-class` });
      continue;
    }
    for (const group of node.args) collectLinks(group, links);
  }
}

function collectMethodNames(nodes: readonly RdNode[], names: Set<string>): void {
  for (const node of nodes) {
    if (node.kind !== "macro") continue;
    if (node.name === "method" || node.name === "S3method")
      names.add(`${rdText(node.args[0] ?? []).trim()}.${rdText(node.args[1] ?? []).trim()}`);
    for (const group of node.args) collectMethodNames(group, names);
  }
}

function argumentItems(nodes: readonly RdNode[]): string[] {
  const names: string[] = [];
  for (const node of nodes)
    if (node.kind === "macro" && node.name === "item" && node.args.length >= 2)
      for (const name of rdText(node.args[0] ?? []).split(","))
        if (name.trim() !== "") names.push(name.trim());
  return names;
}

type UsageEntry = {
  kind: "function" | "object";
  name: string;
  args: { name: string; defaultValue?: unknown }[];
  complete?: boolean;
};

function usageEntries(ast: unknown): UsageEntry[] {
  const entries: UsageEntry[] = [];
  const body = (ast as { body?: unknown[] })?.body ?? [];
  for (const statement of body) {
    const node = asNode(statement);
    if (node === undefined) continue;
    if (node.kind === "Identifier" && typeof node.name === "string") {
      entries.push({ kind: "object", name: node.name, args: [] });
    } else if (node.kind === "CallExpression") {
      const name = calleeName(node.callee);
      if (name !== undefined)
        entries.push({
          kind: "function",
          name,
          args: callFormals(node.arguments),
          complete:
            Array.isArray(node.arguments) &&
            callFormals(node.arguments).length === node.arguments.length,
        });
    } else if (node.kind === "ReplacementExpression") {
      const target = asNode(node.target);
      const name = target?.kind === "CallExpression" ? calleeName(target.callee) : undefined;
      if (name !== undefined)
        entries.push({
          kind: "function",
          name: `${name}<-`,
          args: [...callFormals(target?.arguments), { name: "value" }],
          complete:
            Array.isArray(target?.arguments) &&
            callFormals(target.arguments).length === target.arguments.length,
        });
    } else if (node.kind === "BinaryExpression" && typeof node.operator === "string") {
      const left = identifierName(node.left);
      const right = identifierName(node.right);
      if (left !== undefined && right !== undefined)
        entries.push({
          kind: "function",
          name: node.operator,
          args: [{ name: left }, { name: right }],
          complete: true,
        });
    }
  }
  return entries;
}

function callFormals(value: unknown): { name: string; defaultValue?: unknown }[] {
  const formals: { name: string; defaultValue?: unknown }[] = [];
  for (const argument of Array.isArray(value) ? value : []) {
    const record = argument as { name?: unknown; value?: unknown };
    if (typeof record.name === "string")
      formals.push({ name: record.name, defaultValue: record.value });
    else {
      const node = asNode(record.value);
      // The normalized AST represents a bare ... argument as an unsupported "dots" placeholder.
      const name =
        node?.kind === "UnsupportedExpression" && node.feature === "dots"
          ? "..."
          : identifierName(record.value);
      if (name !== undefined) formals.push({ name });
    }
  }
  return formals;
}

/** Structural comparison of default-value syntax, ignoring source positions. */
function sameSyntax(left: unknown, right: unknown): boolean {
  return JSON.stringify(stripSpans(left)) === JSON.stringify(stripSpans(right));
}
function stripSpans(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSpans);
  if (value === null || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>))
    if (key !== "span" && key !== "display") result[key] = stripSpans(item);
  return result;
}

function asNode(value: unknown): (Record<string, unknown> & { kind: string }) | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.kind === "string"
    ? (record as Record<string, unknown> & { kind: string })
    : undefined;
}
function identifierName(value: unknown): string | undefined {
  const node = asNode(value);
  return node?.kind === "Identifier" && typeof node.name === "string" ? node.name : undefined;
}
function calleeName(value: unknown): string | undefined {
  const node = asNode(value);
  if (node?.kind === "Identifier" && typeof node.name === "string") return node.name;
  if (node?.kind === "StringLiteral" && typeof node.value === "string") return node.value;
  return undefined;
}

// Rd macros documented in Writing R Extensions, chapter 2 (GNU R 4.6.1), including the system
// macros. Equation arguments are verbatim; LaTeX commands are not Rd macros outside them.
const DOCUMENTED_RD_MACROS = new Set(
  (
    "CRANpkg Figure PR R RdOpts S3method S4method Sexpr abbr acronym alias arguments author " +
    "bibcitep bibcitet bibinfo bibshow bold cite citep citet code command concept cr dQuote deqn " +
    "describe description details dfn docType doi dontdiff dontrun dontshow donttest dots email emph " +
    "enc encoding enumerate env eqn examples figure file format href if ifelse " +
    "includegraphics inputencoding item itemize kbd keyword ldots link linkS4class " +
    "linkS4methods method name newcommand note option out packageAuthor packageDESCRIPTION " +
    "packageDescription packageIndices packageMaintainer packageTitle pkg preformatted references " +
    "renewcommand sQuote samp section seealso source sspace strong subsection tab tabular " +
    "testonly title url usage usepackage value var verb"
  ).split(" "),
);

export interface ManualAssessment {
  readonly schemaVersion: 1;
  readonly policy: "manual-text-rendering-v2";
  readonly status: "passed" | "failed" | "unexecuted";
  readonly checks: readonly DocumentationCheck[];
}

/**
 * Browser adaptation of the manual stage (RFC-0008): every Rd file renders to text using only
 * documented or package-defined macros. PDF typesetting needs a host LaTeX toolchain.
 */
export function inspectPackageManual(rdFiles: readonly RdFile[]): ManualAssessment {
  const checks: DocumentationCheck[] = [];
  for (const file of rdFiles) {
    let nodes: RdNode[];
    try {
      nodes = parseRd(file.text);
      rdText(nodes);
    } catch {
      checks.push({
        id: `manual:${file.path}`,
        status: "failed",
        reason: "The Rd file does not render.",
      });
      continue;
    }
    const defined = new Set<string>();
    const used = new Set<string>();
    const walk = (items: readonly RdNode[]) => {
      for (const node of items) {
        if (node.kind !== "macro") continue;
        if (
          (node.name === "newcommand" || node.name === "renewcommand") &&
          node.args[0] !== undefined
        )
          for (const item of node.args[0])
            if (item.kind === "macro" && item.name !== "") defined.add(item.name);
        if (node.name !== "") used.add(node.name);
        for (const group of node.args) walk(group);
      }
    };
    walk(nodes);
    const unknown = [...used].filter(
      (name) => !DOCUMENTED_RD_MACROS.has(name) && !defined.has(name),
    );
    checks.push({
      id: `manual:${file.path}`,
      status: used.has("Sexpr") ? "unexecuted" : unknown.length === 0 ? "passed" : "failed",
      reason: used.has("Sexpr")
        ? "\\Sexpr content is evaluated at build time and is not rendered."
        : unknown.length === 0
          ? "The Rd file renders to text with documented macros only."
          : "The Rd file uses undocumented, undefined macros.",
    });
  }
  return {
    schemaVersion: 1,
    policy: "manual-text-rendering-v2",
    status: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.length > 0 && checks.every((check) => check.status === "passed")
        ? "passed"
        : "unexecuted",
    checks,
  };
}
