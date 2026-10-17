import { createHash, randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  parseDcfRecords,
  parsePackageDependencies,
  requiredDcfField,
  validatePackageIdentity,
} from "./dcf.js";
import {
  comparePackageVersions,
  DEFAULT_PROVIDED_PACKAGES,
  isRuntimeDependency,
  providedPackageVersion,
  requiredDependencies,
  resolvePackageArtifacts,
  satisfiesDependency,
} from "./resolve.js";
import type {
  NativRPackageArtifact,
  RepositoryInstallOptions,
  RepositoryInstallResult,
  RepositoryPreflightBlocker,
  RepositoryPreflightOptions,
  RepositoryPreflightResult,
} from "./types.js";

const DEFAULT_MAX_PACKAGES = 256;
const DEFAULT_MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;

/** Plan a source-package closure from PACKAGES metadata without downloading package archives. */
export async function preflightPackagesFromRepository(
  packageNames: readonly string[],
  options: RepositoryPreflightOptions = {},
): Promise<RepositoryPreflightResult> {
  if (packageNames.length === 0) throw new Error("At least one package name is required.");
  const repository = normalizeRepository(options.repository);
  const fetch_ = options.fetch ?? globalThis.fetch;
  const maxPackages = positiveLimit(options.maxPackages ?? DEFAULT_MAX_PACKAGES, "maxPackages");
  const maxDownloadBytes = positiveLimit(
    options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES,
    "maxDownloadBytes",
  );
  const { index, indexIntegrity } = await loadRepositoryIndex(
    repository,
    fetch_,
    maxDownloadBytes,
    options.expectedIndexIntegrity,
  );
  const provided = { ...DEFAULT_PROVIDED_PACKAGES, ...options.providedPackages };
  const sourcePlatform = options.sourcePlatform ?? "unix";
  const roots = Object.freeze([...packageNames]);
  const ordered: RepositoryPreflightResult["packages"][number][] = [];
  const blockers: RepositoryPreflightBlocker[] = [];
  const complete = new Set<string>();
  const visiting: string[] = [];
  for (const name of roots) visit(name, undefined);
  return Object.freeze({
    repository: repository.href,
    indexIntegrity,
    roots,
    packages: Object.freeze(ordered),
    blockers: Object.freeze(blockers),
    firstBlocker: blockers[0] ?? null,
    sourceArchiveIntegrity: "unverified" as const,
  });

  function visit(name: string, requiredBy: string | undefined): void {
    if (providedPackageVersion(provided, name) !== undefined || complete.has(name)) return;
    const cycleIndex = visiting.indexOf(name);
    if (cycleIndex >= 0) {
      blockers.push({
        code: "dependency-cycle",
        package: name,
        ...(requiredBy === undefined ? {} : { requiredBy }),
        message: `Package dependency cycle: ${[...visiting.slice(cycleIndex), name].join(" -> ")}.`,
      });
      return;
    }
    const metadata = index.get(name);
    if (metadata === undefined) {
      blockers.push({
        code: "missing-package",
        package: name,
        ...(requiredBy === undefined ? {} : { requiredBy }),
        message:
          requiredBy === undefined
            ? `Root package '${name}' is not present in ${repository.href}.`
            : `Package '${requiredBy}' requires missing package '${name}'.`,
      });
      return;
    }
    if (complete.size + visiting.length >= maxPackages) {
      throw new Error(`Repository resolution exceeds the ${maxPackages}-package limit.`);
    }
    const version = requiredDcfField(metadata, "Version");
    validatePackageIdentity(name, version);
    visiting.push(name);
    try {
      if (metadata.get("NeedsCompilation")?.trim().toLowerCase() === "yes") {
        blockers.push({
          code: "needs-compilation",
          package: name,
          ...(requiredBy === undefined ? {} : { requiredBy }),
          message: `Package '${name}' declares NeedsCompilation: yes.`,
        });
      }
      if ((metadata.get("LinkingTo") ?? "").trim().length > 0) {
        blockers.push({
          code: "linking-to",
          package: name,
          ...(requiredBy === undefined ? {} : { requiredBy }),
          message: `Package '${name}' declares LinkingTo dependencies.`,
        });
      }
      const osType = metadata.get("OS_type")?.trim().toLowerCase();
      if (osType !== undefined && osType !== sourcePlatform) {
        blockers.push({
          code: "os-type",
          package: name,
          ...(requiredBy === undefined ? {} : { requiredBy }),
          message: `Package '${name}' requires OS_type '${osType}', but '${sourcePlatform}' was selected.`,
        });
      }
      const md5sum = metadata.get("MD5sum")?.trim();
      if (md5sum !== undefined && !/^[a-f0-9]{32}$/iu.test(md5sum)) {
        blockers.push({
          code: "invalid-repository-digest",
          package: name,
          ...(requiredBy === undefined ? {} : { requiredBy }),
          message: `Repository has an invalid MD5sum for package '${name}'.`,
        });
      }
      const requirements = requiredDependencies(
        parsePackageDependencies(metadata),
        options.includeSuggests === true,
      );
      for (const dependency of requirements) {
        const runtimeDependency = isRuntimeDependency(dependency);
        const availableVersion = runtimeDependency
          ? provided.R
          : (providedPackageVersion(provided, dependency.name) ??
            index.get(dependency.name)?.get("Version"));
        if (availableVersion !== undefined && !satisfiesDependency(availableVersion, dependency)) {
          blockers.push({
            code: "version-mismatch",
            package: dependency.name,
            requiredBy: name,
            message:
              `Package '${name}' requires '${dependency.name}' ${dependency.constraint?.operator ?? ""} ${dependency.constraint?.version ?? ""}, but ${availableVersion} is available.`.replaceAll(
                /\s+/gu,
                " ",
              ),
          });
        }
        if (!runtimeDependency) visit(dependency.name, name);
      }
      ordered.push(
        Object.freeze({
          name,
          version,
          sourceUrl: repositoryArchiveUrl(repository, metadata, name, version).href,
          requirements: Object.freeze(requirements),
        }),
      );
      complete.add(name);
    } finally {
      visiting.pop();
    }
  }
}

