import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = path.join(root, "packages", "parser", "assets");
const targets = [
  path.join(root, "packages", "nativr", "src", "assets"),
  path.join(root, "packages", "nativr", "dist"),
  path.join(root, "packages", "nativr", "dist", "assets"),
  path.join(root, "apps", "playground", "public", "assets"),
];

for (const target of targets) {
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
  console.log(`Copied parser assets to ${path.relative(root, target)}`);
}
