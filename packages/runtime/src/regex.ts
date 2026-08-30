const POSIX_CHARACTER_CLASS_CONTENT: Readonly<Record<string, string>> = Object.freeze({
  alnum: "A-Za-z0-9",
  alpha: "A-Za-z",
  blank: "\\t ",
  cntrl: "\\x00-\\x1f\\x7f",
  digit: "0-9",
  graph: "!-~",
  lower: "a-z",
  print: " -~",
  punct: "!-/:-@[-`{-~",
  space: "\\f\\n\\r\\t\\v ",
  upper: "A-Z",
  xdigit: "A-Fa-f0-9",
});

/**
 * Translate POSIX named bracket classes used by R's default TRE-compatible
 * regular expressions to ECMAScript character-class members. NativR's
 * browser-admissible locale profile is the deterministic C locale, so these
 * ranges are intentionally ASCII rather than host-locale dependent.
 */
export function normalizePosixCharacterClasses(pattern: string): string {
  return pattern.replace(/\[:([A-Za-z]+):\]/gu, (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    const content = POSIX_CHARACTER_CLASS_CONTENT[name];
    if (content === undefined) {
      throw new SyntaxError(`Unknown POSIX character class '${rawName}'.`);
    }
    return content;
  });
}
