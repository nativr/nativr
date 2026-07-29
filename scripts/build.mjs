import path from "node:path";
import { fileURLToPath } from "node:url";

import { removeGeneratedPath, runNode } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
await runNode(path.join(root, "scripts", "build-r-grammar.mjs"), [], { cwd: root });
await removeGeneratedPath(root, path.join(root, "packages", "nativr", "dist"));
await runNode(tsc, ["-b"], { cwd: root });
await runNode(path.join(root, "scripts", "copy-parser-assets.mjs"), [], { cwd: root });
await runNode(path.join(root, "scripts", "copy-package-metadata.mjs"), [], { cwd: root });
await runNode(vite, ["build"], { cwd: path.join(root, "packages", "nativr") });
await runNode(path.join(root, "scripts", "copy-parser-assets.mjs"), [], { cwd: root });
await runNode(vite, ["build"], { cwd: path.join(root, "apps", "playground") });
