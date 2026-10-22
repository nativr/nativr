import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createRequiredExampleProfileReport,
  RequiredExampleProfileError,
} from "../../../scripts/lib/required-example-profile.mjs";

export { expect };

type Row = {
  id: string;
  generation: number;
  activationAtMs: number | null;
  busyObservedAtMs: number | null;
  settledObservedAtMs: number | null;
  activationCount: number;
  busyCount: number;
  completionCount: number;
  terminal: "ready" | "error" | null;
  displayedEvaluatorElapsedMs: number | null;
  visible: boolean;
};
type Collector = {
  arm(id: string): void;
  snapshot(): {
    rows: Row[];
    issues: string[];
    overflow: boolean;
    pending: boolean;
    readyObserved: boolean;
    viewport: { width: number; height: number };
  };
};
type ProfileWindow = Window & { __nativrRequiredExampleProfile?: Collector };
type Manifest = {
  schemaVersion: 1;
  testTitle: string;
  sourceHashPolicy: "lf-normalized-utf8";
  sourceSha256: string;
  sampleIds: string[];
};
type RequiredProfile = { run(id: string): Promise<void> };
const activeProfiles = new WeakMap<Page, RequiredProfile>();

export async function profiledRun(page: Page, id: string): Promise<void> {
  const profile = activeProfiles.get(page);
  if (profile) await profile.run(id);
  else await page.getByRole("button", { name: /^Run/u }).click();
}
type FileDigest = { path: string; bytes: number; sha256: string };
const root = fileURLToPath(new URL("../../../", import.meta.url));
const sourcePath = "tests/e2e/playground.spec.ts";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export function isLocalBlobResponse(url: URL, status: number): boolean {
  return (
    url.protocol === "blob:" &&
    url.origin === "http://127.0.0.1:4173" &&
    url.search === "" &&
    url.hash === "" &&
    status === 200
  );
}

async function snapshotInputs(): Promise<FileDigest[]> {
  const files = [
    sourcePath,
    "tests/e2e/helpers/required-example-profile.ts",
    "tests/e2e/helpers/required-example-profile-cases.json",
    "scripts/lib/required-example-profile.mjs",
    "scripts/lib/required-example-profile.d.mts",
    "scripts/lib/required-example-manifest.mjs",
    "scripts/required-example-manifest.mjs",
    "scripts/test/required-example-manifest.test.mjs",
    "playwright.config.ts",
    "playwright.profile.config.ts",
    "scripts/serve-e2e.mjs",
    "pnpm-lock.yaml",
    "docs/compatibility-manifest.json",
    "apps/playground/index.html",
    "apps/playground/vite.config.ts",
  ];
  async function visit(relative: string): Promise<void> {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("PROFILE_INPUT_LINK");
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error("PROFILE_INPUT_KIND");
      if (files.length > 2048) throw new Error("PROFILE_INPUT_LIMIT");
    }
  }
  await visit("apps/playground/src");
  await visit("apps/playground/dist");
  let total = 0;
  const result: FileDigest[] = [];
  for (const relative of files.sort()) {
    const absolute = path.join(root, relative);
    const metadata = await lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("PROFILE_INPUT_KIND");
    total += metadata.size;
    if (metadata.size > 32 * 1024 * 1024 || total > 128 * 1024 * 1024)
      throw new Error("PROFILE_INPUT_LIMIT");
    const bytes = await readFile(absolute);
    if (bytes.length !== metadata.size) throw new Error("PROFILE_INPUT_CHANGED");
    result.push({ path: relative, bytes: bytes.length, sha256: digest(bytes) });
  }
  return result;
}