/** Download, audit, and resolve packages from a CRAN-like source repository at build time. */
export async function installPackagesFromRepository(
  packageNames: readonly string[],
  options: RepositoryInstallOptions = {},
): Promise<RepositoryInstallResult> {
  if (packageNames.length === 0) throw new Error("At least one package name is required.");
  // Resolve after index module initialization, avoiding a static index <-> repository cycle.
  const { packPackage } = await import("./index.js");
  const repository = normalizeRepository(options.repository);
  const fetch_ = options.fetch ?? globalThis.fetch;
  const maxPackages = positiveLimit(options.maxPackages ?? DEFAULT_MAX_PACKAGES, "maxPackages");
  const maxDownloadBytes = positiveLimit(
    options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES,
    "maxDownloadBytes",
  );
  const { index, indexIntegrity } = await loadRepositoryIndex(
    repository,
    fetch_,
    maxDownloadBytes,
    options.expectedIndexIntegrity,
  );
  const provided: Record<string, string> = {
    ...DEFAULT_PROVIDED_PACKAGES,
    ...options.providedPackages,
  };
  const artifacts = new Map<string, NativRPackageArtifact>();
  const active = new Set<string>();
  for (const packageName of packageNames) await install(packageName, undefined);
  const resolved = resolvePackageArtifacts([...artifacts.values()], {
    roots: packageNames,
    providedPackages: provided,
    ...(options.includeSuggests === undefined ? {} : { includeSuggests: options.includeSuggests }),
  });
  return Object.freeze({
    ...resolved,
    repository: repository.href,
    indexIntegrity,
  });

  async function install(name: string, requiredBy: string | undefined): Promise<void> {
    if (artifacts.has(name) || providedPackageVersion(provided, name) !== undefined) return;
    if (active.has(name)) throw new Error(`Package dependency cycle includes '${name}'.`);
    const metadata = index.get(name);
    if (metadata === undefined) {
      throw new Error(
        requiredBy === undefined
          ? `Package '${name}' is not present in ${repository.href}.`
          : `Package '${requiredBy}' requires '${name}', which is absent from ${repository.href}.`,
      );
    }
    if (artifacts.size + active.size >= maxPackages) {
      throw new Error(`Repository resolution exceeds the ${maxPackages}-package limit.`);
    }
    active.add(name);
    try {
      const version = requiredDcfField(metadata, "Version");
      const archiveUrl = repositoryArchiveUrl(repository, metadata, name, version);
      const bytes = await fetchBytes(archiveUrl, fetch_, maxDownloadBytes);
      verifyRepositoryDigest(metadata, bytes, archiveUrl);
      const temporaryArchive = path.join(os.tmpdir(), `nativr-repository-${randomUUID()}.tar.gz`);
      let artifact: NativRPackageArtifact;
      try {
        await writeFile(temporaryArchive, bytes);
        artifact = await packPackage(temporaryArchive, options.pack);
      } finally {
        await unlink(temporaryArchive).catch(() => undefined);
      }
      if (artifact.package.name !== name || artifact.package.version !== version) {
        throw new Error(
          `Repository archive identity ${artifact.package.name} ${artifact.package.version} does not match ${name} ${version}.`,
        );
      }
      const dependencies = requiredDependencies(
        artifact.dependencies,
        options.includeSuggests === true,
      );
      for (const dependency of dependencies) {
        const runtimeDependency = isRuntimeDependency(dependency);
        const availableVersion = runtimeDependency
          ? provided.R
          : (artifacts.get(dependency.name)?.package.version ??
            providedPackageVersion(provided, dependency.name) ??
            index.get(dependency.name)?.get("Version"));
        if (availableVersion !== undefined && !satisfiesDependency(availableVersion, dependency)) {
          const constraint = dependency.constraint;
          throw new Error(
            `Package '${name}' requires '${dependency.name}' ${constraint?.operator ?? ""} ${constraint?.version ?? ""}, but ${availableVersion} is available.`.replaceAll(
              /\s+/gu,
              " ",
            ),
          );
        }
        if (!runtimeDependency) await install(dependency.name, name);
      }
      artifacts.set(name, artifact);
    } finally {
      active.delete(name);
    }
  }
}

