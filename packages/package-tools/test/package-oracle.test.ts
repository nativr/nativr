import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  capturePackageOracleScript,
  createPackageOracle,
  runPackageOracleProcess,
} from "../../../scripts/lib/package-oracle.mjs";

describe("optional GNU R package oracle process boundary", () => {
  it("captures native streams separately without shell interpretation", async () => {
    const result = await runPackageOracleProcess(process.execPath, [
      "-e",
      'process.stdout.write("out\\r\\n"); process.stderr.write("err\\n");',
    ]);
    expect(result).toEqual({
      stdout: "out\r\n",
      stderr: "err\n",
      exitCode: 0,
      signal: null,
      reason: "exited",
    });
  });

  it("marks timeout without accepting it as a completed process", async () => {
    const result = await runPackageOracleProcess(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { timeoutMs: 200 },
    );
    expect(result.reason).toBe("timed-out");
    expect(result.exitCode).not.toBe(0);
  });

  it("bounds combined stream bytes and terminates excessive output", async () => {
    const result = await runPackageOracleProcess(
      process.execPath,
      ["-e", 'process.stdout.write("x".repeat(8192)); setInterval(() => {}, 1000)'],
      { maxOutputBytes: 100, timeoutMs: 5000 },
    );
    expect(result.reason).toBe("output-limit");
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBe(100);
  });

  it("requires positive process bounds before launch", () => {
    expect(() => runPackageOracleProcess("not-launched", [], { timeoutMs: 0 })).toThrow(
      "positive safe integer",
    );
    expect(() => runPackageOracleProcess("not-launched", [], { maxOutputBytes: Infinity })).toThrow(
      "positive safe integer",
    );
  });

  it("rejects unpinned packages before launching GNU R", async () => {
    await expect(
      createPackageOracle({
        archive: "not-read",
        rscript: "not-launched",
        expectedPackage: { name: "fixture", version: "1.0" },
        expectedSourceSha256: "",
      }),
    ).rejects.toThrow("pinned lowercase SHA-256");
  });

  it("rejects fixture traversal and Windows path aliases before process launch", async () => {
    for (const filePath of ["../escaped", "/absolute", "a\\b", "a/./b", "a/NUL", "a/b."]) {
      await expect(
        capturePackageOracleScript({
          source: "invisible(NULL)",
          rscript: "not-launched",
          files: [{ path: filePath, data: new Uint8Array([0]) }],
        }),
      ).rejects.toThrow("canonical relative paths");
    }
  });
});

// These independently authored fixtures use only a separately installed black-box GNU R.
// They never make that executable a runtime dependency or infer implementation from its source.
describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "native GNU R 4.6.1 package-script capture",
  () => {
    const rscript = process.env.NATIVR_RSCRIPT ?? "Rscript";
    const normalized = (value: string) => value.replaceAll("\r\n", "\n");

    it("preserves native warnings and runs the returning top-level error handler once", async () => {
      const source = [
        "x <- 2",
        "x + 1",
        'warning("warning text")',
        "handled <- 0L",
        'options(error = function() { handled <<- handled + 1L; cat("handler\\n") })',
        'stop("expected error", call. = FALSE)',
        'cat("after", handled, "\\n")',
      ].join("\n");
      const result = await capturePackageOracleScript({ rscript, source });
      expect(result.status).toBe("completed");
      expect(result.version).toBe("4.6.1");
      expect(normalized(result.stdout)).toBe("[1] 3\nhandler\nafter 1 \n");
      expect(normalized(result.stderr)).toContain("Warning message:\nwarning text");
      expect(normalized(result.stderr)).toContain("Error: expected error\n");
      expect(result.conditions).toEqual([
        {
          kind: "warning",
          message: "warning text",
          call: null,
          classes: ["simpleWarning", "warning", "condition"],
        },
        {
          kind: "error",
          message: "expected error",
          call: null,
          classes: ["simpleError", "error", "condition"],
          handled: true,
        },
      ]);
      expect(result.sourceSha256).toBe(createHash("sha256").update(source).digest("hex"));
      expect(result.limitations.sourcePrefixLines).toBeGreaterThan(0);
    });

    it("lets source condition handlers catch and muffle conditions without observing them twice", async () => {
      const source = [
        "seen <- 0L",
        'withCallingHandlers(warning("muffled"), warning = function(w) { seen <<- seen + 1L; invokeRestart("muffleWarning") })',
        'invisible(tryCatch(stop("caught"), error = function(e) NULL))',
        "seen",
      ].join("\n");
      const result = await capturePackageOracleScript({ rscript, source });
      expect(result.status).toBe("completed");
      expect(normalized(result.stdout)).toBe("[1] 1\n");
      expect(result.stderr).toBe("");
      expect(result.conditions).toEqual([]);
    });

    it("fails unhandled errors and successful early process exits without a completion footer", async () => {
      const unhandled = await capturePackageOracleScript({
        rscript,
        source: 'fail <- function() stop("unhandled")\nfail()\ncat("not reached")',
      });
      expect(unhandled.status).toBe("failed");
      expect(unhandled.stdout).toBe("");
      expect(unhandled.conditions).toMatchObject([
        { kind: "error", message: "unhandled", call: "fail()", handled: false },
      ]);
      const exited = await capturePackageOracleScript({
        rscript,
        source: 'quit(save = "no", status = 0L, runLast = FALSE)',
      });
      expect(exited.exitCode).toBe(0);
      expect(exited.status).toBe("failed");
    });

    it("isolates globals and restores exact fixture bytes in each fresh working directory", async () => {
      const files = [{ path: "nested/input.txt", data: new TextEncoder().encode("original\n") }];
      const first = await capturePackageOracleScript({
        rscript,
        files,
        source: 'private <- 1\nwriteLines("changed", "nested/input.txt")',
      });
      expect(first.status).toBe("completed");
      const second = await capturePackageOracleScript({
        rscript,
        files,
        source: 'stopifnot(length(ls()) == 0L)\ncat(readLines("nested/input.txt"), "\\n")',
      });
      expect(second.status).toBe("completed");
      expect(normalized(second.stdout)).toBe("original \n");
      expect(second.freshSession).toBe(true);
    });

    it("preserves literal carriage returns in native output", async () => {
      const literal = "a\nb\r\nc\rd\r\r\ne";
      const captured = await capturePackageOracleScript({
        rscript,
        source: 'cat("a\\nb\\r\\nc\\rd\\r\\r\\ne")',
      });
      expect(captured.status).toBe("completed");
      if (captured.runtimeSettings?.osType === "windows") {
        expect(captured.stdout).toBe(literal.replaceAll("\n", "\r\n"));
        expect(captured.stdout.replaceAll("\r\n", "\n")).toBe(literal);
      } else {
        expect(captured.stdout).toBe(literal);
      }
      expect(captured.limitations.nativeLineEndings).toBe("preserved");
    });

    it("rejects incomplete condition observation when source removes the observers", async () => {
      const captured = await capturePackageOracleScript({
        rscript,
        source: "globalCallingHandlers(NULL)\n1 + 1",
      });
      expect(captured.exitCode).toBe(0);
      expect(normalized(captured.stdout)).toBe("[1] 2\n");
      expect(captured.status).toBe("failed");
      expect(captured.limitations.conditionObserversPresentAtCompletion).toBe(false);
    });
  },
);
