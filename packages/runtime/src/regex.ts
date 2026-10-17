/** Independent C-locale POSIX bracket-class translation shared by browser regex consumers. */
const POSIX_PATTERN_CLASSES: Readonly<Record<string, string>> = Object.freeze({
  alnum: "A-Za-z0-9",
  alpha: "A-Za-z",
  blank: " \\t",
  cntrl: "\\x00-\\x1F\\x7F",
  digit: "0-9",
  graph: "\\x21-\\x7E",
  lower: "a-z",
  print: "\\x20-\\x7E",
  punct: "\\x21-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E",
  space: " \\t\\n\\v\\f\\r",
  upper: "A-Z",
  xdigit: "A-Fa-f0-9",
});

export function translatePosixCharacterClasses(pattern: string): string {
  let translated = "";
  let inBracket = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? "";
    if (character === "\\") {
      translated += pattern.slice(index, index + 2);
      index += 1;
      continue;
    }
    if (!inBracket) {
      translated += character;
      if (character === "[") {
        inBracket = true;
        if (pattern[index + 1] === "^") {
          translated += "^";
          index += 1;
        }
        if (pattern[index + 1] === "]") {
          translated += "\\]";
          index += 1;
        }
      }
      continue;
    }
    if (character === "[" && pattern[index + 1] === ":") {
      const end = pattern.indexOf(":]", index + 2);
      if (end < 0) throw new Error("Unterminated POSIX character class.");
      const name = pattern.slice(index + 2, end);
      const replacement = Object.hasOwn(POSIX_PATTERN_CLASSES, name)
        ? POSIX_PATTERN_CLASSES[name]
        : undefined;
      if (replacement === undefined)
        throw new Error(`Unsupported POSIX character class '${name}'.`);
      translated += replacement;
      index = end + 1;
      continue;
    }
    if (character === "[" && (pattern[index + 1] === "." || pattern[index + 1] === "=")) {
      throw new Error("POSIX collating elements and equivalence classes are unsupported.");
    }
    if (character === "]") inBracket = false;
    translated += character;
  }
  return translated;
}
