import { expect, it } from "vitest";
import { inspectPackageLicense } from "../src/index.js";
import { LICENSE_CATALOG } from "../src/license-catalog.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
const description = (license: string): string =>
  `Package: fixture\nVersion: 1.0\nLicense: ${license}\n`;
const flags = (license: string, files: readonly string[]): boolean[] =>
  inspectPackageLicense(description(license), files)
    .checks.slice(0, 4)
    .map((check) => check.status === "failed");
const values = [
  ...new Set(
    LICENSE_CATALOG.flatMap((row) => [row.name, row.abbreviation, row.label, row.short]).filter(
      Boolean,
    ),
  ),
  "Unlimited",
  "GPL (>= 2)",
  "GPL (>= 2, < 3)",
  "GPL (>= 4)",
  "GPL (== 2.0)",
  "GPL (!= 2)",
  "GPL-2 | GPL-3",
  "GPL-2|GPL-3",
  "MIT |",
  "| MIT",
  "GPL-2 || GPL-3",
  "",
  "madeup",
  "Apache-2.0",
  "MIT + file LICENSE",
  "BSD_2_clause + file LICENCE",
  "BSD_3_clause + file LICENSE",
  "GPL-2 + file LICENSE",
  "GPL-3 + file LICENSE",
  "GPL (>= 2) + file LICENSE",
  "MIT+file LICENSE",
  "file LICENSE",
  "file LICENCE",
  "file other",
  "GPL-02",
  "GNU General Public License 2",
  "Apache License (== 2.0)",
];
it("recognizes the public catalog without granting full license-validation credit", () => {
  for (const row of LICENSE_CATALOG) expect(flags(row.name, [])[0], row.name).toBe(false);
  expect(inspectPackageLicense(description("GPL-3")).checks.at(-1)?.status).toBe("unexecuted");
  expect(inspectPackageLicense(description("GPL-3"), []).limitations).toHaveLength(2);
});
it("checks expressions, templates, permitted extensions and exact root file references", () => {
  expect(flags("MIT", [])).toEqual([false, true, false, false]);
  expect(flags("MIT + file LICENSE", [])).toEqual([false, false, false, true]);
  expect(flags("MIT + file LICENSE", ["LICENSE"])).toEqual([false, false, false, false]);
  expect(flags("GPL-2 + file LICENSE", ["LICENSE"])).toEqual([false, false, true, false]);
  expect(flags("GPL (>= 4)", [])[0]).toBe(true);
  expect(flags("file LICENSE", ["inst/LICENSE"])[3]).toBe(true);
  expect(inspectPackageLicense("orphan", []).checks[0]?.status).toBe("failed");
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native catalog and license structural diagnostics",
  async () => {
    const input = values.flatMap((license) =>
      [false, true].map((present) => ({ license, present })),
    );
    const source = `local({d<-tempfile();dir.create(d);on.exit(unlink(d,recursive=TRUE));f<-file.path(d,"DESCRIPTION");specs<-c(${input.map((x) => JSON.stringify(description(x.license))).join(",")});present<-c(${input.map((x) => (x.present ? "TRUE" : "FALSE")).join(",")});for(i in seq_along(specs)){for(n in c("LICENSE","LICENCE")){p<-file.path(d,n);if(file.exists(p))unlink(p);if(present[i])writeLines(c("YEAR: 2026","COPYRIGHT HOLDER: Ada"),p)};writeLines(specs[i],f);r<-tools:::.check_package_license(f,d);cat(as.integer(isFALSE(r$is_canonical)),as.integer(length(r$miss_extension)>0L),as.integer(length(r$bad_extensions)>0L),as.integer(length(r$bad_pointers)>0L),";",sep="|")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    const actual = input.map(
      (x) =>
        flags(x.license, x.present ? ["LICENSE", "LICENCE"] : [])
          .map(Number)
          .join("|") + "|;",
    );
    const expected = result.stdout
      .split(";")
      .slice(0, -1)
      .map((x) => x + ";");
    for (let i = 0; i < input.length; i++)
      expect.soft(actual[i], JSON.stringify(input[i])).toBe(expected[i]);
  },
);

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "pins the observable license catalog to GNU R 4.6.1",
  async () => {
    const source =
      'local({d<-tools:::R_license_db();for(i in seq_len(nrow(d)))cat(d$Name[i],d$Abbrev[i],d$Version[i],d$SSS[i],d$Labels[i],as.integer(d$Extensible[i]=="yes"),";",sep="|")})';
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      LICENSE_CATALOG.map((row) =>
        [
          row.name,
          row.abbreviation,
          row.version,
          row.short,
          row.label,
          Number(row.extensible),
          ";",
        ].join("|"),
      ).join(""),
    );
  },
);

const templateTexts = [
  "",
  "text",
  "YEAR: 2026",
  "COPYRIGHT HOLDER: Ada",
  "YEAR: 2026\nCOPYRIGHT HOLDER: Ada",
  "YEAR: xyz\nCOPYRIGHT HOLDER: Ada",
  "YEAR: 2026\nCOPYRIGHT HOLDER:",
  "YEAR: 2026\nCOPYRIGHT HOLDER: fixture authors",
  "Year: 2026\nCopyright Holder: Ada",
  "YEAR: 2026\nCOPYRIGHT HOLDER: Ada\nEXTRA: yes",
  "YEAR: 2026\nYEAR: 2025\nCOPYRIGHT HOLDER: Ada",
  "YEAR: 2026\n\nCOPYRIGHT HOLDER: Ada",
  "YEAR: 2026\nCOPYRIGHT HOLDER: .",
  "YEAR: 2026\nCOPYRIGHT HOLDER: \n  .",
  " YEAR: 2026",
  "YEAR: 2026\nCOPYRIGHT HOLDER: Ada\n\nYEAR: 2025\nCOPYRIGHT HOLDER: Bob",
  "YEAR: 2026\nCOPYRIGHT HOLDER: Ada\nORGANIZATION: Example",
];
const templateLicenses = [
  "MIT + file LICENSE",
  "BSD_2_clause + file LICENSE",
  "BSD_3_clause + file LICENSE",
  "file LICENSE",
  "GPL-3 + file LICENSE",
  "GPL-3 | MIT + file LICENSE",
  "MIT + file LICENSE | BSD_3_clause + file LICENCE",
  "GPL-3 + file LICENCE | MIT + file LICENSE",
];
const templateAssessment = (license: string, text: string) =>
  inspectPackageLicense(
    description(license),
    ["LICENSE", "LICENCE"],
    new Map([
      ["LICENSE", text],
      ["LICENCE", "text"],
    ]),
  );
const templateFlags = (license: string, text: string): number[] =>
  ["template-dcf", "template-fields"].map((id) =>
    Number(
      templateAssessment(license, text).checks.some(
        (check) => check.id === `DESCRIPTION:License:${id}` && check.status === "failed",
      ),
    ),
  );
it("validates template records without imposing unsupported field meanings", () => {
  expect(
    templateFlags("MIT + file LICENSE", "YEAR: xyz\nCOPYRIGHT HOLDER: fixture authors"),
  ).toEqual([0, 0]);
  expect(templateFlags("MIT + file LICENSE", "")).toEqual([0, 0]);
  expect(templateFlags("MIT + file LICENSE", "YEAR: 2026\n\nCOPYRIGHT HOLDER: Ada")).toEqual([
    0, 1,
  ]);
  expect(templateFlags("BSD_3_clause + file LICENSE", "YEAR: 2026\nCOPYRIGHT HOLDER: Ada")).toEqual(
    [0, 1],
  );
  expect(templateFlags("MIT + file LICENSE", "text")).toEqual([1, 0]);
});
it("leaves unavailable template contents unexecuted", () => {
  expect(
    inspectPackageLicense(description("MIT + file LICENSE"), ["LICENSE"]).checks.at(-1)?.status,
  ).toBe("unexecuted");
  expect(templateFlags("file LICENSE", "text")).toEqual([0, 0]);
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native template-file diagnostics across records and alternatives",
  async () => {
    const inputs = templateLicenses.flatMap((license) =>
      templateTexts.map((text) => ({ license, text })),
    );
    const source = `local({d<-tempfile();dir.create(d);on.exit(unlink(d,recursive=TRUE));f<-file.path(d,"DESCRIPTION");specs<-c(${inputs.map((x) => JSON.stringify(description(x.license))).join(",")});texts<-c(${inputs.map((x) => JSON.stringify(x.text)).join(",")});writeLines("text",file.path(d,"LICENCE"));for(i in seq_along(specs)){writeLines(specs[i],f);writeLines(texts[i],file.path(d,"LICENSE"));r<-tools:::.check_package_license(f,d);cat(as.integer(isTRUE(r$license_stub_is_bad_DCF)),as.integer(length(r$license_stub_fields_not_complete)>0L),";",sep="|")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    const expected = result.stdout
      .split(";")
      .slice(0, -1)
      .map((x) => x + ";");
    for (let i = 0; i < inputs.length; i++) {
      const x = inputs[i]!;
      expect
        .soft(templateFlags(x.license, x.text).join("|") + "|;", JSON.stringify(x))
        .toBe(expected[i]);
    }
  },
);
