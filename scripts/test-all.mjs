import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPnpm } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
await runPnpm(["test"], { cwd: root });
await runPnpm(["test:e2e"], { cwd: root });
await runPnpm(["pack:smoke"], { cwd: root });
