import type {
  ParseDataRecord,
  ParseDataResult,
  ParseDataDiagnostic,
  ParseSourceDirective,
  ParseWorkCallbacks,
} from "@nativr/ast";

/** Options for the independent, observable retained-parser event model. */
export interface ParseDataOptions extends Partial<ParseWorkCallbacks> {
  readonly maxExpressions?: number;
}
type MutableRecord = { -readonly [K in keyof ParseDataRecord]: ParseDataRecord[K] };
interface EventNode {
  kind: string;
  id?: number;
  start: number;
  end: number;
  record?: MutableRecord;
  children?: readonly EventNode[];
  callName?: EventNode;
  checked?: boolean;
}

/** A direct parser call has no runtime context in which to report resource exhaustion. */
export class RetainedParserResourceError extends Error {
  public constructor() {
    super("Maximum retained-parser depth exceeded.");
    this.name = "RetainedParserResourceError";
  }
}

// Codes and allocation rules below come from independently authored black-box metadata probes.
// They are not Tree-sitter node IDs, and no GNU parser or grammar implementation is an input.
const codes: Readonly<Record<string, number>> = {
  STR_CONST: 260,
  NUM_CONST: 261,
  NULL_CONST: 262,
  SYMBOL: 263,
  FUNCTION: 264,
  LEFT_ASSIGN: 266,
  EQ_ASSIGN: 267,
  RIGHT_ASSIGN: 268,
  LBB: 269,
  FOR: 270,
  IN: 271,
  IF: 272,
  ELSE: 273,
  WHILE: 274,
  NEXT: 275,
  BREAK: 276,
  REPEAT: 277,
  GT: 278,
  GE: 279,
  LT: 280,
  LE: 281,
  EQ: 282,
  NE: 283,
  AND: 284,
  OR: 285,
  AND2: 286,
  OR2: 287,
  NS_GET: 288,
  NS_GET_INT: 289,
  COMMENT: 290,
  LINE_DIRECTIVE: 291,
  SYMBOL_FORMALS: 292,
  EQ_FORMALS: 293,
  EQ_SUB: 294,
  SYMBOL_SUB: 295,
  SYMBOL_FUNCTION_CALL: 296,
  SYMBOL_PACKAGE: 297,
  SLOT: 298,
  PIPE: 299,
  PLACEHOLDER: 300,
  SPECIAL: 306,
  expr: 79,
  exprlist: 83,
  forcond: 82,
  expr_or_assign_or_help: 77,
};
const keywords: Readonly<Record<string, string>> = {
  function: "FUNCTION",
  for: "FOR",
  in: "IN",
  if: "IF",
  else: "ELSE",
  while: "WHILE",
  next: "NEXT",
  break: "BREAK",
  repeat: "REPEAT",
  NULL: "NULL_CONST",
  TRUE: "NUM_CONST",
  FALSE: "NUM_CONST",
  NA: "NUM_CONST",
  NA_integer_: "NUM_CONST",
  NA_real_: "NUM_CONST",
  NA_character_: "NUM_CONST",
  NA_complex_: "NUM_CONST",
  Inf: "NUM_CONST",
  NaN: "NUM_CONST",
  _: "PLACEHOLDER",
};
const operators: Readonly<Record<string, string>> = {
  ":::": "NS_GET_INT",
  "::": "NS_GET",
  "<<-": "LEFT_ASSIGN",
  "<-": "LEFT_ASSIGN",
  ":=": "LEFT_ASSIGN",
  "->>": "RIGHT_ASSIGN",
  "->": "RIGHT_ASSIGN",
  "[[": "LBB",
  ">=": "GE",
  "<=": "LE",
  "==": "EQ",
  "!=": "NE",
  "&&": "AND2",
  "||": "OR2",
  "|>": "PIPE",
  "=": "EQ_ASSIGN",
  ">": "GT",
  "<": "LT",
  "&": "AND",
  "|": "OR",
  "**": "^",
};
const precedence: Readonly<Record<string, number>> = {
  LEFT_ASSIGN: 2,
  RIGHT_ASSIGN: 3,
  "~": 4,
  OR: 5,
  OR2: 5,
  AND: 6,
  AND2: 6,
  GT: 8,
  GE: 8,
  LT: 8,
  LE: 8,
  EQ: 8,
  NE: 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  SPECIAL: 11,
  PIPE: 11,
  ":": 12,
  "^": 14,
};
class ParseFailure extends Error {
  public readonly kind: ParseDataDiagnostic["kind"];
  public constructor(
    public readonly token: EventNode,
    kind?: ParseDataDiagnostic["kind"],
  ) {
    super();
    this.kind = kind ?? (token.kind === "EOF" ? "incomplete" : "unexpected-token");
  }
}
export function buildParseData(source: string, options: ParseDataOptions = {}): ParseDataResult {
  return new Model(source, options).run();
}
class Model {
  private readonly text: string;
  private offset = 0;
  private clock = 0;
  private records: MutableRecord[] = [];
  private readonly directives: ParseSourceDirective[] = [];
  private look: EventNode | null = null;
  private readonly queued: EventNode[] = [];
  private ignoreNL = 0;
  private braceDepth = 0;
  private bodyElse = 0;
  private readonly roots: EventNode[] = [];
  private selectedCount = 0;
  private consumed = 0;
  private depth = 0;
  private diagnostic: ParseDataDiagnostic | undefined;

