// Ships the correctly rounded elementary-function module (RFC-0007) next to the parser assets.
// The module comes from .tmp/elementary/ (scripts/build-elementary-wasm.mjs). The copy is refused
// unless the module matches the digest pinned in scripts/elementary/core-math.json and the digest
// the runtime verifies at load (packages/nativr/src/elementary.ts).
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = path.join(root, ".tmp", "elementary");
const lock = JSON.parse(
  await readFile(path.join(root, "scripts", "elementary", "core-math.json"), "utf8"),
);
const prebuild = process.argv.includes("--prebuild");
const targets = [
  path.join(root, "packages", "nativr", "src", "assets"),
  path.join(root, "apps", "playground", "public", "assets"),
  ...(prebuild
    ? []
    : [
        path.join(root, "packages", "nativr", "dist"),
        path.join(root, "packages", "nativr", "dist", "assets"),
      ]),
];

const wasm = await readFile(path.join(source, lock.output.file));
const digest = createHash("sha256").update(wasm).digest("hex");
if (digest !== lock.output.sha256) {
  throw new Error(
    `${lock.output.file} sha256 ${digest} does not match the pin ${lock.output.sha256}; ` +
      "run `node scripts/build-elementary-wasm.mjs`.",
  );
}
const manifest = await readFile(path.join(source, "manifest.json"));
if (JSON.parse(manifest.toString("utf8")).files?.[lock.output.file] !== digest) {
  throw new Error(`.tmp/elementary/manifest.json does not record ${lock.output.file} ${digest}`);
}
const runtimeSource = await readFile(
  path.join(root, "packages", "nativr", "src", "elementary.ts"),
  "utf8",
);
if (
  !runtimeSource.includes(`sha256: "${digest}"`) ||
  !runtimeSource.includes(`bytes: ${wasm.length}`)
) {
  throw new Error(
    "packages/nativr/src/elementary.ts must pin the same elementary.wasm sha256 and byte length.",
  );
}

const licenses = path.join(source, "licenses");
const licenseFiles = await readdir(licenses);
for (const target of targets) {
  await mkdir(path.join(target, "licenses"), { recursive: true });
  await writeFile(path.join(target, lock.output.file), wasm);
  await writeFile(path.join(target, "elementary.manifest.json"), manifest);
  for (const file of licenseFiles) {
    await writeFile(path.join(target, "licenses", file), await readFile(path.join(licenses, file)));
  }
  console.log(`Copied elementary assets to ${path.relative(root, target)}`);
}
