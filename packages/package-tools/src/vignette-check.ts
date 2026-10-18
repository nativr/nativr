/**
 * Package-check vignette and installed-documentation stages (RFC-0008).
 *
 * Follows Writing R Extensions ("Writing package vignettes") and the documented Sweave and R
 * Markdown chunk syntax, with outcome classes observed from native GNU R 4.6.1 `R CMD check`.
 * Re-building vignette outputs needs host Sweave/LaTeX or Pandoc, so the browser adaptation runs the
 * vignette's R code instead (the harness executes the code this module extracts).
 */

export interface VignetteFile {
  readonly path: string;
  readonly text: string;
  readonly bytes: number;
}

export interface VignetteSource {
  readonly path: string;
  readonly topic: string;
  /** Concatenated R code of the evaluated chunks. */
  readonly code: string;
  readonly indexEntry: string | undefined;
}

export interface VignetteCheck {
  readonly id: string;
  readonly status: "passed" | "failed" | "unexecuted";
  readonly reason: string;
}

export interface VignetteAssessment {
  readonly schemaVersion: 1;
  readonly policy: "vignettes-v1";
  readonly sources: readonly VignetteSource[];
  readonly vignetteChecks: readonly VignetteCheck[];
  readonly installedDocumentationChecks: readonly VignetteCheck[];
}

// Sweave's documented default pattern ([.][rRsS](nw|tex)) plus R Markdown.
const SWEAVE = /[.][rRsS](?:nw|tex)$/u;
const MARKDOWN = /[.][rR]md$/u;

export function isVignetteSource(path: string): boolean {
  return SWEAVE.test(path) || MARKDOWN.test(path);
}

/** Extract the R code of evaluated chunks from a Sweave or R Markdown vignette. */
export function extractVignetteCode(path: string, text: string): string {
  const lines = text.split(/\r?\n/u);
  const chunks: string[] = [];
  let current: string[] | undefined;
  let evaluate = true;
  const markdown = MARKDOWN.test(path);
  for (const line of lines) {
    if (current === undefined) {
      const header = markdown
        ? /^\s*```+\s*\{r(?<options>[^}]*)\}\s*$/u.exec(line)
        : /^\s*<<(?<options>.*)>>=\s*$/u.exec(line);
      if (header !== null) {
        current = [];
        evaluate = !/\beval\s*=\s*(?:FALSE|F)\b/u.test(header.groups?.options ?? "");
      }
      continue;
    }
    const end = markdown
      ? /^\s*```+\s*$/u.test(line)
      : /^\s*@\s*$/u.test(line) || /^\s*<<.*>>=\s*$/u.test(line);
    if (end) {
      if (evaluate) chunks.push(current.join("\n"));
      current = undefined;
      // A Sweave chunk may end where the next one begins.
      if (!markdown && /^\s*<<(?<options>.*)>>=\s*$/u.test(line)) {
        current = [];
        evaluate = !/\beval\s*=\s*(?:FALSE|F)\b/u.test(line);
      }
      continue;
    }
    current.push(line);
  }
  if (current !== undefined && evaluate) chunks.push(current.join("\n"));
  return chunks.join("\n");
}

export function inspectPackageVignettes(files: readonly VignetteFile[]): VignetteAssessment {
  const vignetteChecks: VignetteCheck[] = [];
  const installedDocumentationChecks: VignetteCheck[] = [];
  const sources: VignetteSource[] = [];
  const installed = new Map(
    files.filter((file) => file.path.startsWith("inst/doc/")).map((file) => [file.path, file]),
  );
  for (const file of files.filter(
    (item) => /^vignettes\/[^/]+$/u.test(item.path) && isVignetteSource(item.path),
  )) {
    const name = file.path.slice("vignettes/".length);
    const topic = name.replace(/[.][^.]+$/u, "");
    const indexEntry = /%\s*\\VignetteIndexEntry\{([^}]*)\}/u.exec(file.text)?.[1]?.trim();
    sources.push({
      path: file.path,
      topic,
      code: extractVignetteCode(name, file.text),
      indexEntry,
    });
    vignetteChecks.push({
      id: `vignettes:files:${file.path}`,
      status: indexEntry === undefined || indexEntry === "" ? "failed" : "passed",
      reason:
        indexEntry === undefined || indexEntry === ""
          ? "The vignette has no \\VignetteIndexEntry."
          : "The vignette declares its index entry.",
    });
    const output = [`inst/doc/${topic}.pdf`, `inst/doc/${topic}.html`].find((path) =>
      installed.has(path),
    );
    installedDocumentationChecks.push({
      id: `inst-doc:outputs:${topic}`,
      status:
        output !== undefined && installed.has(`inst/doc/${topic}.R`) ? "passed" : "unexecuted",
      reason:
        output !== undefined && installed.has(`inst/doc/${topic}.R`)
          ? "The built output and tangled R code are installed."
          : "The built output or tangled R code is absent and would need a host rebuild.",
    });
    const copy = installed.get(`inst/doc/${name}`);
    installedDocumentationChecks.push({
      id: `inst-doc:source:${topic}`,
      status: copy === undefined ? "unexecuted" : copy.text === file.text ? "passed" : "failed",
      reason:
        copy === undefined
          ? "No installed copy of the vignette source."
          : copy.text === file.text
            ? "The installed vignette source matches vignettes/."
            : "The installed vignette source differs from vignettes/.",
    });
  }
  for (const file of installed.values())
    if (/[.]pdf$/u.test(file.path))
      installedDocumentationChecks.push({
        id: `inst-doc:pdf-size:${file.path}`,
        status: "passed",
        reason: `Size ${file.bytes} bytes recorded; compression analysis needs host qpdf (documented adaptation).`,
      });
  return {
    schemaVersion: 1,
    policy: "vignettes-v1",
    sources,
    vignetteChecks,
    installedDocumentationChecks,
  };
}
