import { expect, it } from "vitest";
import { parseDcf, parseDcfRecords } from "../src/dcf.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "confirms the independent record-boundary fixture through GNU R read.dcf",
  async () => {
    const source =
      'local({ x <- read.dcf(textConnection("Package: fixture\\n \\t\\nVersion: 1.0\\n")); cat(nrow(x), is.na(x[1, "Version"]), is.na(x[2, "Package"]), sep="|") })';
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status).toBe("completed");
    expect(result.stdout).toBe("2|TRUE|TRUE");
  },
);

// Independently authored cases for the record boundaries documented by base::read.dcf.
it.each(["\n", " \t\n", "\r\n"])("rejects a DESCRIPTION split by %j", (separator) => {
  expect(() => parseDcf(`Package: fixture\n${separator}Version: 1.0\n`)).toThrow(
    "exactly one DCF record",
  );
});

it("allows leading/trailing blank lines while preserving ordinary continuation fields", () => {
  expect([
    ...parseDcf(" \t\n\nPackage: fixture\nDescription: first\n  second\n\tthird\n\n \t\n"),
  ]).toEqual([
    ["Package", "fixture"],
    ["Description", "first second third"],
  ]);
});

it("does not attach an orphan continuation after a record separator", () => {
  expect(() => parseDcf("Package: fixture\n\n  Version: 1.0\n")).toThrow("exactly one DCF record");
  expect(() => parseDcfRecords("Package: fixture\n\n  Version: 1.0\n")).toThrow(
    "continuation line",
  );
});

it("keeps repository records separate across whitespace separators", () => {
  const records = parseDcfRecords(
    " \nPackage: first\nVersion: 1.0\n \t\n\nPackage: second\nVersion: 2.0\n\t\n",
  );
  expect(records.map((record) => [...record])).toEqual([
    [
      ["Package", "first"],
      ["Version", "1.0"],
    ],
    [
      ["Package", "second"],
      ["Version", "2.0"],
    ],
  ]);
});
