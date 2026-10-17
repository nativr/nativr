// Builds elementary.wasm from the pinned, unmodified CORE-MATH binary64 sources (RFC-0007 step 1).
//
//   node scripts/build-elementary-wasm.mjs           build twice from clean copies, verify the digest
//   node scripts/build-elementary-wasm.mjs --fetch   first download missing pinned sources
//   node scripts/build-elementary-wasm.mjs --record  write the reproduced digest into core-math.json
//
// Build-time tooling only: nothing here is shipped. Sources are cached outside the repository in
// NATIVR_CORE_MATH_DIR (default: <local app data>/NativR/core-math/<commit>) and every file is
// checked against its pinned SHA-256 before use. The compiler is the pinned wasi-sdk at
// NATIVR_WASI_SDK (default: the copy tree-sitter-cli installs for `pnpm grammar:build`).
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { run } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pinRoot = path.join(root, "scripts", "elementary");
const lockFile = path.join(pinRoot, "core-math.json");
const outputRoot = path.join(root, ".tmp", "elementary");
const lock = JSON.parse(await readFile(lockFile, "utf8"));
const flags = new Set(process.argv.slice(2));

const sourceRoot = process.env.NATIVR_CORE_MATH_DIR ?? defaultSourceRoot(lock.source.commit);
const wasiSdk = process.env.NATIVR_WASI_SDK ?? defaultWasiSdk();
const executable = process.platform === "win32" ? ".exe" : "";
const clang = path.join(wasiSdk, "bin", `clang${executable}`);
const llvmAr = path.join(wasiSdk, "bin", `llvm-ar${executable}`);

if (flags.has("--fetch")) await fetchSources();
await verifySources();
await verifyToolchain();

const first = await buildClean();
const second = await buildClean();
if (first.sha256 !== second.sha256) {
  throw new Error(`elementary.wasm is not reproducible: ${first.sha256} != ${second.sha256}`);
}
await verifyModule(first.bytes);

if (flags.has("--record")) {
  lock.output = { file: lock.output.file, sha256: first.sha256, bytes: first.bytes.length };
  await writeJson(lockFile, lock);
} else if (lock.output.sha256 !== first.sha256) {
  throw new Error(
    `elementary.wasm digest ${first.sha256} does not match the pinned ${String(lock.output.sha256)}. ` +
      "Rerun with --record only after reviewing a deliberate source, toolchain, or flag change.",
  );
}

await mkdir(path.join(outputRoot, "licenses"), { recursive: true });
await writeFile(path.join(outputRoot, lock.output.file), first.bytes);
await cp(
  path.join(sourceRoot, lock.source.licenseFile),
  path.join(outputRoot, "licenses", "core-math.LICENSE"),
);
const manifest = {
  schemaVersion: 1,
  source: { repository: lock.source.repository, commit: lock.source.commit, license: "MIT" },
  toolchain: lock.toolchain,
  compileFlags: lock.compileFlags,
  linkFlags: lock.linkFlags,
  files: { [lock.output.file]: first.sha256 },
};
await writeJson(path.join(outputRoot, "manifest.json"), manifest);
console.log(
  `Built ${path.relative(root, path.join(outputRoot, lock.output.file))} ` +
    `(${first.bytes.length} bytes, sha256 ${first.sha256}); two clean builds matched.`,
);

