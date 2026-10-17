import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { AuthorsObservation } from "../../../scripts/lib/package-authors-observer.mjs";
import { createR } from "../../nativr/src/index.js";
import { observePackageAuthors } from "../../../scripts/lib/package-authors-observer.mjs";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

it("retains pinned Authors@R evidence without promoting full metadata validation", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL(
        "../../../compatibility/package-check-evidence/authors-person-roles-v1-0.317.0.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    observations: {
      package: { name: string };
      authorsObservation: AuthorsObservation | null;
      rawReportSha256: string;
      p7Eligible: boolean;
      metadataStage: { status: string; executed: string[] };
    }[];
  };
  expect(saved.observations.map((x) => x.package.name)).toEqual(["abind", "numDeriv"]);
  expect(saved.observations[0]?.authorsObservation).toMatchObject({
    outcome: "match",
    valid: true,
    actual: { state: "1|1|1" },
    expected: { state: "1|1|1" },
  });
  expect(saved.observations[0]?.metadataStage.executed).toContain(
    "DESCRIPTION:Authors@R:person-roles",
  );
  expect(saved.observations[1]?.authorsObservation).toBeNull();
  for (const item of saved.observations) {
    expect(item.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(item.p7Eligible).toBe(false);
    expect(item.metadataStage.status).toBe("unexecuted");
    expect(item.metadataStage.executed).not.toContain("DESCRIPTION:full-validation");
  }
});

const fixtures = [
  ['person("Ada",role="cre",email=\'"a\\tb"@x\')', "1|1|1"],
  ['person("Ada",role="cre",email=\'"a b"@x\')', "1|1|1"],
  ['person("Ada",role="cre",email=\'"a@b"@x\')', "1|1|1"],
  ['person("Ada","Lovelace",role=c("aut","cre"),email="ada@example.invalid")', "1|1|1"],
  ['c(person("Ada",role="aut"),person("Grace",role="cre",email="g@example.invalid"))', "1|1|1"],
  ['person("Ada",role="cre",email="a@example.invalid")', "1|1|1"],
  ['person("Ada",role="aut")', "1|1|0"],
  ['person("Ada",role="cph")', "1|1|0"],
  ['person("Ada")', "1|0|0"],
  ['person(" ",role="cre",email="a@x")', "1|0|0"],
  ['person("Ada",role="cre",email="a@x.")', "1|1|0"],
  ['person("Ada",role="cre",email="a..b@x")', "1|1|0"],
  ['person("Ada",role="cre",email="a@x_y")', "1|1|0"],
  ['person("Ada",role="cre",email="a+b@x")', "1|1|1"],
  ['person("Ada",role="cre",email=c("invalid","a@x"))', "1|1|0"],
  ['person(role=c("aut","cre"),email="a@example.invalid")', "1|0|0"],
  ['person("Ada",role=c("aut","cre"),email="invalid")', "1|1|0"],
  ['person("Ada",role=c("aut","cre"),email=c("a@x","b@x"))', "1|1|1"],
  [
    'c(person("Ada",role=c("aut","cre"),email="a@x"),person("Grace",role="cre",email="b@x"))',
    "1|1|0",
  ],
  ["person()", "1|0|0"],
  ['list("Ada")', "0|0|0"],
] as const;
async function capture(source: string) {
  const r = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
  });
  try {
    const result = await r.evalDetailed(source);
    return {
      status: "completed",
      stdout: result.output
        .filter((x) => x.stream === "stdout")
        .map((x) => x.text)
        .join(""),
    };
  } finally {
    await r.dispose();
  }
}
it.each(fixtures)("checks author/maintainer roles for %s", async (expression, state) => {
  const result = await observePackageAuthors(expression, {
    actual: capture,
    expected: () => Promise.resolve({ status: "completed", stdout: `\nNATIVR_AUTHORS:${state}\n` }),
  });
  expect(result).toMatchObject({ outcome: "match", actual: { state }, valid: state === "1|1|1" });
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "compares role evidence with native evaluation",
  async () => {
    for (const [expression] of fixtures) {
      const result = await observePackageAuthors(expression, {
        actual: capture,
        expected: (source) =>
          capturePackageOracleScript({ source, rscript: process.env.NATIVR_RSCRIPT ?? "Rscript" }),
      });
      expect(result?.outcome, expression).toBe("match");
    }
  },
);
it("keeps evaluation failures incomplete and absent fields inapplicable", async () => {
  const runners = { actual: capture, expected: () => Promise.reject(new Error("unavailable")) };
  expect(await observePackageAuthors(undefined, runners)).toBeNull();
  expect(await observePackageAuthors('stop("fixture")', runners)).toMatchObject({
    outcome: "incomplete",
    valid: false,
  });
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "agrees with native DESCRIPTION author diagnostics on independent fixtures",
  async () => {
    const descriptions = fixtures.map(
      ([expression]) =>
        `Package: fixture\nVersion: 1.0\nTitle: Independent Fixture\nDescription: Independently authored metadata fixture.\nLicense: MIT\nAuthors@R: ${expression}\n`,
    );
    const source = `local({ f<-tempfile(); on.exit(unlink(f)); for(text in c(${descriptions.map((x) => JSON.stringify(x)).join(",")})){writeLines(text,f); checks<-names(tools:::.check_package_description(f)); bad<-any(grepl("^bad_authors_at_R|^bad_maintainer$",checks)); cat(as.integer(!bad),"|",sep="")}})`;
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      fixtures.map(([, state]) => `${Number(state === "1|1|1")}|`).join(""),
    );
  },
);

it.each(["NATIVR_AUTHORS:1|1\n", "NATIVR_AUTHORS:1|1|1\ntrailing", ""])(
  "rejects incomplete or unframed author evidence %j",
  async (stdout) => {
    const result = await observePackageAuthors('person("Ada")', {
      actual: () => Promise.resolve({ status: "completed", stdout }),
      expected: () => Promise.resolve({ status: "completed", stdout: "NATIVR_AUTHORS:1|1|1\n" }),
    });
    expect(result).toMatchObject({ outcome: "incomplete", valid: false });
  },
);
