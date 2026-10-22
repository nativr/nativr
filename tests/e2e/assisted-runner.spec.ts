import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import type { PublicEvaluationResult, PureRPackageBundle } from "@nativr/nativr";

import { readOwnedRunnerBundle } from "../../scripts/lib/assisted-test-runner/bundle.mjs";

interface OwnedRunnerHarness {
  initialize(bundle: PureRPackageBundle): Promise<PublicEvaluationResult>;
  evaluate(code: string): Promise<PublicEvaluationResult>;
  dispose(): Promise<void>;
}

type HarnessGlobal = typeof globalThis & { ownedRunnerWorker: OwnedRunnerHarness };

const contentSecurityPolicy =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";

// Static, independently authored browser bootstrap; test inputs are passed as data.
const bootstrap = `
import { createR } from "/dist/index.js";
let runtime;
globalThis.ownedRunnerWorker = {
  async initialize(bundle) {
    runtime = await createR({
      execution: "worker", runtimeProfile: "package-test", packages: [bundle],
      limits: { maxSteps: 10000000, maxCallDepth: 200, maxVectorLength: 1000000 },
      timeoutMs: 15000
    });
    return runtime.evalDetailed("library(nativrTest); ownedRunnerSentinel <- 17L; TRUE", {
      printVisibleTopLevel: false
    });
  },
  async evaluate(code) {
    return runtime.evalDetailed(code, { printVisibleTopLevel: false });
  },
  async dispose() {
    if (runtime) await runtime.dispose();
    runtime = undefined;
  }
};
`;

async function serveOwnedRunnerPage(): Promise<{ origin: string; close(): Promise<void> }> {
  const dist = fileURLToPath(new URL("../../packages/nativr/dist/", import.meta.url));
  const resources = new Map<string, { bytes: Buffer; type: string }>([
    [
      "/",
      {
        bytes: Buffer.from(
          '<!doctype html><html lang="en"><meta charset="utf-8"><title>Owned runner Worker check</title><script type="module" src="/worker-harness.js"></script></html>',
        ),
        type: "text/html; charset=utf-8",
      },
    ],
    ["/worker-harness.js", { bytes: Buffer.from(bootstrap), type: "text/javascript" }],
  ]);
  const collect = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Unexpected linked browser build input.");
      if (entry.isDirectory()) {
        await collect(absolute);
      } else if (entry.isFile() && /\.(?:js|wasm)$/u.test(entry.name)) {
        const relative = path.relative(dist, absolute).split(path.sep).join("/");
        resources.set(`/dist/${relative}`, {
          bytes: await readFile(absolute),
          type: entry.name.endsWith(".wasm") ? "application/wasm" : "text/javascript",
        });
      }
    }
  };
  await collect(dist);
  const server = createServer((request, response) => {
    const resource = request.method === "GET" ? resources.get(request.url ?? "") : undefined;
    response.writeHead(resource === undefined ? 404 : 200, {
      "Content-Type": resource?.type ?? "text/plain",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": contentSecurityPolicy,
    });
    response.end(resource?.bytes ?? "Not found");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Owned runner server has no loopback address.");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
}

const selectEvents = `
  selected <- function(report, type) {
    result <- list()
    for (event in report$events) if (identical(event$type,type))
      result[[length(result)+1L]] <- event
    result
  }
`;

const scenarios = [
  {
    name: "passing assertions",
    source: `local({${selectEvents}
      r <- run_tests(run_file("tests/owned-pass.R",test_that("owned pass",{
        expect_true(TRUE); expect_false(FALSE)
      })))
      identical(r$outcome,"completed") && r$eventsComplete &&
        identical(selected(r,"test-end")[[1L]]$outcome,"passed") &&
        length(selected(r,"expectation")) == 2L &&
        identical(r$normativeTierCredit,FALSE) &&
        identical(r$originalDependencyClosureSatisfied,FALSE)
    })`,
  },
  {
    name: "failure retained while execution continues",
    source: `local({${selectEvents}
      r <- run_tests(run_file("tests/owned-fail.R",test_that("owned failure",{
        fail("owned assertion failure"); pass()
      })))
      assertions <- selected(r,"expectation")
      identical(r$outcome,"failed") && r$eventsComplete &&
        identical(selected(r,"test-end")[[1L]]$outcome,"failed") &&
        length(assertions) == 2L && identical(assertions[[1L]]$outcome,"failed") &&
        identical(assertions[[2L]]$outcome,"passed")
    })`,
  },
  {
    name: "caught unsupported operation remains partial",
    source: `local({${selectEvents}
      r <- run_tests(run_file("tests/owned-unsupported.R",test_that("owned unsupported",{
        tryCatch(expect_identical(1L,1L),error=function(e) NULL); pass()
      })))
      identical(r$outcome,"partial") && r$eventsComplete &&
        identical(selected(r,"issue")[[1L]]$code,"unsupported-api")
    })`,
  },
  {
    name: "reporter limit returns an incomplete abort",
    source: `local({
      r <- run_tests(run_file("tests/owned-abort.R",test_that("owned abort",pass())),
        max_events=3L)
      identical(r$outcome,"aborted") && identical(r$eventsComplete,FALSE) &&
        length(r$events) == 3L
    })`,
  },
  {
    name: "same Worker recovers after reporter abort",
    source: `local({${selectEvents}
      r <- run_tests(run_file("tests/owned-recovery.R",test_that("owned recovery",pass())))
      identical(r$outcome,"completed") && r$eventsComplete &&
        identical(selected(r,"test-end")[[1L]]$outcome,"passed") &&
        identical(ownedRunnerSentinel,17L)
    })`,
  },
];

function expectSilentSuccess(result: PublicEvaluationResult): void {
  expect(result.value).toBe(true);
  expect(result.runtimeReset).toBe(false);
  expect(result.output).toEqual([]);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.graphics).toEqual([]);
  expect(result.dataViews).toEqual([]);
  expect(result.browseRequests).toEqual([]);
}

