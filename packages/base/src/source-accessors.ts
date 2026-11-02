import {
  R_NULL,
  REvaluationError,
  RResourceLimitError,
  characterVector,
  integerVector,
  isMissing,
  listValue,
  logicalCondition,
  logicalVector,
  missingValue,
  objectAttributes,
  objectClasses,
  withAttribute,
  withClasses,
} from "@nativr/runtime";
import type { BuiltinInvocation, RValue } from "@nativr/runtime";
import { matchBuiltinDefaults } from "./arguments.js";

async function baseCall(
  invocation: BuiltinInvocation,
  name: string,
  values: readonly RValue[],
): Promise<RValue> {
  const callable = await invocation.namespaceBinding("base", name);
  if (callable === undefined) throw new Error(`Missing core source-accessor operation: ${name}`);
  return invocation.invoke(
    callable,
    values.map((value) => ({ value })),
  );
}

const member = (invocation: BuiltinInvocation, value: RValue, name: string): Promise<RValue> =>
  baseCall(invocation, "$", [value, characterVector([name])]);
const inherits = (value: RValue, name: string): boolean =>
  objectClasses(value)?.includes(name) ?? false;

/** Resolve aliases without consuming the JavaScript stack or bypassing active bindings. */
async function originalSource(invocation: BuiltinInvocation, source: RValue): Promise<RValue> {
  let depth = 0;
  while (inherits(source, "srcfilealias")) {
    invocation.context.checkpoint();
    if (++depth > invocation.context.limits.maxCallDepth) {
      throw new RResourceLimitError(
        "NRL4004",
        "Source alias traversal exceeded the call-depth limit.",
      );
    }
    source = await member(invocation, source, "original");
  }
  return source;
}

export async function builtinGetSrcLines(invocation: BuiltinInvocation): Promise<RValue> {
  const bound = await matchBuiltinDefaults(invocation, [
    { name: "srcfile" },
    { name: "first" },
    { name: "last" },
  ]);
  const first = await bound.force("first");
  const last = await bound.force("last");
  if (logicalCondition(await baseCall(invocation, ">", [first, last]))) return characterVector([]);
  const source = await originalSource(invocation, await bound.force("srcfile"));
  let lines: RValue;
  const copied = inherits(source, "srcfilecopy");
  if (copied) {
    lines = await member(invocation, source, "lines");
  } else if (inherits(source, "srcfile")) {
    // readLines retains the runtime's explicit, offline file-capability boundary.
    lines = await baseCall(invocation, "readLines", [await member(invocation, source, "filename")]);
  } else {
    // Preserve ordinary member-access diagnostics for atomic inputs.
    await member(invocation, source, "filename");
    const classes = objectClasses(source) ?? [source.type];
    throw new REvaluationError(
      "NRE2350",
      `no applicable method for 'close' applied to an object of class "${classes.join(" ")}"`,
    );
  }
  const length = await baseCall(invocation, "length", [lines]);
  if (logicalCondition(await baseCall(invocation, ">", [first, length])))
    return characterVector([]);
  const end = await baseCall(invocation, "min", [last, length]);
  const positions = await baseCall(invocation, ":", [first, end]);
  // Native source-copy access observes a separate read for extraction, including active bindings.
  if (copied) lines = await member(invocation, source, "lines");
  return baseCall(invocation, "[", [lines, positions]);
}

