import type { StringLiteralNode } from "@nativr/ast";

export class StringLiteralError extends Error {}
type DecodedString = Pick<StringLiteralNode, "value" | "bytes" | "encoding">;
/** Independent decoder from R's documented quote syntax; never executes source. */
export function decodeStringLiteral(text: string, identifier = false): DecodedString {
  const raw = /^[rR](["'])(-*)([([{])/u.exec(text);
  if (raw !== null) {
    const close = raw[3] === "(" ? ")" : raw[3] === "[" ? "]" : "}";
    const ending = close + raw[2]! + raw[1]!;
    if (!text.endsWith(ending)) throw new StringLiteralError("Invalid raw string delimiter.");
    const value = text.slice(raw[0].length, -ending.length);
    if (value.includes("\0"))
      throw new StringLiteralError("NUL characters are not allowed in strings.");
    return { value };
  }
  const body = text.slice(1, -1);
  const parts: (string | number)[] = [];
  let byteEscape = false,
    unicodeEscape = false;
  const simple: Readonly<Record<string, string>> = {
    a: "\u0007",
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
    "'": "'",
    '"': '"',
    "`": "`",
    "\n": "\n",
  };
  for (let index = 0; index < body.length; index++) {
    let character = body[index]!;
    if (character !== "\\") {
      if (character === "\0")
        throw new StringLiteralError("NUL characters are not allowed in strings.");
      parts.push(character);
      continue;
    }
    character = body[++index] ?? "";
    if (Object.hasOwn(simple, character)) {
      parts.push(simple[character]!);
      continue;
    }
    if (/[0-7]/u.test(character)) {
      const digits = /^[0-7]{1,3}/u.exec(body.slice(index))![0];
      const value = Number.parseInt(digits, 8);
      if (value > 255) throw new StringLiteralError("Octal escape exceeds the maximum value 377.");
      if (value === 0) throw new StringLiteralError("NUL characters are not allowed in strings.");
      byteEscape = true;
      parts.push(value);
      index += digits.length - 1;
    } else if (character === "x" || character === "u" || character === "U") {
      const unicode = character !== "x";
      if (identifier && unicode)
        throw new StringLiteralError("Unicode escapes are not supported inside backticks.");
      const width = character === "x" ? 2 : character === "u" ? 4 : 8;
      const braced = unicode && body[index + 1] === "{";
      const start = index + (braced ? 2 : 1);
      let end = start;
      while (end < body.length && end - start < width && /^[0-9a-f]$/iu.test(body[end]!)) end++;
      if (end === start || (braced && body[end] !== "}"))
        throw new StringLiteralError("Invalid hexadecimal or Unicode escape.");
      const value = Number.parseInt(body.slice(start, end), 16);
      if (value === 0) throw new StringLiteralError("NUL characters are not allowed in strings.");
      if (value > 0x10ffff) throw new StringLiteralError("Unicode escape exceeds U+10FFFF.");
      if (unicode) {
        unicodeEscape = true;
        parts.push(String.fromCodePoint(value));
      } else {
        byteEscape = true;
        parts.push(value);
      }
      index = end - (braced ? 0 : 1);
    } else throw new StringLiteralError(`Unrecognized string escape: \\${character}`);
    if (byteEscape && unicodeEscape)
      throw new StringLiteralError("Unicode and octal/hex escapes cannot be mixed in one string.");
  }
  if (!byteEscape) {
    const value = parts.join("");
    // Browser strings cannot faithfully expose GNU R's nonstandard UTF-8 surrogate payloads.
    if (/[\uD800-\uDFFF]/u.test(value))
      throw new StringLiteralError(
        "Unpaired Unicode surrogate escapes are outside the browser string contract.",
      );
    return { value };
  }
  const bytes: number[] = [];
  let pending = "";
  const flush = () => {
    for (const byte of new TextEncoder().encode(pending)) bytes.push(byte);
    pending = "";
  };
  for (const part of parts) {
    if (typeof part === "number") {
      flush();
      bytes.push(part);
    } else pending += part;
  }
  flush();
  return {
    value: new TextDecoder("utf-8", { ignoreBOM: true }).decode(Uint8Array.from(bytes)),
    bytes: Object.freeze(bytes),
    encoding: "unknown",
  };
}
