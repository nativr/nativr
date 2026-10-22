import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "@playwright/test";

import {
  createBrowserPerformanceReport,
  parsePerformanceArguments,
  performanceSettings,
  safePerformanceFailure,
} from "./lib/browser-performance-report.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "packages/nativr/dist");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const engines = { chromium, firefox, webkit };
const toolPaths = {
  runnerSha256: fileURLToPath(import.meta.url),
  harnessSha256: fileURLToPath(new URL("./browser-performance/harness.js", import.meta.url)),
  reportHelperSha256: fileURLToPath(
    new URL("./lib/browser-performance-report.mjs", import.meta.url),
  ),
};

async function distSnapshot(routes) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!/\.(?:js|wasm|json)$/.test(entry.name)) continue;
      const relative = path.relative(dist, absolute).split(path.sep).join("/");
      const bytes = await readFile(absolute);
      const type = entry.name.endsWith(".js")
        ? "text/javascript"
        : entry.name.endsWith(".wasm")
          ? "application/wasm"
          : "application/json";
      routes?.set("/dist/" + relative, { bytes, type });
      files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  await visit(dist);
  return files.sort((left, right) => (left.path < right.path ? -1 : 1));
}

async function bounded(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error("Performance phase watchdog expired."), {
                code: "BENCHMARK_TIMEOUT",
              }),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function staticServer(routes) {
  return createServer((request, response) => {
    let resource;
    try {
      resource = routes.get(new URL(request.url, "http://127.0.0.1").pathname);
    } catch {
      /* Reject malformed local URLs. */
    }
    response.writeHead(resource ? 200 : 404, {
      "Content-Type": resource?.type ?? "text/plain",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; base-uri 'none'",
    });
    response.end(resource?.bytes ?? "Not found");
  });
}

