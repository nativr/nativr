import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { inspectPackageDescription } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
import type { PackageDescriptionAssessment } from "../src/index.js";

it("retains pinned structural evidence without crediting full metadata or P7", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL(
        "../../../compatibility/package-check-evidence/description-structure-v1-0.315.0.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    observations: {
      package: { name: string; version: string };
      provenance: { sourceSha256: string; artifactSha256: string };
      rawReportSha256: string;
      descriptionAssessment: PackageDescriptionAssessment;
      metadataStage: { status: string; discovered: string[]; executed: string[] };
      p7Eligible: boolean;
    }[];
  };
  const corpus = JSON.parse(
    await readFile(new URL("../../../compatibility/package-corpus.json", import.meta.url), "utf8"),
  ) as {
    packages: { package: string; version: string; sourceSha256: string; artifactSha256: string }[];
  };
  expect(saved.observations.map((item) => item.package.name)).toEqual(["abind", "numDeriv"]);
  for (const item of saved.observations) {
    expect(corpus.packages.find((pkg) => pkg.package === item.package.name)).toMatchObject({
      version: item.package.version,
      sourceSha256: item.provenance.sourceSha256,
      artifactSha256: item.provenance.artifactSha256,
    });
    expect(item.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(item.descriptionAssessment.policy).toBe("description-structure-v1");
    expect(item.descriptionAssessment.checks.every((check) => check.status === "passed")).toBe(
      true,
    );
    expect(item.metadataStage.status).toBe("unexecuted");
    expect(item.metadataStage.executed).not.toContain("DESCRIPTION:full-validation");
    for (const check of item.descriptionAssessment.checks)
      expect(item.metadataStage.executed).toContain(check.id);
    expect(item.p7Eligible).toBe(false);
  }
});

const valid =
  "Package: fixture\nVersion: 1.0-2\nTitle: Independent Fixture\nDescription: Tests structural metadata checks.\nLicense: MIT\nAuthor: Fixture Author\nMaintainer: Fixture Author <fixture@example.invalid>\n";
const failures = (source: string) =>
  inspectPackageDescription(source)
    .checks.filter((check) => check.status === "failed")
    .map((check) => check.id);

const proseValues = [
  "",
  " ",
  ".",
  "..",
  "A.",
  "A!",
  "A?",
  "A...",
  "A. B",
  "a title",
  "A Title",
  "A title. ",
  "A title\n    continued",
  "A title\n    continued.",
  "fixture",
  "Package fixture",
  'A "Title"',
  "A 'Title'",
  "A\tB.",
  "A.\n    B.",
  "A.\n    B",
  "A;",
  "A:",
  "A.)",
  'A."',
  "A.'",
  "A.]",
  "A.}",
  "A.))",
  'A.)"',
  'A.""',
  "A!)",
  "A?)",
];
const proseInputs = ["Title", "Description"].flatMap((field) =>
  proseValues.map((value) => ({
    field,
    value,
    source:
      valid
        .split("\n")
        .filter((line) => !line.startsWith(`${field}:`))
        .join("\n") + `${field}: ${value}\n`,
  })),
);

it("retains native strict punctuation boundaries without claiming linguistic quality", () => {
  expect(inspectPackageDescription(valid).policy).toBe("description-structure-v5");
  const observedFailures = proseInputs.map(({ source }) =>
    failures(source).filter((id) => id.endsWith("-punctuation")),
  );
  // Black-box GNU R 4.6.1 strict diagnostics for the ordered fixtures above.
  expect(observedFailures.slice(0, proseValues.length).map((items) => items.length)).toEqual([
    0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0,
  ]);
  expect(observedFailures.slice(proseValues.length).map((items) => items.length)).toEqual([
    1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0,
    0,
  ]);
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches strict native prose diagnostics on independently authored descriptions",
  async () => {
    const source = `local({ f <- tempfile(); on.exit(unlink(f)); for (text in c(${proseInputs.map((input) => JSON.stringify(input.source)).join(",")})) { writeLines(text,f); result <- tools:::.check_package_description(f,strict=TRUE); cat(as.integer("bad_Title" %in% names(result)),as.integer("bad_Description" %in% names(result)),";",sep="|") } })`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      proseInputs
        .map(({ source }) => {
          const failed = failures(source);
          return `${Number(failed.includes("DESCRIPTION:title-punctuation"))}|${Number(failed.includes("DESCRIPTION:description-punctuation"))}|;`;
        })
        .join(""),
    );
  },
);

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches GNU R identity diagnostics for independently authored descriptions",
  async () => {
    const inputs = [
      valid,
      valid.replace("Package: fixture", "Package: x"),
      valid.replace("Package: fixture", "Package: fixture."),
      valid.replace("Version: 1.0-2", "Version: 1"),
      valid.replace("Version: 1.0-2", "Version: 1..2"),
    ];
    const source = `local({ f <- tempfile(); on.exit(unlink(f)); for (text in c(${inputs.map((input) => JSON.stringify(input)).join(",")})) { writeLines(text,f); result <- tools:::.check_package_description(f); cat(as.integer("bad_package" %in% names(result)),as.integer("bad_version" %in% names(result)),";",sep="|") } })`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    const actual = inputs
      .map((input) => {
        const failed = failures(input);
        return `${Number(failed.includes("DESCRIPTION:package-name"))}|${Number(failed.includes("DESCRIPTION:version"))}|;`;
      })
      .join("");
    expect(result.stdout).toBe(actual);
  },
);

