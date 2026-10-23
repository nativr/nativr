import type { AstNode } from "@nativr/ast";
import type { RAttributes } from "./values.js";

/** Runtime-only metadata; executable syntax keeps its original normalized node kind. */
export interface LanguageSyntaxMetadata {
  readonly attributes: RAttributes;
  readonly headTag?: string;
  /** Plain parser function syntax has a present NULL fourth cell unless explicitly removed. */
  readonly functionSourceCellAbsent?: true;
}

const LANGUAGE_METADATA = Symbol("nativr.languageMetadata");
type LanguageSyntax = AstNode & {
  readonly [LANGUAGE_METADATA]?: LanguageSyntaxMetadata;
};

/** Read only the private runtime payload, never arbitrary fields on parser nodes. */
export function languageSyntaxMetadata(node: AstNode): LanguageSyntaxMetadata | undefined {
  return (node as LanguageSyntax)[LANGUAGE_METADATA];
}

/** Clone only a syntax root; its children and all metadata values retain their identities. */
export function withLanguageSyntaxMetadata(
  node: AstNode,
  metadata: LanguageSyntaxMetadata,
): AstNode {
  const current = languageSyntaxMetadata(node);
  if (
    current?.attributes === metadata.attributes &&
    current.headTag === metadata.headTag &&
    current.functionSourceCellAbsent === metadata.functionSourceCellAbsent
  )
    return node;
  if (
    metadata.attributes.size === 0 &&
    metadata.headTag === undefined &&
    metadata.functionSourceCellAbsent === undefined
  ) {
    if (current === undefined) return node;
    const copy = { ...node } as LanguageSyntax;
    delete (copy as { [LANGUAGE_METADATA]?: LanguageSyntaxMetadata })[LANGUAGE_METADATA];
    return copy;
  }
  return { ...node, [LANGUAGE_METADATA]: Object.freeze(metadata) } as LanguageSyntax;
}

/** The plain function's NULL source cell is structural, not a source-retention claim. */
export function functionSourceCellPresent(node: AstNode): boolean {
  return languageSyntaxMetadata(node)?.functionSourceCellAbsent !== true;
}

/** Record an explicit three-cell function without changing its executable node kind. */
export function withFunctionSourceCellPresence(node: AstNode, present: boolean): AstNode {
  const current = languageSyntaxMetadata(node);
  return withLanguageSyntaxMetadata(node, {
    attributes: current?.attributes ?? new Map(),
    ...(current?.headTag === undefined ? {} : { headTag: current.headTag }),
    ...(present ? {} : { functionSourceCellAbsent: true }),
  });
}
