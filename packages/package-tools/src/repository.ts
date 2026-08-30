import { createHash, randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { parseDcfRecords, requiredDcfField } from "./dcf.js";
import {
  assertSelectedSuggestsEncountered,
  comparePackageVersions,
  normalizeSuggestsPolicy,
  resolvePackageArtifacts,
  selectedDependencies,
} from "./resolve.js";
import type {
  NativRPackageArtifact,
  RepositoryInstallOptions,
  RepositoryInstallResult,
} from "./types.js";

const DEFAULT_MAX_PACKAGES = 256;
const DEFAULT_MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;
const repositoryIndexCache = new WeakMap<
  typeof globalThis.fetch,
  Map<string, Promise<Uint8Array>>
>();

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
  const suggestsPolicy = normalizeSuggestsPolicy(options);
  const encounteredSuggests = new Set<string>();
  const indexBytes = await cachedRepositoryIndex(repository, fetch_, maxDownloadBytes);
  const indexText = decodeRepositoryIndex(indexBytes, maxDownloadBytes);
  const index = new Map<string, ReadonlyMap<string, string>>();
  for (const record of parseDcfRecords(indexText)) {
    const name = requiredDcfField(record, "Package");
    const previous = index.get(name);
    index.set(name, previous === undefined ? record : preferredRepositoryRecord(previous, record));
  }
  const provided: Record<string, string> = {
    R: "4.6.1",
    base: "4.6.1",
    stats: "4.6.1",
    stats4: "4.6.1",
    graphics: "4.6.1",
    grDevices: "4.6.1",
    grid: "4.6.1",
    methods: "4.6.1",
    utils: "4.6.1",
    tools: "4.6.1",
    datasets: "4.6.1",
    compiler: "4.6.1",
    parallel: "4.6.1",
    ...options.providedPackages,
  };
  const artifacts = new Map<string, NativRPackageArtifact>();
  const active = new Set<string>();
  for (const packageName of packageNames) await install(packageName, undefined);
  assertSelectedSuggestsEncountered(suggestsPolicy, encounteredSuggests);
  const resolved = resolvePackageArtifacts([...artifacts.values()], {
    roots: packageNames,
    providedPackages: provided,
    ...(options.includeSuggests === undefined ? {} : { includeSuggests: options.includeSuggests }),
    ...(options.selectedSuggests === undefined
      ? {}
      : { selectedSuggests: options.selectedSuggests }),
  });
  return Object.freeze({
    ...resolved,
    repository: repository.href,
    indexIntegrity: `sha256-${createHash("sha256").update(indexBytes).digest("hex")}`,
  });

  async function install(name: string, requiredBy: string | undefined): Promise<void> {
    if (artifacts.has(name) || provided[name] !== undefined) return;
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
      const repositoryPath = metadata.get("Path")?.replace(/^\/+|\/+$/gu, "");
      const archiveUrl = new URL(
        `src/contrib/${repositoryPath === undefined ? "" : `${repositoryPath}/`}${encodeURIComponent(name)}_${encodeURIComponent(version)}.tar.gz`,
        repository,
      );
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
      artifacts.set(name, artifact);
      const dependencies = selectedDependencies(artifact, suggestsPolicy, encounteredSuggests);
      for (const dependency of dependencies) await install(dependency.name, name);
    } finally {
      active.delete(name);
    }
  }
}

async function cachedRepositoryIndex(
  repository: URL,
  fetch_: typeof globalThis.fetch,
  maxBytes: number,
): Promise<Uint8Array> {
  let cache = repositoryIndexCache.get(fetch_);
  if (cache === undefined) {
    cache = new Map();
    repositoryIndexCache.set(fetch_, cache);
  }
  const key = `${repository.href}\u0000${maxBytes}`;
  let pending = cache.get(key);
  if (pending === undefined) {
    pending = fetchRepositoryIndex(repository, fetch_, maxBytes);
    cache.set(key, pending);
    pending.catch(() => cache?.delete(key));
  }
  return pending;
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
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new Error(`Download '${url.href}' exceeds the ${maxBytes}-byte limit.`);
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
