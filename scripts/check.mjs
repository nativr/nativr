import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPnpm } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
await import("./builtin-package-owners.mjs?check");
for (const command of [
  ["format:check"],
  ["research:usage:check"],
  ["features:check"],
  ["corpus:check"],
  ["compatibility:check"],
  ["inventory:test"],
  ["benchmark:browser:test"],
  ["conformance:r:v2:test"],
  ["oracle:discovery:test"],
  ["evidence:packages:test"],
  ["testing:assisted:test"],
  ["inventory:check"],
  ["lint"],
  ["boundaries"],
  ["typecheck"],
  ["typecheck:all"],
  ["grammar:build"],
  ["test"],
  ["build"],
  ["capabilities:check"],
  ["status:check"],
  ["audit:browser"],
  ["size"],
]) {
  await runPnpm(command, { cwd: root });
}