/** Convert retained metadata without relying on parser concrete trees or executable foreign code. */
export async function builtinGetParseData(invocation: BuiltinInvocation): Promise<RValue> {
  const bound = await matchBuiltinDefaults(invocation, [{ name: "x" }, { name: "includeText" }]);
  const value = await bound.force("x");
  const attributes = objectAttributes(value);
  let source = inherits(value, "srcfile") ? value : attributes?.get("srcfile");
  if (source === undefined && value.type === "closure") {
    const reference = attributes?.get("srcref");
    if (reference !== undefined) source = objectAttributes(reference)?.get("srcfile");
  }
  if (source === undefined || source.type === "null") return R_NULL;
  const data = await member(invocation, await originalSource(invocation, source), "parseData");
  if (data.type === "null") return R_NULL;
  const dimensions = objectAttributes(data)?.get("dim");
  if (
    data.type !== "integer" ||
    dimensions?.type !== "integer" ||
    dimensions.length !== 2 ||
    dimensions.values[0] !== 8
  ) {
    throw new REvaluationError("NRE2351", "length of 'dimnames' [2] not equal to array extent");
  }
  const count = dimensions.values[1]!;
  const tokens = data.attributes.get("tokens");
  const texts = data.attributes.get("text");
  if (
    tokens?.type !== "character" ||
    texts?.type !== "character" ||
    tokens.length !== count ||
    texts.length !== count
  ) {
    throw new REvaluationError("NRE2351", `arguments imply differing number of rows: ${count}, 0`);
  }
  // Validate row identity before forcing a control expression or publishing any columns.
  invocation.context.allocate(count);
  invocation.context.allocate(count);
  const ids = new Set<number>(),
    duplicates = new Set<number>();
  for (let index = 0; index < count; index++) {
    invocation.context.checkpoint();
    const offset = index * 8 + 6;
    if (isMissing(data, offset))
      throw new REvaluationError("NRE2351", "missing values in 'row.names' are not allowed");
    const id = data.values[offset]!;
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  if (duplicates.size > 0) {
    const values: string[] = [];
    for (const id of duplicates) {
      invocation.context.checkpoint();
      values.push(`'${id}'`);
    }
    const message = `non-unique ${duplicates.size === 1 ? "value" : "values"} when setting 'row.names': ${values.join(", ")}`;
    invocation.context.allocate(message.length);
    await invocation.signalWarning(
      withClasses(
        listValue(
          [characterVector([message]), invocation.currentCall() ?? R_NULL],
          ["message", "call"],
        ),
        ["simpleWarning", "warning", "condition"],
      ),
      { code: "NRW1100", message },
    );
    throw new REvaluationError("NRE2351", "duplicate 'row.names' are not allowed");
  }
  const control = bound.supplied.has("includeText")
    ? await bound.force("includeText")
    : missingValue("logical");
  const mode = logicalCondition(await baseCall(invocation, "is.na", [control]))
    ? "default"
    : control.type === "logical" && control.values[0] === 1
      ? "full"
      : "none";
  // Reserve each working/output buffer separately: maxVectorLength is a per-vector limit,
  // while allocate also enforces the evaluation's cumulative allocation budget.
  for (let buffer = 0; buffer < 40; buffer++) invocation.context.allocate(count);
  for (let buffer = 0; buffer < 4; buffer++) invocation.context.allocate(mode === "none" ? 8 : 9);
  const order = Array.from({ length: count }, (_, index) => {
    invocation.context.checkpoint();
    return index;
  });
  order.sort((left, right) => {
    invocation.context.checkpoint();
    const a = left * 8,
      b = right * 8;
    for (const field of [0, 1, 2, 3, 6]) {
      const missingLeft = isMissing(data, a + field),
        missingRight = isMissing(data, b + field);
      if (missingLeft !== missingRight) return missingLeft ? 1 : -1;
      if (missingLeft) continue;
      const difference = data.values[a + field]! - data.values[b + field]!;
      if (difference !== 0) return field === 2 || field === 3 ? -difference : difference;
    }
    return 0;
  });
  const columns: number[][] = Array.from({ length: 6 }, () => []);
  const masks = Array.from({ length: 6 }, () => new Uint8Array(count));
  const tokenMask = new Uint8Array(count),
    terminalMask = new Uint8Array(count),
    textMask = new Uint8Array(count);
  const tokenColumn: string[] = [],
    terminalColumn: boolean[] = [],
    textColumn: string[] = [];
  let reconstructed = false;
  for (const index of order) {
    invocation.context.checkpoint();
    const offset = index * 8;
    const outputIndex = tokenColumn.length;
    for (const [column, row] of [0, 1, 2, 3, 6, 7].entries()) {
      masks[column]![outputIndex] = Number(isMissing(data, offset + row));
      columns[column]!.push(data.values[offset + row]!);
    }
    tokenMask[outputIndex] = Number(isMissing(tokens, index));
    terminalMask[outputIndex] = Number(isMissing(data, offset + 4));
    textMask[outputIndex] = Number(isMissing(texts, index));
    tokenColumn.push(tokens.values[index]!);
    terminalColumn.push(data.values[offset + 4] !== 0);
    let text = texts.values[index]!;
    if (mode === "full" && text.length === 0 && textMask[outputIndex] === 0) {
      const lines = await baseCall(invocation, "getSrcLines", [
        source,
        integerVector([data.values[offset]!], [Number(isMissing(data, offset))]),
        integerVector([data.values[offset + 2]!], [Number(isMissing(data, offset + 2))]),
      ]);
      if (lines.type !== "character")
        throw new REvaluationError("NRE2351", "Source lines must be character data.");
      const pieces: string[] = [];
      invocation.context.allocate(lines.length);
      for (let line = 0; line < lines.length; line++) {
        invocation.context.checkpoint();
        const value = lines.values[line]!;
        const start = line === 0 ? data.values[offset + 1]! : 1;
        const end = line === lines.length - 1 ? data.values[offset + 3]! : Infinity;
        let column = 1,
          startOffset = value.length,
          endOffset = 0;
        for (let at = 0; at < value.length;) {
          invocation.context.checkpoint();
          const point = value.codePointAt(at)!;
          const width = point > 0xffff ? 2 : 1;
          const next = point === 9 ? Math.floor((column - 1) / 8 + 1) * 8 + 1 : column + 1;
          if (next > start && column <= end) {
            startOffset = Math.min(startOffset, at);
            endOffset = at + width;
          }
          column = next;
          at += width;
        }
        invocation.context.allocate(Math.max(0, endOffset - startOffset));
        pieces.push(value.slice(startOffset, endOffset));
      }
      text = pieces.join("\n");
      reconstructed = true;
    }
    textColumn.push(text);
  }
  const names = ["line1", "col1", "line2", "col2", "id", "parent", "token", "terminal"];
  const values: RValue[] = [
    ...columns.map((column, index) => integerVector(column, masks[index])),
    characterVector(tokenColumn, tokenMask),
    logicalVector(terminalColumn, terminalMask),
  ];
  if (mode !== "none") {
    names.push("text");
    values.push(characterVector(textColumn, textMask));
  }
  let result = withAttribute(listValue(values, names), "row.names", integerVector(columns[4]!));
  if (mode !== "none" && !reconstructed) {
    result = withAttribute(result, "class", characterVector(["data.frame"]));
    result = withAttribute(result, "srcfile", source);
  } else {
    result = withAttribute(result, "srcfile", source);
    result = withAttribute(result, "class", characterVector(["data.frame"]));
  }
  return result;
}
