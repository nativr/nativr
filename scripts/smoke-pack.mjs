import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNode, runPnpm } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporaryRoot = path.resolve(os.tmpdir(), "nativr-pack-smoke");
const packRoot = path.join(temporaryRoot, "tarball");
const consumerRoot = path.join(temporaryRoot, "consumer");
verifyTemporaryRoot(temporaryRoot);

await rm(temporaryRoot, { recursive: true, force: true });
await mkdir(packRoot, { recursive: true });
await mkdir(path.join(consumerRoot, "src"), { recursive: true });

try {
  if (process.env.NATIVR_PACK_SMOKE_SKIP_BUILD !== "1" && !process.argv.includes("--skip-build")) {
    await runNode(path.join(root, "scripts", "build.mjs"), [], { cwd: root });
  }
  await runPnpm(
    [
      "--config.verify-deps-before-run=false",
      "--filter",
      "nativr",
      "pack",
      "--pack-destination",
      packRoot,
    ],
    { cwd: root },
  );
  const tarballs = (await readdir(packRoot)).filter((file) => file.endsWith(".tgz"));
  const tarball = tarballs[0];
  if (tarball === undefined) throw new Error("pnpm pack did not create a tarball.");
  const tarballPath = path.join(packRoot, tarball);

  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "nativr-pack-smoke-consumer",
        private: true,
        type: "module",
        packageManager: "pnpm@11.17.0",
        dependencies: { nativr: `file:${tarballPath.replaceAll("\\", "/")}` },
        devDependencies: { vite: "6.4.3" },
        scripts: { build: "vite build" },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(consumerRoot, "index.html"),
    '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  await writeFile(
    path.join(consumerRoot, "pnpm-workspace.yaml"),
    "allowBuilds:\n  esbuild: true\n",
  );
  await writeFile(
    path.join(consumerRoot, "src", "main.ts"),
    [
      'import { createR } from "nativr";',
      "async function main() {",
      "  const runtime = await createR();",
      '  document.querySelector("#app").textContent = String(await runtime.eval("1 + 1"));',
      "  await runtime.dispose();",
      "}",
      "void main();",
      "",
    ].join("\n"),
  );
  await runPnpm(
    [
      "--config.verify-deps-before-run=false",
      "--dir",
      consumerRoot,
      "install",
      "--frozen-lockfile=false",
    ],
    {
      cwd: root,
    },
  );
  await runPnpm(["--config.verify-deps-before-run=false", "--dir", consumerRoot, "build"], {
    cwd: root,
  });
  console.log(`Packed consumer build: passed (${tarball})`);
} finally {
  await rm(consumerRoot, { recursive: true, force: true });
}

function verifyTemporaryRoot(target) {
  const temporaryDirectory = path.resolve(os.tmpdir());
  const relative = path.relative(temporaryDirectory, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error(`Unsafe temporary path: ${target}`);
  }
}
