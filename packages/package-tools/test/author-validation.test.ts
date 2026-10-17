import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { EffectiveAuthorAssessment } from "../../../scripts/lib/package-author-validation.mjs";
import { assessEffectiveAuthorFields } from "../../../scripts/lib/package-author-validation.mjs";
import type { AuthorFieldsObservation } from "../../../scripts/lib/package-author-fields-observer.mjs";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

it("records effective author checks without promoting complete metadata or P7", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL(
        "../../../compatibility/package-check-evidence/effective-author-fields-v1-0.318.0.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    observations: {
      package: { name: string };
      authorMetadataAssessment: EffectiveAuthorAssessment;
      metadataStage: { status: string; executed: string[] };
      p7Eligible: boolean;
      rawReportSha256: string;
    }[];
  };
  expect(saved.observations.map((x) => x.package.name)).toEqual(["abind", "numDeriv"]);
  for (const item of saved.observations) {
    expect(item.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(item.authorMetadataAssessment.checks).toHaveLength(3);
    for (const check of item.authorMetadataAssessment.checks) {
      expect(check.status).toBe("passed");
      expect(item.metadataStage.executed).toContain(check.id);
    }
    expect(item.metadataStage.status).toBe("unexecuted");
    expect(item.metadataStage.executed).not.toContain("DESCRIPTION:full-validation");
    expect(item.p7Eligible).toBe(false);
  }
});
const cases = [
  ['Ada <"a\tb"@x>', true],
  ["Ada <a@x>", true],
  ["a@x", false],
  ["<a@x>", true],
  [" Ada <a@x> ", true],
  ["Ada<a@x>", true],
  ["Ada <a@x> extra", false],
  ["Ada <a@x>, Grace <g@x>", true],
  ['"Ada, Author" <a@x>', true],
  ["Ada <a@x> (maintainer)", false],
  ["Ada < a@x >", false],
  ["Ada <a@@x>", false],
  ["Ada <a@x.>", false],
  ['Ada <"a b"@x>', true],
  ['Ada <"a@b"@x>', true],
  ['Ada <"a\\"b"@x>', true],
  ['Ada <""@x>', false],
  ["Ada <a@localhost>", true],
  ["Ada <a@[127.0.0.1]>", false],
  ["Ada <a@x_y>", false],
  ["Ada <a@-x>", true],
  ["Ada <a@x->", true],
  ["Ada <a..b@x>", false],
  ["", false],
  ["Ada <invalid>, Grace <g@x>", true],
  ["Ada <a@x>, Grace <invalid>", false],
  ["<<a@x>>", false],
] as const;
it.each(cases)("validates observed Maintainer syntax for %s", (maintainer, valid) => {
  const result = assessEffectiveAuthorFields(
    new Map([
      ["Author", "Ada"],
      ["Maintainer", maintainer],
    ]),
    null,
  );
  expect(result.checks.find((x) => x.id === "DESCRIPTION:maintainer-address")?.status).toBe(
    valid ? "passed" : "failed",
  );
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native Maintainer diagnostics for independent descriptions",
  async () => {
    const descriptions = cases.map(
      ([maintainer]) =>
        `Package: fixture\nVersion: 1.0\nTitle: Independent Fixture\nDescription: Independently authored metadata fixture.\nLicense: MIT\nAuthor: Ada\nMaintainer: ${maintainer}\n`,
    );
    const source = `local({f<-tempfile();on.exit(unlink(f));for(text in c(${descriptions.map((x) => JSON.stringify(x)).join(",")})){writeLines(text,f);r<-tools:::.check_package_description(f);cat(as.integer(!("bad_maintainer" %in% names(r))),"|",sep="")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(cases.map(([, valid]) => `${Number(valid)}|`).join(""));
  },
);
const verified: AuthorFieldsObservation = {
  schemaVersion: 1,
  policy: "authors-derived-fields-v1",
  sourceSha256: "fixture",
  oracleSourceSha256: "fixture",
  actual: { status: "completed", fields: { author: "Ada", maintainer: "Ada <a@x>" } },
  expected: { status: "completed", fields: { author: "Ada", maintainer: "Ada <a@x>" } },
  outcome: "match",
  limitations: [],
};
it("uses matching completed derivation without replacing explicit empty fields", () => {
  const fields = new Map([["Authors@R", 'person("Ada")']]);
  expect(
    assessEffectiveAuthorFields(fields, verified).checks.every((x) => x.status === "passed"),
  ).toBe(true);
  fields.set("Author", "");
  expect(assessEffectiveAuthorFields(fields, verified).checks[0]?.status).toBe("failed");
});
it("does not infer fields from incomplete, contradictory or missing observations", () => {
  const fields = new Map([["Authors@R", 'person("Ada")']]);
  for (const observation of [
    null,
    { ...verified, outcome: "incomplete" as const },
    { ...verified, expected: { status: "failed", fields: null } },
    {
      ...verified,
      expected: { status: "completed", fields: { author: "Other", maintainer: "Ada <a@x>" } },
    },
  ]) {
    expect(
      assessEffectiveAuthorFields(fields, observation).checks.every(
        (x) => x.status === "unexecuted",
      ),
    ).toBe(true);
  }
  expect(
    assessEffectiveAuthorFields(new Map(), null).checks.every((x) => x.status === "failed"),
  ).toBe(true);
});