// Serialized by Playwright. This closure intentionally has no imported runtime dependencies.
export function installCollector({ expectedIds }: { expectedIds: readonly string[] }): void {
  const rows: Row[] = [];
  const issues: string[] = [];
  let overflow = false;
  let active: Row | undefined;
  let readyObserved = false;
  const issue = (code: string) => {
    if (issues.length < 8) issues.push(code);
    else overflow = true;
  };
  const control = () => document.getElementById("run") as HTMLButtonElement | null;
  const state = () => document.getElementById("status-dot")?.dataset.state;
  const collector: Collector = {
    arm(id) {
      if (active && active.completionCount !== 1) {
        issue("overlap");
        throw new Error("PROFILE_ARM");
      }
      if (rows.length >= expectedIds.length) {
        overflow = true;
        throw new Error("PROFILE_ARM");
      }
      if (id !== expectedIds[rows.length]) {
        issue("unexpected-id");
        throw new Error("PROFILE_ARM");
      }
      if (rows.length === 0)
        readyObserved = document.getElementById("runtime-status")?.textContent === "Runtime ready";
      if (control()?.disabled !== false) {
        issue("not-enabled");
        throw new Error("PROFILE_ARM");
      }
      active = {
        id,
        generation: rows.length + 1,
        activationAtMs: null,
        busyObservedAtMs: null,
        settledObservedAtMs: null,
        activationCount: 0,
        busyCount: 0,
        completionCount: 0,
        terminal: null,
        displayedEvaluatorElapsedMs: null,
        visible: true,
      };
      rows.push(active);
    },
    snapshot() {
      return {
        rows,
        issues,
        overflow,
        pending: active !== undefined && active.completionCount !== 1,
        readyObserved,
        viewport: { width: innerWidth, height: innerHeight },
      };
    },
  };
  Object.defineProperty(window, "__nativrRequiredExampleProfile", { value: collector });
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element) || event.target.closest("button")?.id !== "run")
        return;
      if (!active || active.completionCount !== 0) {
        issue("unarmed-activation");
        return;
      }
      active.activationCount += 1;
      if (active.activationCount !== 1) {
        issue("duplicate-activation");
        return;
      }
      active.activationAtMs = performance.now();
      active.visible &&= document.visibilityState === "visible";
    },
    true,
  );
  document.addEventListener("visibilitychange", () => {
    if (active && active.completionCount === 0 && document.visibilityState !== "visible")
      active.visible = false;
  });
  addEventListener(
    "DOMContentLoaded",
    () => {
      const button = control();
      if (!button) {
        issue("missing-control");
        return;
      }
      new MutationObserver((mutations) => {
        if (!active) return;
        const transitions = mutations.filter((mutation, index) => {
          const next = mutations[index + 1];
          const before = mutation.oldValue !== null;
          const after = next === undefined ? button.disabled : next.oldValue !== null;
          return before !== after;
        });
        // Repeated assignments of the same boolean state do not start or complete another run.
        if (transitions.length === 0) return;
        if (active.activationCount !== 1 || active.completionCount !== 0) {
          issue("unexpected-transition");
          return;
        }
        // Distinct callbacks are required; never invent a busy timestamp for a collapsed batch.
        if (transitions.length !== 1) {
          issue("batched-transition");
          return;
        }
        if (button.disabled && state() === "running" && active.busyCount === 0) {
          active.busyCount = 1;
          active.busyObservedAtMs = performance.now();
          return;
        }
        const terminal = state();
        if (
          !button.disabled &&
          (terminal === "ready" || terminal === "error") &&
          active.busyCount === 1
        ) {
          active.completionCount = 1;
          active.settledObservedAtMs = performance.now();
          active.terminal = terminal;
          active.visible &&= document.visibilityState === "visible";
          const text = document.getElementById("elapsed")?.textContent ?? "";
          active.displayedEvaluatorElapsedMs =
            terminal === "ready" && /^\d+(?:\.\d+)? ms$/u.test(text)
              ? Number.parseFloat(text)
              : null;
          return;
        }
        issue("invalid-transition");
      }).observe(button, {
        attributes: true,
        attributeFilter: ["disabled"],
        attributeOldValue: true,
      });
    },
    { once: true },
  );
}

async function readCollector(page: Page) {
  return page.evaluate(() => {
    const collector = (window as ProfileWindow).__nativrRequiredExampleProfile;
    if (!collector) throw new Error("PROFILE_COLLECTOR_MISSING");
    return collector.snapshot();
  });
}

