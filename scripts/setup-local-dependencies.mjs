import { mkdir, lstat, realpath, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceModules = path.join(root, "node_modules");
const localModules = path.resolve(
  process.env.NATIVR_LOCAL_DEPS_DIR ??
    path.join(defaultCacheRoot(), "NativR", "dependencies", "node_modules"),
);

if (samePath(workspaceModules, localModules)) {
  throw new Error("The local dependency target must be outside the NativR workspace.");
}

await mkdir(localModules, { recursive: true });

try {
  const entry = await lstat(workspaceModules);
  if (!entry.isSymbolicLink()) {
    throw new Error(
      [
        `${workspaceModules} already exists as a regular directory.`,
        "Remove or move it intentionally, then run this setup command again.",
      ].join(" "),
    );
  }
  const currentTarget = await realpath(workspaceModules);
  if (!samePath(currentTarget, localModules)) {
    throw new Error(`${workspaceModules} already points to ${currentTarget}, not ${localModules}.`);
  }
  console.log(`Local dependency link already configured: ${workspaceModules} -> ${localModules}`);
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  await symlink(localModules, workspaceModules, process.platform === "win32" ? "junction" : "dir");
  console.log(`Created local dependency link: ${workspaceModules} -> ${localModules}`);
}

console.log("Next: pnpm install --frozen-lockfile");

function defaultCacheRoot() {
  const homeDirectory = os.homedir();
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA ?? path.join(homeDirectory, "AppData", "Local");
  }
  if (process.platform === "darwin") {
    return path.join(homeDirectory, "Library", "Caches");
  }
  return process.env.XDG_CACHE_HOME ?? path.join(homeDirectory, ".cache");
}

function samePath(left, right) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}
