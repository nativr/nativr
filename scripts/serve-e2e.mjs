import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNode } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
if (process.env.NATIVR_E2E_SKIP_BUILD !== "1") {
  await runNode(path.join(root, "scripts", "build.mjs"), [], { cwd: root });
}
await runNode(vite, ["preview"], { cwd: path.join(root, "apps", "playground") });