export const test = base.extend({
  page: async ({ page, browser }, use, testInfo) => {
    if (
      process.env.NATIVR_PROFILE_REQUIRED_EXAMPLES !== "1" ||
      testInfo.title !== "runs the required Worker examples without evaluation network traffic"
    ) {
      await use(page);
      return;
    }
    if (testInfo.timeout !== 60_000 || process.env.NATIVR_E2E_SKIP_BUILD !== "1")
      throw new Error("PROFILE_CONFIGURATION");
    const manifest = JSON.parse(
      await readFile(new URL("./required-example-profile-cases.json", import.meta.url), "utf8"),
    ) as Manifest;
    if (
      manifest.schemaVersion !== 1 ||
      !Array.isArray(manifest.sampleIds) ||
      manifest.sampleIds.length === 0 ||
      manifest.sampleIds.length > 512 ||
      manifest.sampleIds.some((id) => !/^required-\d{3}:\d{1,2}$/u.test(id)) ||
      new Set(manifest.sampleIds).size !== manifest.sampleIds.length
    )
      throw new Error("PROFILE_MANIFEST");
    const before = await snapshotInputs();
    const sourceBytes = await readFile(path.join(root, sourcePath));
    if (digest(sourceBytes) !== before.find((file) => file.path === sourcePath)?.sha256)
      throw new Error("PROFILE_SOURCE_CHANGED");
    const sourceSha256 = digest(Buffer.from(sourceBytes.toString("utf8").replace(/\r\n?/gu, "\n")));
    if (
      manifest.sourceHashPolicy !== "lf-normalized-utf8" ||
      manifest.testTitle !== testInfo.title ||
      sourceSha256 !== manifest.sourceSha256
    )
      throw new Error("PROFILE_SOURCE");
    const capabilities = JSON.parse(
      await readFile(path.join(root, "docs/compatibility-manifest.json"), "utf8"),
    ) as { semanticProfileVersion: string; languageSubsetVersion: string };
    if (capabilities.semanticProfileVersion !== capabilities.languageSubsetVersion)
      throw new Error("PROFILE_PROFILE");
    const served = new Map(
      before
        .filter((file) => file.path.startsWith("apps/playground/dist/"))
        .map((file) => [file.path.slice("apps/playground/dist/".length), file]),
    );
    const responses: Promise<void>[] = [];
    const verifiedResponses = new Set<string>();
    let responseFailure = false;
    let excludedLocalBlobResponses = 0;
    const unknownAssets: {
      scheme: string;
      resourceType: string;
      pathnameSha256: string;
      status: number | "unknown";
    }[] = [];
    const responseFailures = {
      limit: 0,
      origin: 0,
      unknownAsset: 0,
      status: 0,
      bodyRead: 0,
      bodyMismatch: 0,
      unexpected: 0,
    };
    const inputDiagnostics: {
      stable: boolean | null;
      beforeCount: number;
      afterCount: number | null;
      beforeSnapshotSha256: string;
      afterSnapshotSha256: string | null;
    } = {
      stable: null,
      beforeCount: before.length,
      afterCount: null,
      beforeSnapshotSha256: digest(Buffer.from(JSON.stringify(before))),
      afterSnapshotSha256: null,
    };
    page.on("response", (response) => {
      if (responses.length >= 2048) {
        responseFailure = true;
        responseFailures.limit += 1;
        return;
      }
      const task = (async () => {
        const url = new URL(response.url());
        const request = response.request();
        const resourceType = request.resourceType();
        if (isLocalBlobResponse(url, response.status())) {
          // Blob content is browser-created, not an HTTP asset served from dist.
          // This explicit exclusion supplies no body digest or verified-asset credit.
          excludedLocalBlobResponses += 1;
          return;
        }
        if (url.origin !== "http://127.0.0.1:4173" || url.search !== "") {
          responseFailures.origin += 1;
          responseFailure = true;
          return;
        }
        const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        const expected = served.get(relative);
        if (!expected) {
          responseFailures.unknownAsset += 1;
          responseFailure = true;
          if (unknownAssets.length < 16)
            unknownAssets.push({
              scheme: ["http:", "https:", "blob:", "data:"].includes(url.protocol)
                ? url.protocol
                : "other",
              resourceType: [
                "document",
                "script",
                "stylesheet",
                "image",
                "font",
                "media",
                "texttrack",
                "xhr",
                "fetch",
                "eventsource",
                "websocket",
                "manifest",
                "other",
              ].includes(resourceType)
                ? resourceType
                : "other",
              pathnameSha256: digest(Buffer.from(url.pathname)),
              status:
                Number.isInteger(response.status()) &&
                response.status() >= 0 &&
                response.status() <= 599
                  ? response.status()
                  : "unknown",
            });
          return;
        }
        if (response.status() !== 200) {
          responseFailures.status += 1;
          responseFailure = true;
          return;
        }
        let body: Buffer;
        try {
          body = await response.body();
        } catch {
          responseFailures.bodyRead += 1;
          responseFailure = true;
          return;
        }
        if (body.length !== expected.bytes || digest(body) !== expected.sha256) {
          responseFailures.bodyMismatch += 1;
          responseFailure = true;
          return;
        }
        verifiedResponses.add(relative);
      })().catch(() => {
        responseFailures.unexpected += 1;
        responseFailure = true;
      });
      responses.push(task);
    });
    await page.addInitScript(installCollector, { expectedIds: manifest.sampleIds });
    const counts = new Map<string, number>();
    const actions: {
      id: string;
      armRpcMs: number;
      actionCallMs: number;
      actionSucceeded: boolean;
    }[] = [];
    let failure: unknown;
    try {
      activeProfiles.set(page, {
        run: async (ownedId) => {
          const occurrence = (counts.get(ownedId) ?? 0) + 1;
          counts.set(ownedId, occurrence);
          const id = `${ownedId}:${occurrence}`;
          const armStarted = performance.now();
          await page.evaluate((sample) => {
            const collector = (window as ProfileWindow).__nativrRequiredExampleProfile;
            if (!collector) throw new Error("PROFILE_COLLECTOR_MISSING");
            collector.arm(sample);
          }, id);
          const armRpcMs = performance.now() - armStarted;
          const actionStarted = performance.now();
          let actionSucceeded = false;
          try {
            await page.getByRole("button", { name: /^Run/u }).click();
            actionSucceeded = true;
          } finally {
            actions.push({
              id,
              armRpcMs,
              actionCallMs: performance.now() - actionStarted,
              actionSucceeded,
            });
          }
        },
      });
      await use(page);
    } finally {
      activeProfiles.delete(page);
      try {
        const observed = await readCollector(page);
        await Promise.all(responses);
        const after = await snapshotInputs();
        inputDiagnostics.stable = JSON.stringify(before) === JSON.stringify(after);
        inputDiagnostics.afterCount = after.length;
        inputDiagnostics.afterSnapshotSha256 = digest(Buffer.from(JSON.stringify(after)));
        const expected = {
          sampleIds: manifest.sampleIds,
          semanticProfile: capabilities.semanticProfileVersion,
          sourceSha256,
          browser: testInfo.project.name,
          timeoutMs: 120_000,
          viewport: testInfo.project.use.viewport,
        };
        const report = createRequiredExampleProfileReport(
          {
            schemaVersion: 1,
            testPassed: testInfo.status === "passed",
            inputsStable: inputDiagnostics.stable,
            servedAssetsVerified:
              !responseFailure &&
              verifiedResponses.has("index.html") &&
              [...verifiedResponses].some((name) => name.endsWith(".js")) &&
              [...verifiedResponses].some((name) => name.endsWith(".wasm")),
            readyObserved: observed.readyObserved,
            browser: testInfo.project.name,
            browserVersion: browser.version(),
            semanticProfile: capabilities.semanticProfileVersion,
            sourceSha256,
            timeoutMs: testInfo.timeout,
            viewport: observed.viewport,
            browserState: {
              rows: observed.rows,
              issues: observed.issues,
              overflow: observed.overflow,
              pending: observed.pending,
            },
            actions,
          },
          expected,
        );
        await testInfo.attach("owned-required-example-profile", {
          body: Buffer.from(
            JSON.stringify({
              ...report,
              provenance: {
                inputs: before,
                servedPaths: [...verifiedResponses].sort(),
                excludedLocalBlobResponses,
                profileSource:
                  "Checked-in capability manifest; serial build provenance remains a separate required gate",
              },
            }),
          ),
          contentType: "application/json",
        });
      } catch (error) {
        failure = error;
        await testInfo.attach("owned-required-example-profile-invalid", {
          body: Buffer.from(
            JSON.stringify({
              schemaVersion: 1,
              ok: false,
              code: error instanceof RequiredExampleProfileError ? error.code : "PROFILE_CAPTURE",
              diagnostics: {
                inputs: inputDiagnostics,
                responses: {
                  observed: responses.length,
                  failed: responseFailure,
                  failures: responseFailures,
                  excludedLocalBlobResponses,
                  unknownAssets,
                  unknownAssetMetadataTruncated:
                    responseFailures.unknownAsset > unknownAssets.length,
                  verified: {
                    html: verifiedResponses.has("index.html"),
                    javascript: [...verifiedResponses].filter((name) => name.endsWith(".js"))
                      .length,
                    wasm: [...verifiedResponses].filter((name) => name.endsWith(".wasm")).length,
                  },
                },
              },
            }),
          ),
          contentType: "application/json",
        });
      }
    }
    if (failure && testInfo.status === "passed") throw new Error("PROFILE_CAPTURE_INVALID");
  },
});