  public constructor(
    source: string,
    private readonly options: ParseDataOptions,
  ) {
    this.text = source + "\n";
  }
  private enter(): void {
    if (this.depth >= (this.options.maxDepth ?? 256)) {
      this.options.onDepthExceeded?.();
      throw new RetainedParserResourceError();
    }
    this.depth++;
  }
  private leave(): void {
    this.depth--;
  }
  private unread(token: EventNode): void {
    if (this.look) this.queued.unshift(this.look);
    this.look = token;
  }
  private tick(): number {
    this.options.checkpoint?.();
    return ++this.clock;
  }
  private hidden(n = 1): void {
    for (let i = 0; i < n; i++) this.tick();
  }
  private emit(
    kind: string,
    start: number,
    end: number,
    terminal = true,
    children: readonly EventNode[] = [],
  ): EventNode {
    const id = this.tick();
    this.options.allocate?.(1);
    const token = codes[kind] === undefined ? `'${kind === "\\" ? "\\\\" : kind}'` : kind;
    const record = {
      id,
      parent: 0,
      terminal,
      token,
      tokenCode: codes[kind] ?? kind.charCodeAt(0),
      startOffset: start,
      endOffset: end,
    };
    this.records.push(record);
    for (const child of children) this.attach(child, id);
    return { kind, id, start, end, record, children };
  }
  private attach(node: EventNode | null | undefined, parent: number): void {
    if (!node) return;
    const pending = [node];
    while (pending.length > 0) {
      this.options.checkpoint?.();
      const current = pending.pop()!;
      if (current.record) current.record.parent = parent;
      else {
        this.options.allocate?.(current.children?.length ?? 0);
        for (const child of current.children ?? []) pending.push(child);
      }
    }
  }
  private reduce(
    children: readonly (EventNode | null)[],
    kind = "expr",
    visible = true,
  ): EventNode {
    this.options.allocate?.(children.length + 1);
    const actual = children.filter((child): child is EventNode => child !== null);
    const start = actual[0]?.start ?? this.offset,
      end = actual.at(-1)?.end ?? start;
    if (visible) return this.emit(kind, start, end, false, actual);
    this.hidden();
    return { kind, start, end, children: actual };
  }
  private relabel(node: EventNode, kind: string): void {
    node.kind = kind;
    if (node.record) {
      node.record.token = kind;
      node.record.tokenCode = codes[kind] ?? 0;
    }
  }
  /** Bound long lexical scans without charging a parser event for each source character. */
  private scanCheckpoint(offset: number): void {
    if ((offset & 255) === 0) this.options.checkpoint?.();
  }
  private pointAt(offset: number): string {
    const point = this.text.codePointAt(offset);
    return point === undefined ? "" : String.fromCodePoint(point);
  }
  private followedByElse(offset: number): boolean {
    while (offset < this.text.length) {
      this.scanCheckpoint(offset);
      const point = this.pointAt(offset);
      if (/\s/u.test(point)) {
        offset += point.length;
        continue;
      }
      if (point === "#") {
        do {
          this.scanCheckpoint(offset);
          offset++;
        } while (offset < this.text.length && this.text[offset] !== "\n");
        continue;
      }
      return (
        this.text.startsWith("else", offset) && !/[\p{L}\p{N}._]/u.test(this.pointAt(offset + 4))
      );
    }
    return false;
  }
  /** Linear, cancellable delimiter search, including arbitrarily long raw-string markers. */
  private findDelimiter(start: number, delimiter: string): number {
    this.options.allocate?.(delimiter.length);
    const prefix = new Uint32Array(delimiter.length);
    for (let i = 1, matched = 0; i < delimiter.length; i++) {
      this.scanCheckpoint(i);
      while (matched > 0 && delimiter[i] !== delimiter[matched]) matched = prefix[matched - 1] ?? 0;
      if (delimiter[i] === delimiter[matched]) matched++;
      prefix[i] = matched;
    }
    for (let i = start, matched = 0; i < this.text.length; i++) {
      this.scanCheckpoint(i);
      while (matched > 0 && this.text[i] !== delimiter[matched]) matched = prefix[matched - 1] ?? 0;
      if (this.text[i] === delimiter[matched]) matched++;
      if (matched === delimiter.length) return i + 1 - delimiter.length;
    }
    return -1;
  }
  private scan(): EventNode {
    const queued = this.queued.shift();
    if (queued) return queued;
    while (this.offset < this.text.length) {
      this.options.checkpoint?.();
      const start = this.offset,
        c = this.pointAt(this.offset);
      if (c === " " || c === "\t" || c === "\r" || c === "\f") {
        this.offset++;
        continue;
      }
      if (c === "#") {
        while (this.offset < this.text.length && this.text[this.offset] !== "\n") {
          this.scanCheckpoint(this.offset++);
        }
        const end = this.offset,
          raw = this.text.slice(start, end);
        const directive =
          start === 0 || this.text[start - 1] === "\n"
            ? /^#line[\t \f]*([0-9]+(?:\.[0-9]*)?)(.*)$/.exec(raw)
            : null;
        if (directive) {
          this.emit("LINE_DIRECTIVE", start, end);
          const rest = directive[2] ?? "";
          let filename;
          const quoted = /^[\t \f]*"((?:\\.|[^"\\])*)"/.exec(rest);
          if (quoted) {
            filename = (quoted[1] ?? "").replace(
              /\\([ntbrfva\\"])/g,
              (_: string, x: string) =>
                (
                  ({ n: "\n", t: "\t", b: "\b", r: "\r", f: "\f", v: "\v", a: "\x07" }) as Record<
                    string,
                    string
                  >
                )[x] ?? x,
            );
          }
          this.directives.push({
            startOffset: start,
            endOffset: end,
            nextLogicalLine: Math.min(2147483647, Math.trunc(Number(directive[1]))),
            ...(filename === undefined ? {} : { filename }),
          });
        } else {
          const comment = this.emit("COMMENT", start, end);
          if (
            (start === 0 || this.text[start - 1] === "\n") &&
            raw.startsWith("#line") &&
            comment.record
          )
            comment.record.text = "";
        }
        continue;
      }
      if (c === "\n") {
        this.offset++;
        const id = this.tick();
        return { kind: "NL", id, start, end: this.offset };
      }
      if ((c === "r" || c === "R") && this.text[this.offset + 1] === '"') {
        let markerEnd = start + 2;
        while (this.text[markerEnd] === "-") this.scanCheckpoint(markerEnd++);
        const opening = this.text[markerEnd] ?? "";
        if (opening === "(" || opening === "[" || opening === "{") {
          const closing =
            ({ "(": ")", "[": "]", "{": "}" } as Record<string, string>)[opening] +
            this.text.slice(start + 2, markerEnd) +
            '"';
          const end = this.findDelimiter(markerEnd + 1, closing);
          if (end < 0)
            throw new ParseFailure({ kind: "INCOMPLETE_STRING", start, end: this.text.length });
          this.offset = end + closing.length;
          return this.emit("STR_CONST", start, this.offset);
        }
      }
      if (c === '"' || c === "'" || c === "`") {
        this.offset++;
        let closed = false;
        while (this.offset < this.text.length) {
          this.scanCheckpoint(this.offset);
          const q = this.text[this.offset++];
          if (q === "\\") {
            this.offset++;
            continue;
          }
          if (q === c) {
            closed = true;
            break;
          }
        }
        if (!closed)
          throw new ParseFailure({ kind: "INCOMPLETE_STRING", start, end: this.text.length });
        return this.emit(c === "`" ? "SYMBOL" : "STR_CONST", start, this.offset);
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(this.text[this.offset + 1] ?? ""))) {
        // Bound work before the anchored numeric spelling matcher examines a long token.
        let numericEnd = start;
        while (/[0-9a-fA-FxXpP.eE+\-Li]/.test(this.text[numericEnd] ?? "")) {
          // A sign belongs to a number only immediately after an exponent marker. Without
          // this boundary, every number in a flat sum rescans the entire remaining sum.
          const unit = this.text[numericEnd];
          if ((unit === "+" || unit === "-") && !/[eEpP]/.test(this.text[numericEnd - 1] ?? ""))
            break;
          this.scanCheckpoint(numericEnd++);
        }
        const number =
          /^(?:0[xX][0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?(?:[pP][+-]?[0-9]+)?|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)[Li]?/.exec(
            this.text.slice(start, numericEnd),
          );
        this.offset += number?.[0].length ?? 1;
        return this.emit("NUM_CONST", start, this.offset);
      }
      if (/[\p{L}._]/u.test(c)) {
        this.offset += c.length;
        while (/[\p{L}\p{N}._]/u.test(this.pointAt(this.offset))) {
          this.scanCheckpoint(this.offset);
          this.offset += this.pointAt(this.offset).length;
        }
        const word = this.text.slice(start, this.offset);
        return this.emit(keywords[word] ?? "SYMBOL", start, this.offset);
      }
      if (c === "%") {
        this.offset++;
        while (
          this.offset < this.text.length &&
          this.text[this.offset] !== "%" &&
          this.text[this.offset] !== "\n"
        )
          this.scanCheckpoint(this.offset++);
        if (this.text[this.offset] === "%") {
          this.offset++;
          return this.emit("SPECIAL", start, this.offset);
        }
        throw new ParseFailure({ kind: "ERROR", start, end: this.offset });
      }
      if (this.text.startsWith("=>", start))
        throw new ParseFailure({ kind: "PIPEBIND", start, end: start + 2 }, "disabled-feature");
      for (const [spelling, kind] of Object.entries(operators)) {
        if (this.text.startsWith(spelling, start)) {
          this.offset += spelling.length;
          return this.emit(kind, start, this.offset);
        }
      }
      this.offset += c.length;
      return this.emit(c, start, this.offset);
    }
    return { kind: "EOF", id: this.tick(), start: this.text.length, end: this.text.length };
  }
  private peek(): EventNode {
    if (!this.look) this.look = this.scan();
    while (this.look.kind === "NL") {
      if (this.ignoreNL > 0) {
        this.look = this.scan();
        continue;
      }
      if (this.bodyElse > 0 && this.braceDepth > 0 && !this.look.checked) {
        if (this.followedByElse(this.look.end)) {
          this.look = this.scan();
          continue;
        }
        this.hidden();
        this.look.checked = true;
      }
      break;
    }
    return this.look;
  }
  private take(): EventNode {
    const token = this.peek();
    this.look = null;
    return token;
  }
  private expected(kind: string): EventNode {
    const token = this.peek();
    if (token.kind !== kind) throw new ParseFailure(token);
    return this.take();
  }
  private leading(): void {
    while (this.peek().kind === "NL") this.take();
  }
  public run(): ParseDataResult {
    if (this.options.maxExpressions === 0) return this.finish();
    try {
      while (true) {
        const token = this.peek();
        if (token.kind === "EOF") break;
        if (token.kind === "NL") {
          this.take();
          this.hidden();
          this.consumed = token.end;
          continue;
        }
        const expr = this.top();
        const delimiter = this.peek();
        if (delimiter.kind !== "NL" && delimiter.kind !== ";" && delimiter.kind !== "EOF")
          throw new ParseFailure(delimiter);
        this.roots.push(expr);
        this.selectedCount++;
        this.hidden();
        if (delimiter.kind !== "EOF") {
          this.take();
          this.consumed = delimiter.end;
        } else this.consumed = this.text.length;
        if (this.selectedCount === (this.options.maxExpressions ?? -1)) break;
      }
      if (this.look?.kind === "EOF") this.consumed = this.text.length;
    } catch (error) {
      if (!(error instanceof ParseFailure)) throw error;
      this.diagnostic = {
        kind: error.kind,
        offset: error.token.start,
        ...(error.token.kind === "EOF" ? {} : { token: error.token.kind }),
      };
      this.consumed = Math.min(this.text.length, Math.max(this.offset, error.token.end));
      if (error.kind === "disabled-feature") this.records = [];
    }
    return this.finish();
  }
  private finish(): ParseDataResult {
    this.associateComments();
    return {
      records: this.records,
      consumedOffset: this.consumed,
      selectedCount: this.selectedCount,
      ...(this.diagnostic ? { diagnostic: this.diagnostic } : {}),
      sourceDirectives: this.directives,
    };
  }
  private associateComments(): void {
    let expressionCount = 0,
      commentCount = 0;
    for (let index = 0; index < this.records.length; index++) {
      if ((index & 255) === 0) this.options.checkpoint?.();
      const record = this.records[index]!;
      if (!record.terminal && record.token === "expr") expressionCount++;
      if (record.token === "COMMENT") commentCount++;
    }
    if (commentCount === 0) return;
    // Reserve both indexes and heap slots before constructing them. Entries reference existing
    // records; no per-comment expression copies or sorts are needed.
    this.options.allocate?.(expressionCount);
    this.options.allocate?.(commentCount);
    this.options.allocate?.(expressionCount);
    const expressions: MutableRecord[] = [],
      comments: MutableRecord[] = [];
    for (const record of this.records) {
      this.options.checkpoint?.();
      if (!record.terminal && record.token === "expr") expressions.push(record);
      if (record.token === "COMMENT") comments.push(record);
    }
    const byStart = (a: MutableRecord, b: MutableRecord): number => {
      this.options.checkpoint?.();
      return a.startOffset - b.startOffset || a.endOffset - b.endOffset || a.id - b.id;
    };
    expressions.sort(byStart);
    comments.sort(byStart);
    const heap: MutableRecord[] = [];
    const earlier = (a: MutableRecord, b: MutableRecord): boolean => {
      this.options.checkpoint?.();
      return (
        a.endOffset - a.startOffset < b.endOffset - b.startOffset ||
        (a.endOffset - a.startOffset === b.endOffset - b.startOffset && a.id < b.id)
      );
    };
    const push = (record: MutableRecord): void => {
      let index = heap.length;
      heap.push(record);
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (!earlier(record, heap[parent]!)) break;
        heap[index] = heap[parent]!;
        index = parent;
      }
      heap[index] = record;
    };
    const pop = (): void => {
      const last = heap.pop()!;
      if (heap.length === 0) return;
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        this.options.checkpoint?.();
        let child = index * 2 + 1;
        if (child + 1 < heap.length && earlier(heap[child + 1]!, heap[child]!)) child++;
        if (!earlier(heap[child]!, last)) break;
        heap[index] = heap[child]!;
        index = child;
      }
      heap[index] = last;
    };
    let expressionIndex = 0,
      rootIndex = 0;
    for (const comment of comments) {
      this.options.checkpoint?.();
      while (
        expressionIndex < expressions.length &&
        expressions[expressionIndex]!.startOffset <= comment.startOffset
      ) {
        this.options.checkpoint?.();
        push(expressions[expressionIndex++]!);
      }
      // Comments are nonoverlapping lexical tokens in start order, so their endpoints increase.
      // Once an interval ends before a comment ends, it cannot contain any later comment.
      while (heap.length > 0 && heap[0]!.endOffset < comment.endOffset) {
        this.options.checkpoint?.();
        pop();
      }
      while (rootIndex < this.roots.length && this.roots[rootIndex]!.start < comment.endOffset) {
        this.options.checkpoint?.();
        rootIndex++;
      }
      const nextRoot = this.roots[rootIndex]?.id;
      comment.parent = heap[0]?.id ?? (nextRoot === undefined ? 0 : -nextRoot);
    }
  }
  private top(min = 0): EventNode {
    this.enter();
    try {
      let left = this.expr(0);
      this.hidden();
      while ((this.peek().kind === "EQ_ASSIGN" ? 2 : this.peek().kind === "?" ? 1 : -1) >= min) {
        const operator = this.take();
        this.leading();
        const right = this.top(2);
        left = this.reduce([left, operator, right], "expr_or_assign_or_help");
      }
      return left;
    } finally {
      this.leave();
    }
  }
  private expr(min = 0): EventNode {
    this.enter();
    try {
      let left = this.primary();
      while (true) {
        const next = this.peek();
        if (next.kind === "(" || next.kind === "[" || next.kind === "LBB") {
          if (17 < min) break;
          left = this.call(left);
          continue;
        }
        if (next.kind === "$" || next.kind === "@") {
          if (16 < min) break;
          const operator = this.take();
          this.leading();
          const member = this.peek();
          if (member.kind !== "SYMBOL" && member.kind !== "STR_CONST")
            throw new ParseFailure(member);
          this.take();
          if (operator.kind === "@" && member.kind === "SYMBOL") this.relabel(member, "SLOT");
          left = this.reduce([left, operator, member]);
          if (operator.kind === "$") left.callName = member;
          continue;
        }
        const p = precedence[next.kind];
        if (p === undefined || p < min) break;
        const operator = this.take();
        this.leading();
        const right = this.expr(
          p + (operator.kind === "^" || operator.kind === "LEFT_ASSIGN" ? 0 : 1),
        );
        left = this.reduce([left, operator, right]);
      }
      return left;
    } finally {
      this.leave();
    }
  }
  private primary(): EventNode {
    this.leading();
    const token = this.take();
    if (["NUM_CONST", "NULL_CONST", "BREAK", "NEXT", "PLACEHOLDER"].includes(token.kind))
      return this.reduce([token]);
    if (token.kind === "SYMBOL" || token.kind === "STR_CONST") {
      const next = this.peek();
      if (next.kind === "NS_GET" || next.kind === "NS_GET_INT") {
        const operator = this.take(),
          member = this.peek();
        if (member.kind !== "SYMBOL" && member.kind !== "STR_CONST") throw new ParseFailure(member);
        this.take();
        if (token.kind === "SYMBOL") this.relabel(token, "SYMBOL_PACKAGE");
        const node = this.reduce([token, operator, member]);
        node.callName = member;
        return node;
      }
      const node = this.reduce([token]);
      node.callName = token;
      return node;
    }
    if (["+", "-", "!", "~", "?"].includes(token.kind)) {
      this.leading();
      const value =
        token.kind === "?"
          ? this.top()
          : this.expr(token.kind === "!" ? 7 : token.kind === "~" ? 4 : 13);
      return this.reduce([token, value]);
    }
    if (token.kind === "(") {
      const previous = this.ignoreNL;
      this.ignoreNL++;
      const body = this.top();
      const close = this.expected(")");
      this.ignoreNL = previous;
      return this.reduce([token, body, close]);
    }
    if (token.kind === "{") return this.block(token);
    if (token.kind === "FUNCTION" || token.kind === "\\") return this.func(token);
    if (
      token.kind === "IF" ||
      token.kind === "WHILE" ||
      token.kind === "FOR" ||
      token.kind === "REPEAT"
    )
      return this.control(token);
    throw new ParseFailure(token);
  }
  private call(head: EventNode): EventNode {
    const open = this.take(),
      closeKind = open.kind === "(" ? ")" : "]";
    const previous = this.ignoreNL;
    this.ignoreNL++;
    const children = [head, open];
    while (true) {
      let token = this.peek();
      if (token.kind === closeKind || token.kind === ",") {
        this.hidden();
      } else {
        let name: EventNode | null = null;
        if (token.kind === "SYMBOL" || token.kind === "STR_CONST" || token.kind === "NULL_CONST") {
          this.take();
          if (this.peek().kind === "EQ_ASSIGN") {
            name = token;
            const equal = this.take();
            if (name.kind === "SYMBOL") this.relabel(name, "SYMBOL_SUB");
            this.relabel(equal, "EQ_SUB");
            children.push(name, equal);
          } else this.unread(token);
        }
        if (name && (this.peek().kind === closeKind || this.peek().kind === ",")) {
          this.hidden(2);
        } else {
          children.push(this.expr(0));
          this.hidden(3);
        }
      }
      token = this.peek();
      if (token.kind === ",") {
        children.push(this.take());
        continue;
      }
      if (token.kind !== closeKind) throw new ParseFailure(token);
      children.push(this.take());
      if (open.kind === "LBB") children.push(this.expected("]"));
      this.ignoreNL = previous;
      const result = this.reduce(children);
      if (open.kind === "(" && head.callName?.kind === "SYMBOL")
        this.relabel(head.callName, "SYMBOL_FUNCTION_CALL");
      return result;
    }
  }
  private func(keyword: EventNode): EventNode {
    const children = [keyword];
    this.leading();
    children.push(this.expected("("));
    const previous = this.ignoreNL;
    this.ignoreNL++;
    if (this.peek().kind !== ")") {
      while (true) {
        const name = this.peek();
        if (name.kind !== "SYMBOL") throw new ParseFailure(name);
        children.push(this.take());
        const next = this.peek();
        if (next.kind === "EQ_ASSIGN") {
          const eq = this.take();
          children.push(eq);
          const value = this.expr();
          children.push(value);
          this.relabel(name, "SYMBOL_FORMALS");
          this.relabel(eq, "EQ_FORMALS");
          this.hidden(2);
        } else {
          this.relabel(name, "SYMBOL_FORMALS");
          this.hidden();
        }
        if (this.peek().kind !== ",") break;
        children.push(this.take());
      }
    }
    children.push(this.expected(")"));
    this.ignoreNL = previous;
    this.leading();
    children.push(this.top());
    return this.reduce(children);
  }
  private control(keyword: EventNode): EventNode {
    const children = [keyword];
    if (keyword.kind !== "REPEAT") {
      this.leading();
      const open = this.expected("(");
      const previous = this.ignoreNL;
      this.ignoreNL++;
      if (keyword.kind === "FOR") {
        const name = this.expected("SYMBOL"),
          inside = this.expected("IN"),
          sequence = this.expr();
        this.hidden();
        const close = this.expected(")");
        children.push(this.reduce([open, name, inside, sequence, close], "forcond"));
      } else {
        const condition = this.expr();
        this.hidden();
        const close = this.expected(")");
        children.push(open, condition, close);
        this.hidden();
      }
      this.ignoreNL = previous;
    }
    this.leading();
    if (keyword.kind === "IF") this.bodyElse++;
    children.push(this.top());
    if (keyword.kind === "IF") this.bodyElse--;
    if (keyword.kind === "IF" && this.peek().kind === "ELSE") {
      children.push(this.take());
      this.leading();
      children.push(this.top());
    }
    return this.reduce(children);
  }
  private block(open: EventNode): EventNode {
    const previous = this.ignoreNL;
    this.ignoreNL = 0;
    this.braceDepth++;
    let list: EventNode | null = null;
    this.leading();
    while (this.peek().kind !== "}") {
      if (this.peek().kind === "EOF") throw new ParseFailure(this.peek());
      if (this.peek().kind === ";" || this.peek().kind === "NL") {
        const sep = this.take();
        if (!list) this.leading();
        const next = this.peek();
        if (next.kind === ";" || next.kind === "NL" || next.kind === "}" || next.kind === "EOF") {
          const empty = !list;
          list = this.reduce([list, sep], "exprlist", sep.kind === ";");
          if (empty) {
            list.start = open.start;
            if (list.record) list.record.startOffset = open.start;
          }
        } else {
          const expr = this.top();
          list = this.reduce([list, sep, expr], "exprlist", false);
        }
        continue;
      }
      if (list) throw new ParseFailure(this.peek());
      const expr = this.top();
      list = this.reduce([expr], "exprlist", false);
    }
    const close = this.take();
    this.braceDepth--;
    this.ignoreNL = previous;
    return this.reduce([open, list, close]);
  }
}
