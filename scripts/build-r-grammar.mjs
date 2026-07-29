import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Language, Parser } from "web-tree-sitter";

import { runNode } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const grammarRoot = path.join(root, "node_modules", "@davisvaughan", "tree-sitter-r");
const webTreeSitterRoot = path.join(root, "node_modules", "web-tree-sitter");
const cliEntry = path.join(root, "node_modules", "tree-sitter-cli", "cli.js");
const outputRoot = path.join(root, "packages", "parser", "assets");
const grammarWasm = path.join(outputRoot, "tree-sitter-r.wasm");
const runtimeWasm = path.join(outputRoot, "web-tree-sitter.wasm");
const licensesRoot = path.join(outputRoot, "licenses");

await mkdir(outputRoot, { recursive: true });
await mkdir(licensesRoot, { recursive: true });

await runNode(cliEntry, ["build", "--wasm", "--output", grammarWasm, grammarRoot], { cwd: root });
await cp(path.join(webTreeSitterRoot, "web-tree-sitter.wasm"), runtimeWasm);
await cp(path.join(grammarRoot, "LICENSE"), path.join(licensesRoot, "tree-sitter-r.LICENSE"));
await cp(
  path.join(webTreeSitterRoot, "LICENSE"),
  path.join(licensesRoot, "web-tree-sitter.LICENSE"),
);

const parser = await initializeParser(runtimeWasm, grammarWasm);
const tree = parser.parse("1 + 1");
if (tree === null || tree.rootNode.hasError) {
  throw new Error("Generated R grammar failed the required ABI parse smoke test.");
}
tree.delete();
parser.delete();

const manifest = {
  schemaVersion: 1,
  treeSitterCli: "0.26.11",
  webTreeSitter: "0.26.11",
  rGrammar: {
    package: "@davisvaughan/tree-sitter-r",
    version: "1.3.0",
    repository: "https://github.com/r-lib/tree-sitter-r",
    license: "MIT",
  },
  files: {
    "tree-sitter-r.wasm": await sha256(grammarWasm),
    "web-tree-sitter.wasm": await sha256(runtimeWasm),
  },
};
await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Built Tree-sitter R grammar: ${path.relative(root, grammarWasm)}`);
console.log(`Grammar ABI smoke test: passed`);

async function initializeParser(runtime, grammar) {
  await Parser.init({ locateFile: () => runtime });
  const language = await Language.load(grammar);
  const parserInstance = new Parser();
  parserInstance.setLanguage(language);
  return parserInstance;
}

async function sha256(file) {
  const bytes = await readFile(file);
  return createHash("sha256").update(bytes).digest("hex");
}
