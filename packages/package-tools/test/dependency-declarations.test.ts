import { expect, it } from "vitest";
import { inspectPackageDependencyDeclarations } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
const base =
  "Package: fixture\nVersion: 1.0\nTitle: Fixture\nDescription: Independent fixture.\nLicense: GPL-3\nAuthor: Ada\nMaintainer: Ada <ada@example.com>\n";
const cases = [
  ...["", "Imports", "Depends", "Suggests", "Enhances", "LinkingTo"].map((field) => ({
    description: base + (field ? `${field}: nativrfixturedep\n` : ""),
    namespace: "importFrom(nativrfixturedep,helper)",
  })),
  ...[
    "import(stats)",
    "importFrom(tools,md5sum)",
    "import(nativrfixturedep,stats)",
    'importFrom("nativrfixturedep",helper)',
    "importFrom('nativrfixturedep',helper)",
    "importFrom(`nativrfixturedep`,helper)",
  ].map((namespace) => ({ description: base, namespace })),
];
it("requires non-base namespace imports in Imports or Depends", () => {
  expect(
    cases.map((x) => inspectPackageDependencyDeclarations(x.description, x.namespace).missing),
  ).toEqual([
    ["nativrfixturedep"],
    [],
    [],
    ["nativrfixturedep"],
    ["nativrfixturedep"],
    ["nativrfixturedep"],
    [],
    [],
    ["nativrfixturedep"],
    ["nativrfixturedep"],
    ["nativrfixturedep"],
    ["nativrfixturedep"],
  ]);
});
it("deduplicates imports and keeps unsupported declarations unexecuted", () => {
  expect(
    inspectPackageDependencyDeclarations(
      base,
      "# import(ignored)\nimportFrom(nativrfixturedep,helper)\nimport(nativrfixturedep)",
    ).missing,
  ).toEqual(["nativrfixturedep"]);
  for (const namespace of [
    "if(TRUE) import(nativrfixturedep)",
    'import(nativrfixturedep,except=stop("unused"))',
    'import("unclosed)',
  ])
    expect(inspectPackageDependencyDeclarations(base, namespace).checks[0]?.status).toBe(
      "unexecuted",
    );
});
const controlCases = [
  "import(nativrfixturedep,except=helper)",
  "import(except=helper,nativrfixturedep)",
  "import(nativrfixturedep,except=c(helper,other))",
  'import(nativrfixturedep,except=c("helper","other"),stats)',
  "import(foo=nativrfixturedep)",
  "import(nativrfixturedep,ex=helper)",
  "importFrom(pkg=nativrfixturedep,helper)",
  "importFrom(nativrfixturedep,foo=helper)",
  "import(nativrfixturedep,except=c())",
  'import(nativrfixturedep,except="comma,name")',
  'import(nativrfixturedep,"except"=helper)',
];
it("audits literal exclusion controls without counting them as packages", () => {
  for (const namespace of controlCases.filter((value) => !value.includes("ex=helper")))
    expect(inspectPackageDependencyDeclarations(base, namespace).missing, namespace).toEqual([
      "nativrfixturedep",
    ]);
  expect(
    inspectPackageDependencyDeclarations(base, "import(nativrfixturedep,ex=helper)").missing,
  ).toEqual(["helper", "nativrfixturedep"]);
});
it("treats only the first except argument as a control", () => {
  expect(
    inspectPackageDependencyDeclarations(
      base,
      "import(nativrfixturedep,except=a,except=otherfixture)",
    ).missing,
  ).toEqual(["nativrfixturedep", "otherfixture"]);
});
const nativeCases = [
  { description: base, namespace: "import(nativrfixturedep,except=a,except=otherfixture)" },
  ...cases,
  ...controlCases.map((namespace) => ({ description: base, namespace })),
];
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native missing namespace dependency diagnostics",
  async () => {
    const source = `local({d<-tempfile();dir.create(d);dir.create(file.path(d,"R"));on.exit(unlink(d,recursive=TRUE));descriptions<-c(${nativeCases.map((x) => JSON.stringify(x.description)).join(",")});namespaces<-c(${nativeCases.map((x) => JSON.stringify(x.namespace)).join(",")});for(i in seq_along(descriptions)){writeLines(descriptions[i],file.path(d,"DESCRIPTION"));writeLines(namespaces[i],file.path(d,"NAMESPACE"));r<-tools:::.check_package_depends(d,force_suggests=FALSE);cat(paste(r$missing_namespace_depends,collapse=","),";",sep="")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      nativeCases
        .map(
          (x) =>
            inspectPackageDependencyDeclarations(x.description, x.namespace).missing.join(",") +
            ";",
        )
        .join(""),
    );
  },
);