async function buildClean() {
  const work = await mkdtemp(path.join(os.tmpdir(), "nativr-elementary-"));
  try {
    const sources = path.join(work, "core-math");
    for (const file of Object.keys(lock.source.files)) {
      await mkdir(path.dirname(path.join(sources, file)), { recursive: true });
      await cp(path.join(sourceRoot, file), path.join(sources, file));
    }
    const objects = [];
    for (const name of lock.functions) {
      const object = path.join(work, `${name}.o`);
      const source = path.join(sources, "src", "binary64", name, `${name}.c`);
      await run(clang, [...lock.compileFlags, "-I", pinRoot, "-c", source, "-o", object], {
        cwd: work,
        capture: true,
      });
      objects.push(object);
    }
    const shim = path.join(work, "nativr-elementary.o");
    await run(
      clang,
      [
        ...lock.compileFlags,
        "-I",
        pinRoot,
        "-c",
        path.join(pinRoot, "nativr-elementary.c"),
        "-o",
        shim,
      ],
      { cwd: work, capture: true },
    );
    // Link only the named wasi-libc members (soft-float fma and friends, fenv stubs) and the
    // compiler-rt builtins. Linking the whole libc archive would let wasm-ld extract exit.o,
    // whose WASI process exit is an import.
    const libc = path.join(wasiSdk, "share", "wasi-sysroot", "lib", "wasm32-wasip1", "libc.a");
    await run(llvmAr, ["x", libc, ...lock.libcMembers], { cwd: work, capture: true });
    const builtins = path.join(
      wasiSdk,
      "lib",
      "clang",
      lock.toolchain.llvm.split(".")[0],
      "lib",
      "wasm32-unknown-wasip1",
      "libclang_rt.builtins.a",
    );
    const output = path.join(work, lock.output.file);
    await run(
      clang,
      [
        ...lock.compileFlags,
        ...lock.linkFlags,
        shim,
        ...objects,
        ...lock.libcMembers.map((member) => path.join(work, member)),
        builtins,
        "-o",
        output,
      ],
      { cwd: work, capture: true },
    );
    const bytes = await readFile(output);
    return { bytes, sha256: sha256(bytes) };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function verifyModule(bytes) {
  const module = new WebAssembly.Module(bytes);
  const imports = WebAssembly.Module.imports(module);
  if (imports.length > 0) {
    throw new Error(
      `elementary.wasm must not import anything; found ${imports
        .map((entry) => `${entry.module}.${entry.name}`)
        .join(", ")}`,
    );
  }
  const exported = new Set(WebAssembly.Module.exports(module).map((entry) => entry.name));
  const expected = ["memory", "reserve", ...lock.functions.flatMap((name) => [name, `v_${name}`])];
  const missing = expected.filter((name) => !exported.has(name));
  const extra = [...exported].filter((name) => !expected.includes(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `elementary.wasm export mismatch; missing [${missing.join(", ")}], extra [${extra.join(", ")}]`,
    );
  }
}

async function verifySources() {
  const problems = [];
  for (const [file, digest] of Object.entries(lock.source.files)) {
    try {
      const actual = sha256(await readFile(path.join(sourceRoot, file)));
      if (actual !== digest) problems.push(`${file}: sha256 ${actual}, pinned ${digest}`);
    } catch {
      problems.push(`${file}: missing`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `CORE-MATH sources in ${sourceRoot} do not match commit ${lock.source.commit}` +
        ` (rerun with --fetch):\n  ${problems.join("\n  ")}`,
    );
  }
}

async function fetchSources() {
  const base = `${lock.source.repository}/-/raw/${lock.source.commit}`;
  for (const [file, digest] of Object.entries(lock.source.files)) {
    const target = path.join(sourceRoot, file);
    try {
      if (sha256(await readFile(target)) === digest) continue;
    } catch {
      // Not cached yet.
    }
    const response = await fetch(`${base}/${file}`);
    if (!response.ok) throw new Error(`Fetching ${file} failed with HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (sha256(bytes) !== digest)
      throw new Error(`Fetched ${file} does not match its pinned digest`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    console.log(`Fetched ${file}`);
  }
}

async function verifyToolchain() {
  let version;
  try {
    version = await readFile(path.join(wasiSdk, "VERSION"), "utf8");
  } catch {
    throw new Error(
      `wasi-sdk ${lock.toolchain.version} not found at ${wasiSdk}; set NATIVR_WASI_SDK ` +
        "or run `pnpm grammar:build`, which installs it through tree-sitter-cli.",
    );
  }
  const fields = Object.fromEntries(
    version
      .split(/\r?\n/u)
      .map((line) => line.split(":").map((part) => part.trim()))
      .filter((parts) => parts.length === 2),
  );
  const release = version.split(/\r?\n/u)[0]?.trim();
  if (
    release !== lock.toolchain.version ||
    fields["llvm-version"] !== lock.toolchain.llvm ||
    fields.llvm !== lock.toolchain.llvmCommit ||
    fields["wasi-libc"] !== lock.toolchain.wasiLibc
  ) {
    throw new Error(
      `wasi-sdk at ${wasiSdk} is not the pinned ${lock.toolchain.version}:\n${version}`,
    );
  }
}

function defaultSourceRoot(commit) {
  const base =
    process.platform === "win32"
      ? (process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"))
      : (process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"));
  return path.join(base, "NativR", "core-math", commit);
}

function defaultWasiSdk() {
  return process.platform === "win32"
    ? path.join(
        process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
        "tree-sitter",
        "wasi-sdk",
      )
    : path.join(
        process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"),
        "tree-sitter",
        "wasi-sdk",
      );
}

async function writeJson(file, value) {
  const text = await format(JSON.stringify(value), { ...prettierOptions, filepath: file });
  await writeFile(file, text, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
