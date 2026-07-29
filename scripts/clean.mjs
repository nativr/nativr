import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const targets = [
  "coverage",
  "playwright-report",
  "test-results",
  ".tmp",
  "packages/ast/dist",
  "packages/parser/dist",
  "packages/parser/assets",
  "packages/runtime/dist",
  "packages/base/dist",
  "packages/protocol/dist",
  "packages/nativr/dist",
  "packages/nativr/assets",
  "packages/nativr/src/assets",
  "packages/nativr/LICENSE",
  "packages/nativr/NOTICE",
  "packages/nativr/README.md",
  "apps/playground/dist",
  "apps/playground/public/assets",
];

for (const relative of targets) {
  const target = path.resolve(root, relative);
  const withinRoot = path.relative(root, target);
  if (withinRoot.startsWith("..") || path.isAbsolute(withinRoot) || withinRoot === "") {
    throw new Error(`Refusing to remove unsafe path: ${target}`);
  }
  await rm(target, { recursive: true, force: true });
}
console.log(`Removed ${targets.length} generated paths within ${root}`);
