import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { collectPackageSourceDependencyInputs } from "../src/index.js";

it("keeps unreadable nested tests as redacted unresolved inputs while collecting admitted sources", () => {
  const invalid = new Uint8Array([0x23, 0xff, 0x80]);
  const result = collectPackageSourceDependencyInputs(
    {
      description: "Package: ownedfixture\nVersion: 1.0.0\n",
      rSources: [{ path: "R/own.R", source: "stats::median" }],
    },
    [
      { path: "tests/selected.R", data: new TextEncoder().encode("library(stats)") },
      { path: "tests/nested/unselected.R", data: invalid },
      { path: "tests/data.bin", data: invalid },
      {
        path: "man/own.Rd",
        data: new TextEncoder().encode(
          String.raw`\name{own}\title{Own}\alias{own}\examples{utils::head(1:2)}`,
        ),
      },
    ],
  );
  expect(result.sources.map(({ role }) => role)).toEqual(["package", "test", "example"]);
  expect(result.sources[2]).toMatchObject({
    path: "man/own.Rd#examples:1:1:run",
    source: "utils::head(1:2)",
  });
  expect(result.failures).toEqual([
    {
      path: "tests/nested/unselected.R",
      role: "test",
      status: "unexecuted",
      reason: "source-decode-failed",
      sha256: createHash("sha256").update(invalid).digest("hex"),
    },
  ]);
  expect(JSON.stringify(result.failures)).not.toContain('source"');
});

it("decodes admitted latin1 test files without changing their text", () => {
  const result = collectPackageSourceDependencyInputs(
    {
      description: "Package: ownedfixture\nVersion: 1.0.0\nEncoding: latin1\n",
      rSources: [],
    },
    [{ path: "tests/own.R", data: new Uint8Array([0x23, 0xe9]) }],
  );
  expect(result.failures).toEqual([]);
  expect(result.sources).toEqual([{ path: "tests/own.R", role: "test", source: "#é" }]);
});

it("excludes dontrun dependencies while retaining default and donttest references", () => {
  const result = collectPackageSourceDependencyInputs(
    { description: "Package: ownedfixture\nVersion: 1.0.0\n", rSources: [] },
    [
      {
        path: "man/own.Rd",
        data: new TextEncoder().encode(String.raw`\name{own}\title{Own}\alias{own}\examples{
      if (FALSE) library(zzownedrun)
      \dontrun{if (FALSE) library(zzowneddontrun)}
      \donttest{if (FALSE) library(zzowneddonttest)}
    }`),
      },
    ],
  );
  expect(result.failures).toEqual([]);
  expect(result.sources.some(({ source }) => source.includes("zzownedrun"))).toBe(true);
  expect(result.sources.some(({ source }) => source.includes("zzowneddonttest"))).toBe(true);
  expect(result.sources.some(({ source }) => source.includes("zzowneddontrun"))).toBe(false);
});
