import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

export function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${command} exited with ${code ?? `signal ${signal ?? "unknown"}`}${
              stderr === "" ? "" : `\n${stderr}`
            }`,
          ),
        );
      }
    });
  });
}

export function runNode(script, arguments_ = [], options = {}) {
  return run(process.execPath, [script, ...arguments_], options);
}

export async function runNodeWithWindowsLockRetry(script, arguments_ = [], options = {}) {
  const attempts = process.platform === "win32" ? 4 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runNode(script, arguments_, { ...options, capture: true });
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      return;
    } catch (error) {
      if (attempt === attempts || !transientWindowsFileLock(error)) throw error;
      process.stderr.write(
        `Retrying build after a Windows file lock (${attempt}/${attempts - 1}).\n`,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
}

export function runPnpm(arguments_, options = {}) {
  const pnpmEntry = process.env.npm_execpath;
  if (pnpmEntry === undefined) {
    throw new Error("This script must be launched through pnpm so npm_execpath is available.");
  }
  return run(process.execPath, [pnpmEntry, ...arguments_], options);
}

export async function removeGeneratedPath(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove unsafe generated path: ${resolvedTarget}`);
  }
  const attempts = process.platform === "win32" ? 4 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(resolvedTarget, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts || !transientWindowsFileLock(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
}

function transientWindowsFileLock(error) {
  return process.platform === "win32" && /\b(?:EPERM|EBUSY)\b/.test(String(error));
}
