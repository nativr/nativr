#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  inspectPackage,
  installPackagesFromRepository,
  packPackage,
  resolvePackageArtifacts,
  verifyPackageArtifact,
} from "./index.js";
import type { NativRPackageArtifact } from "./types.js";
import { PackageCompatibilityError } from "./types.js";

const [command, source, ...rest] = process.argv.slice(2);

try {
  if (command === "verify") {
    if (source === undefined) usage();
    const value: unknown = JSON.parse(await readFile(path.resolve(source), "utf8"));
    if (!verifyPackageArtifact(value))
      throw new Error("Artifact integrity or schema verification failed.");
    process.stdout.write(`Verified ${value.package.name} ${value.package.version}\n`);
  } else if (command === "resolve") {
    const outputIndex = rest.indexOf("--output");
    if (outputIndex >= 0 && outputIndex !== rest.length - 2) {
      throw new Error("--output must be the final option and requires one value.");
    }
    const output = outputIndex < 0 ? undefined : rest[outputIndex + 1];
    const inputs = [source, ...(outputIndex < 0 ? rest : rest.slice(0, outputIndex))].filter(
      (value): value is string => value !== undefined,
    );
    if (inputs.length === 0) usage();
    const artifacts: NativRPackageArtifact[] = [];
    for (const input of inputs) {
      const value: unknown = JSON.parse(await readFile(path.resolve(input), "utf8"));
      if (!verifyPackageArtifact(value))
        throw new Error(`Artifact '${input}' failed verification.`);
      artifacts.push(value);
    }
    const resolved = resolvePackageArtifacts(artifacts);
    const json = `${JSON.stringify({ lock: resolved.lock, bundles: resolved.bundles }, null, 2)}\n`;
    if (output === undefined) process.stdout.write(json);
    else {
      await writeFile(path.resolve(output), json, "utf8");
      process.stdout.write(`Wrote ${resolved.artifacts.length} resolved packages to ${output}\n`);
    }
  } else if (command === "install") {
    const parsed = parseInstallArguments([source, ...rest].filter(isString));
    if (parsed.packages.length === 0) usage();
    const installed = await installPackagesFromRepository(parsed.packages, {
      ...(parsed.repository === undefined ? {} : { repository: parsed.repository }),
      includeSuggests: parsed.includeSuggests,
      ...(parsed.sourcePlatform === undefined
        ? {}
        : { pack: { sourcePlatform: parsed.sourcePlatform } }),
    });
    const json = `${JSON.stringify(
      {
        repository: installed.repository,
        indexIntegrity: installed.indexIntegrity,
        lock: installed.lock,
        bundles: installed.bundles,
      },
      null,
      2,
    )}\n`;
    if (parsed.output === undefined) process.stdout.write(json);
    else {
      await writeFile(path.resolve(parsed.output), json, "utf8");
      process.stdout.write(
        `Installed ${installed.artifacts.length} packages to ${parsed.output}\n`,
      );
    }
  } else if (command === "inspect" || command === "pack") {
    if (source === undefined) usage();
    const parsed = parsePackArguments(rest);
    const artifact =
      command === "inspect"
        ? await inspectPackage(source, {
            ...(parsed.sourcePlatform === undefined
              ? {}
              : { sourcePlatform: parsed.sourcePlatform }),
          })
        : await packPackage(source, {
            ...(parsed.sourcePlatform === undefined
              ? {}
              : { sourcePlatform: parsed.sourcePlatform }),
          });
    const json = `${JSON.stringify(artifact, null, 2)}\n`;
    if (parsed.output === undefined) process.stdout.write(json);
    else {
      await writeFile(path.resolve(parsed.output), json, "utf8");
      process.stdout.write(
        `Wrote ${artifact.package.name} ${artifact.package.version} to ${parsed.output}\n`,
      );
    }
  } else {
    usage();
  }
} catch (error) {
  if (error instanceof PackageCompatibilityError) {
    process.stderr.write(
      `${error.message}\n${JSON.stringify(error.artifact.compatibility, null, 2)}\n`,
    );
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
}

function usage(): never {
  throw new Error(
    "Usage: nativr-package inspect <directory|package.tar.gz> [--source-platform unix|windows] [--output artifact.json]\n" +
      "       nativr-package pack <directory|package.tar.gz> [--source-platform unix|windows] [--output artifact.json]\n" +
      "       nativr-package resolve <artifact.json>... [--output package-set.json]\n" +
      "       nativr-package install <package>... [--repository URL] [--source-platform unix|windows] [--include-suggests] [--output package-set.json]\n" +
      "       nativr-package verify <artifact.json>",
  );
}

function parsePackArguments(arguments_: readonly string[]): {
  readonly output?: string;
  readonly sourcePlatform?: "unix" | "windows";
} {
  let output: string | undefined;
  let sourcePlatform: "unix" | "windows" | undefined;
  for (let index = 0; index < arguments_.length; index += 2) {
    const argument = arguments_[index] ?? "";
    const value = arguments_[index + 1];
    if (value === undefined) throw new Error(`${argument} requires one value.`);
    if (argument === "--output") output = value;
    else if (argument === "--source-platform") sourcePlatform = parseSourcePlatform(value);
    else throw new Error(`Unknown argument '${argument}'.`);
  }
  return {
    ...(output === undefined ? {} : { output }),
    ...(sourcePlatform === undefined ? {} : { sourcePlatform }),
  };
}

function parseInstallArguments(arguments_: readonly string[]): {
  readonly packages: readonly string[];
  readonly repository?: string;
  readonly output?: string;
  readonly sourcePlatform?: "unix" | "windows";
  readonly includeSuggests: boolean;
} {
  const packages: string[] = [];
  let repository: string | undefined;
  let output: string | undefined;
  let sourcePlatform: "unix" | "windows" | undefined;
  let includeSuggests = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] ?? "";
    if (argument === "--include-suggests") {
      includeSuggests = true;
      continue;
    }
    if (
      argument === "--repository" ||
      argument === "--output" ||
      argument === "--source-platform"
    ) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${argument} requires one value.`);
      if (argument === "--repository") repository = value;
      else if (argument === "--output") output = value;
      else sourcePlatform = parseSourcePlatform(value);
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) throw new Error(`Unknown argument '${argument}'.`);
    packages.push(argument);
  }
  return {
    packages,
    ...(repository === undefined ? {} : { repository }),
    ...(output === undefined ? {} : { output }),
    ...(sourcePlatform === undefined ? {} : { sourcePlatform }),
    includeSuggests,
  };
}

function parseSourcePlatform(value: string): "unix" | "windows" {
  if (value === "unix" || value === "windows") return value;
  throw new Error("--source-platform must be 'unix' or 'windows'.");
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