it("accepts documented structure without claiming complete metadata validity", () => {
  const result = inspectPackageDescription(
    valid + "Depends: R (>= 4.0), helper (>= 1.0), helper (< 3.0)\nImports: stats\n",
  );
  expect(result.checks.every((check) => check.status === "passed")).toBe(true);
  expect(result.limitations).toHaveLength(2);
});

it("recognizes documented R revision syntax without treating it as a package version", () => {
  expect(failures(valid + "Depends: R (>= 4.0), R (>= r56550), helper (>= 1.0)\n")).toEqual([]);
  expect(failures(valid + "Imports: helper (>= r56550)\n")).toContain(
    "DESCRIPTION:dependency-syntax:Imports",
  );
});

it.each(["Package", "Version", "Title", "Description", "License", "Author", "Maintainer"])(
  "reports a missing %s field",
  (name) => {
    const source = valid
      .split("\n")
      .filter((line) => !line.startsWith(`${name}:`))
      .join("\n");
    expect(failures(source)).toContain(`DESCRIPTION:required:${name}`);
    expect(failures(source.trimEnd() + `\n${name}: \t`)).toContain(`DESCRIPTION:required:${name}`);
  },
);

it.each(["x", "fixture.", "1fixture", "fi_xt", "fïxture"])(
  "rejects invalid package name %s",
  (name) => {
    expect(failures(valid.replace("Package: fixture", `Package: ${name}`))).toContain(
      "DESCRIPTION:package-name",
    );
  },
);

it.each(["1", "1..2", "1.-2", "1.2a", "-1.2"])("rejects invalid package version %s", (version) => {
  expect(failures(valid.replace("Version: 1.0-2", `Version: ${version}`))).toContain(
    "DESCRIPTION:version",
  );
});

it.each([",stats", "stats,,utils", "stats (>=)", "stats (>= 1..0)", "x"])(
  "rejects malformed dependency list %s",
  (value) => {
    expect(failures(valid + `Imports: ${value}\n`)).toContain(
      "DESCRIPTION:dependency-syntax:Imports",
    );
  },
);

it("leaves Authors@R-derived fields unexecuted and does not interpret their source", () => {
  const source =
    valid
      .split("\n")
      .filter((line) => !/^(Author|Maintainer):/u.test(line))
      .join("\n") + 'Authors@R: stop("must not execute")\n';
  expect(
    inspectPackageDescription(source)
      .checks.filter((check) => check.status === "unexecuted")
      .map((check) => check.id),
  ).toEqual(["DESCRIPTION:required:Author", "DESCRIPTION:required:Maintainer"]);
});

it.each(["", valid + "\nPackage: other\n", valid + "Package: duplicate\n", "  orphan\n"])(
  "records failed DCF admission without throwing for %j",
  (source) => {
    expect(failures(source)).toContain("DESCRIPTION:dcf-record");
  },
);

