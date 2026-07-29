import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageRoot = path.join(root, "packages", "nativr");
for (const file of ["README.md", "LICENSE", "NOTICE"]) {
  await cp(path.join(root, file), path.join(packageRoot, file));
}
console.log("Copied package README and legal notices.");