async function loadRepositoryIndex(
  repository: URL,
  fetch_: typeof globalThis.fetch,
  maxBytes: number,
  expectedIndexIntegrity?: string,
): Promise<{
  readonly index: ReadonlyMap<string, ReadonlyMap<string, string>>;
  readonly indexIntegrity: string;
}> {
  if (
    expectedIndexIntegrity !== undefined &&
    !/^sha256-[a-f0-9]{64}$/u.test(expectedIndexIntegrity)
  ) {
    throw new Error("Expected repository index integrity must be a sha256 digest.");
  }
  const indexBytes = await fetchRepositoryIndex(repository, fetch_, maxBytes);
  const indexIntegrity = `sha256-${createHash("sha256").update(indexBytes).digest("hex")}`;
  if (expectedIndexIntegrity !== undefined && expectedIndexIntegrity !== indexIntegrity) {
    throw new Error(
      `Repository index integrity mismatch: expected ${expectedIndexIntegrity}, received ${indexIntegrity}.`,
    );
  }
  const indexText = decodeRepositoryIndex(indexBytes, maxBytes);
  const index = new Map<string, ReadonlyMap<string, string>>();
  for (const record of parseDcfRecords(indexText)) {
    const name = requiredDcfField(record, "Package");
    const version = requiredDcfField(record, "Version");
    validatePackageIdentity(name, version);
    const previous = index.get(name);
    index.set(name, previous === undefined ? record : preferredRepositoryRecord(previous, record));
  }
  return { index, indexIntegrity };
}

