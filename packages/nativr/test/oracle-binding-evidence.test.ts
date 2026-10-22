import { expect, it } from "vitest";
import {
  collectOracleV2BindingEvidence,
  shadowedOracleV2Code,
} from "../../../scripts/lib/oracle-v2-binding-evidence.mjs";

function fixture(name: string) {
  return {
    cases: [
      {
        id: "owned-replacement-method",
        code: "TRUE",
        policy: "exact",
        bindingEvidence: [`base::${name}`],
      },
    ],
    capabilities: {
      targetRVersion: "4.6.1",
      packages: [{ name: "base", functions: [{ name, compatibility: "behavioral" }] }],
    },
    surface: {
      reference: { version: "R version 4.6.1 (owned metadata fixture)" },
      packages: [{ name: "base", exports: [{ name, callable: true }] }],
    },
  };
}

it("links registered replacement methods and emits a quoted shadow binding", () => {
  const { cases, capabilities, surface } = fixture("names<-.POSIXlt");
  expect(collectOracleV2BindingEvidence(cases, capabilities, surface)).toEqual([
    { binding: "base::names<-.POSIXlt", cases: ["owned-replacement-method"] },
  ]);
  expect(shadowedOracleV2Code("TRUE", "base::names<-.POSIXlt", "owned-marker", "error")).toBe(
    '`names<-.POSIXlt` <- function(...) stop("owned-marker")\nTRUE',
  );
});

it.each(["names<-.POSIXlt`", 'names<-.POSIXlt"', "names<-.POSIXlt;stop()", "names<-.POSIX lt"])(
  "rejects unsafe or unsupported shadow names: %s",
  (name) => {
    const { cases, capabilities, surface } = fixture(name);
    expect(() => collectOracleV2BindingEvidence(cases, capabilities, surface)).toThrow(
      "non-shadowable binding",
    );
  },
);
