import type { Diagnostic, ParseWorkCallbacks, ProgramNode, RetainedParseResult } from "@nativr/ast";
import { Language, Parser } from "web-tree-sitter";

import { normalizeProgram } from "./normalize.js";
import { buildParseData } from "./parse-data.js";
export { Utf8SourceMap } from "./source-map.js";

/** URLs required to initialize the browser-compatible Tree-sitter parser. */
export interface ParserAssets {
  readonly treeSitterRuntimeWasm: string | URL;
  readonly rGrammarWasm: string | URL;
}

/** Stable parser output containing a normalized AST and diagnostics. */
export interface ParseResult {
  readonly ast: ProgramNode;
  readonly diagnostics: readonly Diagnostic[];
}

/** A small facade that owns Tree-sitter resources while exposing only NativR AST values. */
export interface NativRParser {
  parse(source: string): ParseResult;
  parseDetailed(
    source: string,
    maxExpressions?: number,
    work?: ParseWorkCallbacks,
  ): RetainedParseResult;
  dispose(): void;
}

let initializedRuntime: Promise<void> | undefined;

// web-tree-sitter's runtime accepts URL objects through both fetch and Node's
// fs.readFile implementation, but its current declaration only lists strings.
const languageLoader = Language as unknown as {
  load(input: string | URL): Promise<Language>;
};

/**
 * Load the pinned parser runtime and grammar Wasm, validating their ABI through setLanguage.
 */
export async function createParser(assets: ParserAssets): Promise<NativRParser> {
  try {
    initializedRuntime ??= Parser.init({
      locateFile: () => String(assets.treeSitterRuntimeWasm),
    });
    await initializedRuntime;
  } catch (cause) {
    initializedRuntime = undefined;
    throw parserAssetError("NRP1101", "Unable to initialize the Tree-sitter runtime asset.", cause);
  }

  let language: Language;
  try {
    language = await languageLoader.load(normalizeGrammarAsset(assets.rGrammarWasm));
  } catch (cause) {
    throw parserAssetError("NRP1102", "Unable to load the Tree-sitter R grammar asset.", cause);
  }

  const parser = new Parser();
  try {
    parser.setLanguage(language);
  } catch (cause) {
    parser.delete();
    throw parserAssetError(
      "NRP1103",
      "The Tree-sitter runtime and R grammar use incompatible ABIs.",
      cause,
    );
  }

  let disposed = false;
  function parse(source: string, work?: ParseWorkCallbacks): ParseResult {
    if (disposed) {
      throw parserAssetError("NRP1104", "The parser has been disposed.");
    }
    const tree = parser.parse(source);
    if (tree === null) {
      throw parserAssetError("NRP1105", "Tree-sitter did not return a syntax tree.");
    }
    try {
      return normalizeProgram(tree.rootNode, source, work);
    } finally {
      tree.delete();
    }
  }
  return {
    parse,
    parseDetailed(source, maxExpressions, work): RetainedParseResult {
      const data = buildParseData(source, {
        ...(maxExpressions === undefined ? {} : { maxExpressions }),
        ...work,
      });
      // The event route consumes one virtual final newline. Parse only the consumed prefix so
      // a finite n does not let a later syntax error alter Tree-sitter's earlier recovery nodes.
      const effective = `${source}\n`.slice(0, data.consumedOffset);
      const parsed = parse(effective, work);
      return {
        ...parsed,
        ast: { ...parsed.ast, body: parsed.ast.body.slice(0, data.selectedCount) },
        data,
      };
    },
    dispose(): void {
      if (!disposed) {
        disposed = true;
        parser.delete();
      }
    },
  };
}

function normalizeGrammarAsset(asset: string | URL): string | URL {
  return typeof asset === "string" && asset.startsWith("file:") ? new URL(asset) : asset;
}

function parserAssetError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = code;
  return error;
}