const dependencyDiagnosticValues = [
  "stats",
  "stats,",
  ",stats",
  "stats,,utils",
  ",",
  ",,",
  "R",
  "R (>= r123)",
  "R (<= r123)",
  "R (== r123)",
  "R (!= r123)",
  "R (>= r)",
  "R (>= R123)",
  "R (>= r123.2)",
  "R (>= 1)",
  "R (>= 1.0)",
  "helper (>= 1)",
  "helper (>= 1.0)",
  "helper (>= 01.02)",
  "helper (>= 1.0-2)",
  "helper (>= 1..2)",
  "helper (>= 1.2.3.4)",
  "helper (= 1.0)",
  "helper (>= r123)",
  "helper(>=1.0)",
  "helper (>1.0)",
  "helper ( >= 1.0 )",
  "helper (>= 1.0 )",
  " helper , stats ",
  "helper (>= 1.0), helper (< 2.0)",
  "helper\t(>=\t1.0)",
  "R(>= 2.10)",
  "helper(>= 1.0)",
];
const dependencyDiagnosticExpected = [
  false,
  false,
  true,
  true,
  true,
  true,
  false,
  false,
  false,
  false,
  false,
  true,
  true,
  true,
  true,
  false,
  true,
  false,
  false,
  false,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  false,
  false,
  false,
];
const dependencyDiagnosticInputs = (
  ["Depends", "Imports", "Suggests", "Enhances"] as const
).flatMap((field) =>
  dependencyDiagnosticValues.map((value) => ({ field, source: valid + `${field}: ${value}\n` })),
);
const priorityValues = [
  "base",
  "recommended",
  "Base",
  "BASE",
  "Recommended",
  " recommended ",
  "base recommended",
  "optional",
  "NA",
  "",
];

it("matches recorded native dependency diagnostic boundaries across four fields", () => {
  for (const field of ["Depends", "Imports", "Suggests", "Enhances"]) {
    expect(
      dependencyDiagnosticValues.map((value) =>
        failures(valid + `${field}: ${value}\n`).includes(`DESCRIPTION:dependency-syntax:${field}`),
      ),
    ).toEqual(dependencyDiagnosticExpected);
  }
});

it("rejects reserved priorities without rejecting other priority text", () => {
  expect(
    priorityValues.map((value) =>
      failures(valid + `Priority: ${value}\n`).includes("DESCRIPTION:reserved-priority"),
    ),
  ).toEqual([true, true, true, true, true, true, false, false, false, false]);
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native reserved priority and dependency diagnostics on independent fixtures",
  async () => {
    const inputs = [
      ...dependencyDiagnosticInputs.map((input) => input.source),
      ...priorityValues.map((value) => valid + `Priority: ${value}\n`),
    ];
    const source = `local({f<-tempfile();on.exit(unlink(f));for(text in c(${inputs.map((input) => JSON.stringify(input)).join(",")})){writeLines(text,f);r<-tools:::.check_package_description(f,strict=TRUE);cat(as.integer("bad_depends_or_suggests_or_imports" %in% names(r)),as.integer("bad_priority" %in% names(r)),";",sep="|")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      inputs
        .map((input) => {
          const failed = failures(input);
          return `${Number(failed.some((id) => id.startsWith("DESCRIPTION:dependency-syntax:")))}|${Number(failed.includes("DESCRIPTION:reserved-priority"))}|;`;
        })
        .join(""),
    );
  },
);

const vignetteBuilderValues = [
  "",
  "x",
  "R",
  "knitr",
  "knitr,rmarkdown",
  "knitr, rmarkdown",
  "knitr,",
  "knitr,,rmarkdown",
  ",knitr",
  ",",
  ",,",
  "1builder",
  "builder.",
  ".builder",
  "a_b",
  "a-b",
  "a b",
  "a\tb",
  "a\nb",
  "a/b",
  "a::b",
  "a (>= 1.0)",
  "a.b",
  "a..b",
  "a1",
  "A",
  "é",
  "knitr , rmarkdown",
  "knitr ,",
  "knitr, , rmarkdown",
];
const vignetteBuilderInputs = vignetteBuilderValues.map(
  (value) => valid + `VignetteBuilder: ${value.replaceAll("\n", "\n ")}\n`,
);
it("checks observed VignetteBuilder syntax independently of package names and availability", () => {
  expect(
    vignetteBuilderInputs.map((source) =>
      Number(failures(source).includes("DESCRIPTION:vignette-builder-syntax")),
    ),
  ).toEqual([
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
  ]);
  expect(
    inspectPackageDescription(valid).checks.some(
      (check) => check.id === "DESCRIPTION:vignette-builder-syntax",
    ),
  ).toBe(false);
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native VignetteBuilder diagnostics",
  async () => {
    const source = `local({f<-tempfile();on.exit(unlink(f));for(text in c(${vignetteBuilderInputs.map((input) => JSON.stringify(input)).join(",")})){writeLines(text,f);result<-tools:::.check_package_description(f,strict=TRUE);cat(as.integer("bad_vignettebuilder" %in% names(result)),";",sep="")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      vignetteBuilderInputs
        .map(
          (input) => Number(failures(input).includes("DESCRIPTION:vignette-builder-syntax")) + ";",
        )
        .join(""),
    );
  },
);