async function measureBrowser(name, engine, origin, settings) {
  let browser;
  let phase = "browser-launch";
  const result = {
    name,
    ok: false,
    freshContext: [],
    sameDocument: { samples: [] },
    externalRequestCount: 0,
    pageErrorCount: 0,
  };
  async function withPage(operation) {
    let context;
    phase = "page-context";
    try {
      // This bound includes context creation, navigation, module import and readiness/CSP errors.
      return await bounded(async () => {
        context = await browser.newContext({ serviceWorkers: "block" });
        await context.route("**/*", (route) => {
          if (new URL(route.request().url()).origin !== origin) {
            result.externalRequestCount += 1;
            return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on("pageerror", () => {
          result.pageErrorCount += 1;
        });
        await page.goto(origin, { timeout: settings.navigationTimeoutMs });
        await page.waitForFunction(() => globalThis.nativrPerformance !== undefined, undefined, {
          timeout: settings.navigationTimeoutMs,
        });
        const metadata = await page.evaluate(() => globalThis.nativrPerformance.metadata);
        result.clockResolutionMs = metadata.clockResolutionMs;
        return operation(page, metadata);
      }, settings.phaseWatchdogMs);
    } finally {
      if (context) await bounded(() => context.close(), settings.navigationTimeoutMs);
    }
  }
  try {
    browser = await bounded(
      () => engine.launch({ headless: true, timeout: settings.navigationTimeoutMs }),
      settings.navigationTimeoutMs,
    );
    result.version = browser.version();
    for (let index = 0; index < settings.startupFreshContextSamples; index += 1) {
      await withPage(async (page, metadata) => {
        phase = "startup";
        const sample = await page.evaluate(() => globalThis.nativrPerformance.startup());
        result.freshContext.push({ ...sample, moduleImportMs: metadata.moduleImportMs });
      });
    }
    // One document/module import, with independently created Worker sessions in each sample.
    await withPage(async (page, metadata) => {
      result.sameDocument.moduleImportMs = metadata.moduleImportMs;
      phase = "startup";
      for (let index = 0; index < settings.startupSameDocumentSamples; index += 1)
        result.sameDocument.samples.push(
          await page.evaluate(() => globalThis.nativrPerformance.startup()),
        );
      phase = "cancellation";
      result.cancellation = await page.evaluate(
        (count) => globalThis.nativrPerformance.cancellation(count),
        settings.cancellationSamples,
      );
      phase = "package-workloads";
      result.package = await page.evaluate(
        ({ warmups, count }) => globalThis.nativrPerformance.packageWorkloads(warmups, count),
        { warmups: settings.packageWarmups, count: settings.packageSamples },
      );
    });
    result.ok =
      result.freshContext.every((sample) => sample.ok) &&
      result.sameDocument.samples.every((sample) => sample.ok) &&
      result.cancellation.ok &&
      result.package.ok &&
      result.externalRequestCount === 0 &&
      result.pageErrorCount === 0;
  } catch (error) {
    result.failure = safePerformanceFailure(phase, error);
  } finally {
    if (browser) {
      try {
        await bounded(() => browser.close(), settings.navigationTimeoutMs);
      } catch (error) {
        result.ok = false;
        result.failure = safePerformanceFailure("cleanup", error);
      }
    }
  }
  return result;
}

async function main() {
  const options = parsePerformanceArguments(process.argv.slice(2));
  const settings = performanceSettings(options.pilot);
  const outputDirectory = path.resolve(root, options.output ?? ".tmp/browser-performance");
  const raw = {
    schemaVersion: 1,
    kind: "exploratory-browser-performance",
    settings,
    recordedAt: new Date().toISOString(),
    engines: [],
    archiveVerified: false,
    artifactVerified: false,
    distStable: false,
    toolingStable: false,
  };
  const expected = { pilot: options.pilot };
  const cachedBrowsers = [];
  const routes = new Map();
  let server;
  let phase = "preflight";
  try {
    const manifest = JSON.parse(
      await readFile(path.join(root, "docs/compatibility-manifest.json"), "utf8"),
    );
    raw.semanticProfileVersion = expected.semanticProfileVersion = manifest.semanticProfileVersion;
    const corpus = JSON.parse(
      await readFile(path.join(root, "compatibility/package-corpus.json"), "utf8"),
    );
    const entry = corpus.packages.find((candidate) => candidate.package === "numDeriv");
    if (!entry || !["development", "regression"].includes(entry.partition))
      throw new Error("Pinned development/regression input required.");
    raw.package = expected.package = {
      name: entry.package,
      version: entry.version,
      partition: entry.partition,
      sourceSha256: entry.sourceSha256,
      artifactSha256: entry.artifactSha256,
    };
    const archive = path.resolve(
      root,
      options.archive ??
        path.join(".tmp/handoff/pkgsrc", entry.package + "_" + entry.version + ".tar.gz"),
    );
    if (sha256(await readFile(archive)) !== entry.sourceSha256)
      throw new Error("Cached source digest mismatch.");
    raw.archiveVerified = true;
    for (const [key, filename] of Object.entries(toolPaths))
      raw[key] = expected[key] = sha256(await readFile(filename));
    raw.distDigests = expected.distDigests = await distSnapshot(routes);
    for (const [name, engine] of Object.entries(engines)) {
      let present = true;
      try {
        await access(engine.executablePath());
      } catch {
        present = false;
      }
      cachedBrowsers.push({ name, present });
    }
    if (cachedBrowsers.some((browser) => !browser.present))
      throw new Error("Cached browser absent; no download attempted.");
    if (!options.run) {
      console.log(
        JSON.stringify({
          mode: "preflight-only",
          ok: true,
          semanticProfileVersion: raw.semanticProfileVersion,
          package: raw.package,
          archiveVerified: true,
          normalizedArtifactVerified: false,
          cachedBrowsers,
          settings,
          runnerSha256: raw.runnerSha256,
          harnessSha256: raw.harnessSha256,
          reportHelperSha256: raw.reportHelperSha256,
        }),
      );
      return;
    }
    raw.host = {
      os: os.platform(),
      release: os.release(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuModelSha256: sha256(os.cpus()[0]?.model ?? "unknown"),
      logicalCpuCount: os.cpus().length,
    };
    raw.head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
    raw.playwrightVersion = JSON.parse(
      await readFile(path.join(root, "node_modules/@playwright/test/package.json"), "utf8"),
    ).version;
    phase = "package-pack";
    const { packPackage } = await import(
      pathToFileURL(path.join(root, "packages/package-tools/dist/index.js")).href
    );
    const artifact = await packPackage(archive);
    phase = "artifact-pin";
    if (
      artifact.package.name !== entry.package ||
      artifact.package.version !== entry.version ||
      artifact.integrity.value !== entry.artifactSha256
    )
      throw new Error("Pinned normalized artifact mismatch.");
    raw.artifactVerified = true;
    const harness = await readFile(toolPaths.harnessSha256);
    routes.set("/harness.js", { bytes: harness, type: "text/javascript" });
    routes.set("/", {
      bytes: Buffer.from(
        '<!doctype html><meta charset="utf-8"><title>NativR owned performance harness</title><script type="module" src="/harness.js"></script>',
      ),
      type: "text/html",
    });
    // Foreign package code is an opaque execution input; it never enters report fields or logs.
    routes.set("/numDeriv.bundle.json", {
      bytes: Buffer.from(JSON.stringify(artifact.bundle)),
      type: "application/json",
    });
    phase = "server";
    server = staticServer(routes);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = "http://127.0.0.1:" + server.address().port;
    phase = "browser-phase";
    for (const [name, engine] of Object.entries(engines))
      raw.engines.push(await measureBrowser(name, engine, origin, settings));
  } catch (error) {
    raw.failure = safePerformanceFailure(phase, error);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  if (!options.run) {
    console.log(
      JSON.stringify({ mode: "preflight-only", ok: false, failure: raw.failure, cachedBrowsers }),
    );
    process.exitCode = 1;
    return;
  }
  try {
    raw.distStable = JSON.stringify(await distSnapshot()) === JSON.stringify(expected.distDigests);
    raw.toolingStable = true;
    for (const [key, filename] of Object.entries(toolPaths))
      if (sha256(await readFile(filename)) !== expected[key]) raw.toolingStable = false;
  } catch (error) {
    raw.failure = safePerformanceFailure("dist-stability", error);
  }
  const report = createBrowserPerformanceReport(raw, expected);
  await mkdir(outputDirectory, { recursive: true });
  const reportName = "browser-performance-" + raw.recordedAt.replaceAll(":", "-") + ".json";
  await writeFile(path.join(outputDirectory, reportName), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      report: reportName,
      ok: report.ok,
      semanticProfileVersion: report.semanticProfileVersion,
      pilot: settings.pilot,
      validationErrors: report.validationErrors,
      engines: report.engines.map((engine) => ({ name: engine.name, ok: engine.ok })),
    }),
  );
  process.exitCode = report.ok ? 0 : 1;
}

await main().catch((error) => {
  // Never print arbitrary package, browser, filesystem or protocol exception text.
  console.log(JSON.stringify({ ok: false, failure: safePerformanceFailure("preflight", error) }));
  process.exitCode = 1;
});
