import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { AuthorFieldsObservation } from "../../../scripts/lib/package-author-fields-observer.mjs";
import { createR } from "../../nativr/src/index.js";
import { observePackageAuthorFields } from "../../../scripts/lib/package-author-fields-observer.mjs";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

it("retains pinned field evidence without claiming full metadata validity", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL(
        "../../../compatibility/package-check-evidence/authors-derived-fields-v1-0.318.0.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    observations: {
      package: { name: string };
      authorFieldsObservation: AuthorFieldsObservation | null;
      rawReportSha256: string;
      p7Eligible: boolean;
      metadataStage: { status: string; executed: string[] };
    }[];
  };
  expect(saved.observations.map((x) => x.package.name)).toEqual(["abind", "numDeriv"]);
  const first = saved.observations[0]!;
  expect(first.authorFieldsObservation?.outcome).toBe("match");
  expect(first.authorFieldsObservation?.actual.fields).toEqual(
    first.authorFieldsObservation?.expected.fields,
  );
  expect(first.metadataStage.executed).toContain("DESCRIPTION:Authors@R:derived-fields");
  expect(saved.observations[1]?.authorFieldsObservation).toBeNull();
  for (const item of saved.observations) {
    expect(item.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(item.p7Eligible).toBe(false);
    expect(item.metadataStage.status).toBe("unexecuted");
    expect(item.metadataStage.executed).not.toContain("DESCRIPTION:full-validation");
  }
});
const fixtures = [
  [
    'person("Zoë",role="cre",email="z@x",comment="line\\none")',
    { encoding: "UTF-8" },
    "Zoë [cre] (line one)",
    "Zoë <z@x>",
  ],
  [
    'person("  Ada  "," Love\\nlace ",role=" cre ",email=" a@x ",comment=" one  two\\tthree ")',
    {},
    "Ada Love lace [cre] (one two three)",
    "Ada Love\nlace <a@x>",
  ],
  ['person("Ada",role="cre")', {}, "Ada [cre]", ""],
  ['person(role="cre",email="a@x")', {}, "", ""],
  ['person("Ada",role="cre",email="invalid")', {}, "Ada [cre]", "Ada <invalid>"],
  [
    'person("Ada","Lovelace",role=c("aut","cre"),email="a@x")',
    {},
    "Ada Lovelace [aut, cre]",
    "Ada Lovelace <a@x>",
  ],
  [
    'c(person("Ada",role="aut"),person("Grace",role="cre",email="g@x"),person("NoRole"))',
    {},
    "Ada [aut],\n  Grace [cre]",
    "Grace <g@x>",
  ],
  ['person("Ada",role="cre",email=c("a@x","b@x"))', {}, "Ada [cre]", "Ada <a@x>"],
  [
    'person("Ada",role="aut",comment=c(ORCID="0000-0002-1825-0097"))',
    {},
    "Ada [aut] (ORCID: <https://orcid.org/0000-0002-1825-0097>)",
    "",
  ],
  [
    'person("Ada",role="cre",email="a@x")',
    { author: "Explicit", maintainer: "Other <other@x>" },
    "Explicit",
    "Other <other@x>",
  ],
  ['person("Ada",role="cre",email="a@x")', { author: "" }, "", "Ada <a@x>"],
  ['person("Ada",role="cre",email="a@x")', { maintainer: "" }, "Ada [cre]", ""],
  ["person()", {}, "", ""],
  ['person("Ada")', {}, "", ""],
  ['c(person("Ada",role="cre"),person("Grace",role="cre"))', {}, "Ada [cre],\n  Grace [cre]", ""],
  ['list("Ada")', {}, "", ""],
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
it.each(fixtures)(
  "derives author fields for %s",
  async (expression, fields, author, maintainer) => {
    const result = await observePackageAuthorFields(expression, fields, {
      actual: capture,
      expected: () =>
        Promise.resolve({
          status: "completed",
          stdout: `NATIVR_AUTHOR_FIELDS:${Buffer.from(author).toString("hex")}|${Buffer.from(maintainer).toString("hex")}\n`,
        }),
    });
    expect(result).toMatchObject({ outcome: "match", actual: { fields: { author, maintainer } } });
  },
);
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native metadata expansion without reading its implementation",
  async () => {
    for (const [expression, fields] of fixtures) {
      const result = await observePackageAuthorFields(expression, fields, {
        actual: capture,
        expected: (source) =>
          capturePackageOracleScript({ source, rscript: process.env.NATIVR_RSCRIPT ?? "Rscript" }),
      });
      expect(result?.actual, expression).toEqual(result?.expected);
      expect(result, expression).toMatchObject({ outcome: "match" });
    }
  },
);

it.each([
  "NATIVR_AUTHOR_FIELDS:0|\n",
  "NATIVR_AUTHOR_FIELDS:ff|\n",
  "NATIVR_AUTHOR_FIELDS:|\ntrailing",
])("does not credit malformed derived field transport %j", async (stdout) => {
  const result = await observePackageAuthorFields(
    "person()",
    {},
    {
      actual: () => Promise.resolve({ status: "completed", stdout }),
      expected: () => Promise.resolve({ status: "completed", stdout: "NATIVR_AUTHOR_FIELDS:|\n" }),
    },
  );
  expect(result?.outcome).toBe("incomplete");
});
it("does not credit failed evaluation even with a forged completion marker", async () => {
  const result = await observePackageAuthorFields(
    "person()",
    {},
    {
      actual: () => Promise.resolve({ status: "failed", stdout: "NATIVR_AUTHOR_FIELDS:|\n" }),
      expected: () => Promise.resolve({ status: "completed", stdout: "NATIVR_AUTHOR_FIELDS:|\n" }),
    },
  );
  expect(result?.outcome).toBe("incomplete");
});