function repositoryArchiveUrl(
  repository: URL,
  metadata: ReadonlyMap<string, string>,
  name: string,
  version: string,
): URL {
  const repositoryPath = metadata.get("Path")?.replace(/^\/+|\/+$/gu, "");
  if (
    repositoryPath !== undefined &&
    repositoryPath
      .split("/")
      .some((segment) => !/^[A-Za-z0-9._-]+$/u.test(segment) || segment === "." || segment === "..")
  ) {
    throw new Error(`Repository has an invalid Path for package '${name}'.`);
  }
  return new URL(
    `src/contrib/${repositoryPath === undefined ? "" : `${repositoryPath}/`}${encodeURIComponent(name)}_${encodeURIComponent(version)}.tar.gz`,
    repository,
  );
}

function verifyRepositoryDigest(
  metadata: ReadonlyMap<string, string>,
  bytes: Uint8Array,
  archiveUrl: URL,
): void {
  const expected = metadata.get("MD5sum")?.trim().toLowerCase();
  if (expected === undefined) return;
  if (!/^[a-f0-9]{32}$/u.test(expected)) {
    throw new Error(`Repository has an invalid MD5sum for '${archiveUrl.href}'.`);
  }
  const actual = createHash("md5").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`Repository digest mismatch for '${archiveUrl.href}'.`);
  }
}

function preferredRepositoryRecord(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  const leftPath = left.get("Path");
  const rightPath = right.get("Path");
  if (leftPath === undefined && rightPath !== undefined) return left;
  if (leftPath !== undefined && rightPath === undefined) return right;
  const comparison = comparePackageVersions(
    requiredDcfField(left, "Version"),
    requiredDcfField(right, "Version"),
  );
  return comparison >= 0 ? left : right;
}

async function fetchRepositoryIndex(
  repository: URL,
  fetch_: typeof globalThis.fetch,
  maxBytes: number,
): Promise<Uint8Array> {
  const compressedUrl = new URL("src/contrib/PACKAGES.gz", repository);
  const compressed = await fetch_(compressedUrl);
  if (compressed.ok) return boundedResponseBytes(compressed, compressedUrl, maxBytes);
  const plainUrl = new URL("src/contrib/PACKAGES", repository);
  const plain = await fetch_(plainUrl);
  if (!plain.ok) {
    throw new Error(`Unable to fetch repository index (${compressed.status}, ${plain.status}).`);
  }
  return boundedResponseBytes(plain, plainUrl, maxBytes);
}

async function fetchBytes(
  url: URL,
  fetch_: typeof globalThis.fetch,
  maxBytes: number,
): Promise<Uint8Array> {
  const response = await fetch_(url);
  if (!response.ok) throw new Error(`Unable to download '${url.href}' (${response.status}).`);
  return boundedResponseBytes(response, url, maxBytes);
}

async function boundedResponseBytes(
  response: Response,
  url: URL,
  maxBytes: number,
): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) {
    throw new Error(`Download '${url.href}' exceeds the ${maxBytes}-byte limit.`);
  }
  if (response.body === null) {
    throw new Error(`Download '${url.href}' has no response body.`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`Download '${url.href}' exceeds the ${maxBytes}-byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeRepositoryIndex(bytes: Uint8Array, maxBytes: number): string {
  const decoded =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? gunzipSync(bytes, { maxOutputLength: maxBytes })
      : bytes;
  if (decoded.byteLength > maxBytes) {
    throw new Error(`Repository index exceeds the ${maxBytes}-byte limit after decompression.`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    throw new Error("Repository PACKAGES index is not valid UTF-8.");
  }
}

function normalizeRepository(value: string | URL | undefined): URL {
  const repository = new URL(value ?? "https://cran.r-project.org/");
  if (repository.protocol !== "https:" && repository.protocol !== "http:") {
    throw new Error("Package repository must use HTTP or HTTPS.");
  }
  if (!repository.pathname.endsWith("/")) repository.pathname += "/";
  repository.search = "";
  repository.hash = "";
  return repository;
}

function positiveLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${name}.`);
  return value;
}
