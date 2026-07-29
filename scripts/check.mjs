import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPnpm } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
for (const command of [
  ["format:check"],
  ["research:usage:check"],
  ["lint"],
  ["boundaries"],
  ["typecheck"],
  ["grammar:build"],
  ["test"],
  ["build"],
  ["audit:browser"],
  ["size"],
]) {
  await runPnpm(command, { cwd: root });
}
