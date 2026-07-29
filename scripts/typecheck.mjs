import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNode } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
await runNode(tsc, ["-b", "--pretty", "false"], { cwd: root });
await runNode(tsc, ["-p", "apps/playground/tsconfig.json", "--pretty", "false"], { cwd: root });