test("runs the optional owned runner in a Worker with explicit outcomes and recovery", async ({
  browser,
}) => {
  // This checks the own core through the public Worker API, not testthat or host projection parity.
  const { bundle } = await readOwnedRunnerBundle();
  const server = await serveOwnedRunnerPage();
  let context: BrowserContext | undefined;
  let activePage: Page | undefined;
  const externalRequests: string[] = [];
  const evaluationRequests: string[] = [];
  const pageErrors: Error[] = [];
  let workers = 0;
  let initialized = false;
  try {
    context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", (error) => pageErrors.push(error));
    page.on("worker", () => workers++);
    page.on("request", (request) => {
      if (initialized && /^https?:/u.test(request.url())) evaluationRequests.push(request.url());
    });
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== server.origin) {
        externalRequests.push(route.request().url());
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const response = await page.goto(server.origin);
    expect(response?.headers()["content-security-policy"]).toBe(contentSecurityPolicy);
    await page.waitForFunction(() => "ownedRunnerWorker" in globalThis);
    expectSilentSuccess(
      await page.evaluate(
        (input) => (globalThis as HarnessGlobal).ownedRunnerWorker.initialize(input),
        bundle,
      ),
    );
    initialized = true;
    for (const scenario of scenarios) {
      await test.step(scenario.name, async () => {
        expectSilentSuccess(
          await page.evaluate(
            (source) => (globalThis as HarnessGlobal).ownedRunnerWorker.evaluate(source),
            scenario.source,
          ),
        );
      });
    }
    expect(workers).toBe(1);
    expect(evaluationRequests).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    try {
      if (activePage !== undefined && !activePage.isClosed())
        await activePage.evaluate(async () => {
          if ("ownedRunnerWorker" in globalThis)
            await (globalThis as HarnessGlobal).ownedRunnerWorker.dispose();
        });
    } finally {
      try {
        await context?.close();
      } finally {
        await server.close();
      }
    }
  }
});
