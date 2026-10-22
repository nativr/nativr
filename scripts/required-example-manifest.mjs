import { lstat, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import formatting from "../prettier.config.mjs";
import {
  deriveRequiredExampleManifest,
  maximumManifestSourceBytes,
  parseRequiredExampleManifestArgs,
  requiredExampleManifestPath,
  requiredExampleSourcePath,
  RequiredExampleManifestError,
  verifyRequiredExampleManifest,
} from "./lib/required-example-manifest.mjs";

async function boundedText(relative, maximum) {
  const absolute = fileURLToPath(new URL(`../${relative}`, import.meta.url));
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum)
    throw new RequiredExampleManifestError("MANIFEST_INPUT");
  const bytes = await readFile(absolute);
  if (bytes.length !== stat.size) throw new RequiredExampleManifestError("MANIFEST_INPUT_CHANGED");
  return bytes.toString("utf8");
}

try {
  const mode = parseRequiredExampleManifestArgs(process.argv.slice(2));
  const source = await boundedText(requiredExampleSourcePath, maximumManifestSourceBytes);
  const manifest = deriveRequiredExampleManifest(source);
  if (mode === "check") {
    const stored = JSON.parse(
      await boundedText(requiredExampleManifestPath, maximumManifestSourceBytes),
    );
    verifyRequiredExampleManifest(source, stored);
  } else {
    const filename = fileURLToPath(new URL(`../${requiredExampleManifestPath}`, import.meta.url));
    const stat = await lstat(filename).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (stat && (!stat.isFile() || stat.isSymbolicLink()))
      throw new RequiredExampleManifestError("MANIFEST_INPUT");
    await writeFile(
      filename,
      await format(JSON.stringify(manifest), { ...formatting, parser: "json" }),
    );
  }
  console.log(
    JSON.stringify({
      ok: true,
      mode,
      sourceSha256: manifest.sourceSha256,
      runSites: manifest.runSites.length,
      samples: manifest.sampleIds.length,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      code: error instanceof RequiredExampleManifestError ? error.code : "MANIFEST_IO",
    }),
  );
  process.exitCode = 1;
}
