import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

/** Parse the optional executable override accepted by the native conformance CLIs. */
export function parseRscriptArguments(arguments_) {
  let rscript;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument !== "--rscript") throw new Error(`Unknown argument: ${argument}`);
    if (rscript !== undefined) throw new Error("--rscript may only be supplied once.");
    const value = arguments_[++index];
    if (value === undefined || value.startsWith("--"))
      throw new Error("Missing value for --rscript.");
    validateExecutable(value, "--rscript");
    rscript = value;
  }
  return rscript === undefined ? {} : { rscript };
}

/**
 * Node-only development oracle discovery. Availability does not establish a GNU R version:
 * callers retain their existing normative/advisory version gates before collecting evidence.
 * Explicit CLI/env choices never fall back or become an optional missing-oracle skip.
 */
export async function findRscript(options = {}, dependencies = {}) {
  const environment = dependencies.env ?? process.env;
  const platform = dependencies.platform ?? process.platform;
  const run = dependencies.spawnSync ?? spawnSync;
  const readDirectory = dependencies.readdir ?? readdir;
  const selected =
    options.rscript !== undefined
      ? { executable: options.rscript, source: "--rscript" }
      : environment.NATIVR_RSCRIPT !== undefined
        ? { executable: environment.NATIVR_RSCRIPT, source: "NATIVR_RSCRIPT" }
        : undefined;

  function probe(executable) {
    try {
      const result = run(executable, ["--version"], {
        env: environment,
        encoding: "utf8",
        windowsHide: true,
        shell: false,
        timeout: 5_000,
        maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return result.error === undefined && result.status === 0 && result.signal == null;
    } catch {
      return false;
    }
  }

  if (selected !== undefined) {
    validateExecutable(selected.executable, selected.source);
    if (!probe(selected.executable))
      throw new Error(
        `Rscript selected by ${selected.source} could not run --version. Check that executable override; automatic discovery was not attempted.`,
      );
    return selected.executable;
  }

  if (probe("Rscript")) return "Rscript";
  if (platform === "win32") {
    const localAppData =
      environment.LOCALAPPDATA ||
      (environment.USERPROFILE
        ? path.win32.join(environment.USERPROFILE, "AppData", "Local")
        : undefined);
    const roots = [
      ...(localAppData === undefined ? [] : [path.win32.join(localAppData, "Programs", "R")]),
      path.win32.join(environment.ProgramFiles || String.raw`C:\Program Files`, "R"),
    ];
    for (const root of new Set(roots)) {
      let entries;
      try {
        entries = await readDirectory(root, { withFileTypes: true });
      } catch {
        continue;
      }
      const names = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) =>
          right.localeCompare(left, "en", { numeric: true, sensitivity: "variant" }),
        );
      for (const name of names) {
        const candidate = path.win32.join(root, name, "bin", "Rscript.exe");
        if (probe(candidate)) return candidate;
      }
    }
  }

  if (options.required)
    throw new Error(
      "GNU R is required for this command, but Rscript was not found. Supply --rscript PATH or NATIVR_RSCRIPT.",
    );
  return undefined;
}

function validateExecutable(value, source) {
  if (typeof value !== "string" || value.trim().length === 0 || value.includes("\0"))
    throw new Error(`${source} requires a nonempty executable path or command name.`);
}
