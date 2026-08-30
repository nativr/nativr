import { access, copyFile, cp, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = path.join(root, "packages", "parser", "assets");
const targets = [
  path.join(root, "packages", "nativr", "src", "assets"),
  path.join(root, "packages", "nativr", "dist"),
  path.join(root, "packages", "nativr", "dist", "assets"),
  path.join(root, "apps", "playground", "public", "assets"),
];

for (const target of targets) {
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
  console.log(`Copied parser assets to ${path.relative(root, target)}`);
}

const packageRuntimeAssets = path.join(root, "packages", "nativr", "dist", "assets");
const packageRuntimeChunks = path.join(root, "packages", "nativr", "dist", "chunks");
const playgroundRuntimeAssets = path.join(root, "apps", "playground", "public", "assets");
await mkdir(playgroundRuntimeAssets, { recursive: true });
for (const file of await readdir(playgroundRuntimeAssets)) {
  if (file.endsWith(".js") || file.endsWith(".js.map")) {
    await unlink(path.join(playgroundRuntimeAssets, file));
  }
}
const supportModules = [];
for (const file of await readdir(packageRuntimeAssets)) {
  if ((file.endsWith(".js") || file.endsWith(".js.map")) && !file.startsWith("worker-entry-")) {
    await copyFile(path.join(packageRuntimeAssets, file), path.join(playgroundRuntimeAssets, file));
    console.log(`Copied Worker support asset to ${path.relative(root, playgroundRuntimeAssets)}`);
    if (file.endsWith(".js")) supportModules.push(path.join(packageRuntimeAssets, file));
  }
}

// Worker support modules are emitted beside the Worker entry, while their shared dependencies are
// ordinary library chunks. The Playground copies support modules as public files so their original
// import specifiers remain unchanged; recursively copy those exact chunk dependencies beside them.
// This keeps startup preloading offline without flattening the full library chunk graph into the
// Playground or relying on Vite to re-hash imports embedded in already-built Worker assets.
const copiedDependencies = new Set();
const pendingModules = [...supportModules];
const staticImportPattern = /(?:import|export)\s*(?:[^"'()]*?\s*from\s*)?["']([^"']+)["']/gu;
while (pendingModules.length > 0) {
  const sourceFile = pendingModules.pop();
  const source = await readFile(sourceFile, "utf8");
  for (const match of source.matchAll(staticImportPattern)) {
    const specifier = match[1];
    if (!specifier?.startsWith(".")) continue;
    const dependencyName = path.basename(specifier);
    if (!dependencyName.endsWith(".js") || copiedDependencies.has(dependencyName)) continue;
    if (dependencyName.startsWith("worker-entry-")) {
      throw new Error(
        `Worker support module ${path.basename(sourceFile)} imports the Worker entry ${specifier}. ` +
          "Move shared behavior into a one-way support module instead of loading a second runtime.",
      );
    }
    const besideSource = path.resolve(path.dirname(sourceFile), specifier);
    const dependencySource = (await fileExists(besideSource))
      ? besideSource
      : path.join(packageRuntimeChunks, dependencyName);
    if (!(await fileExists(dependencySource))) {
      throw new Error(
        `Unable to resolve Worker support dependency ${specifier} from ${sourceFile}.`,
      );
    }
    copiedDependencies.add(dependencyName);
    await copyFile(dependencySource, path.join(playgroundRuntimeAssets, dependencyName));
    const sourceMap = `${dependencySource}.map`;
    if (await fileExists(sourceMap)) {
      await copyFile(sourceMap, path.join(playgroundRuntimeAssets, `${dependencyName}.map`));
    }
    pendingModules.push(dependencySource);
    console.log(
      `Copied Worker support dependency ${dependencyName} to ${path.relative(root, playgroundRuntimeAssets)}`,
    );
  }
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
