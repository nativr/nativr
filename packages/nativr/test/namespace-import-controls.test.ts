import { expect, it } from "vitest";
import { createR } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
const cases = [
  ["import(depfixture,except=a)", [false, true, false]],
  ["import(depfixture,except=c(a,b))", [false, false, false]],
  ["import(except=a,depfixture)", [false, true, false]],
  ['import(foo=depfixture,except="a")', [false, true, false]],
  ["import(depfixture,except=a)\nimportFrom(depfixture,a)", [true, true, false]],
  ["importFrom(depfixture,a)\nimport(depfixture,except=a)", [true, true, false]],
  ["import(depfixture,except=a)\nimport(depfixture,except=b)", [true, true, false]],
  ["import(depfixture,except=c())", [true, true, false]],
  ["import(depfixture,except=NULL)", [true, true, false]],
  ["import(depfixture,except=a,except=otherfixture)", [false, true, true]],
  ["importFrom(depfixture,z=a)", [false, false, true]],
  ["importFrom(pkg=depfixture,z=a)", [false, false, true]],
  ["importFrom(depfixture,a,z=b)", [true, false, true]],
  ["importFrom(depfixture,z=a)\nimport(depfixture,except=a)", [false, true, true]],
  ["import(depfixture,except=a)\nimportFrom(depfixture,z=a)", [false, true, true]],
  ['importFrom("depfixture","z"="a")', [false, false, true]],
  ["importFrom(depfixture,z=a)\nimportFrom(depfixture,b)", [false, true, true]],
] as const;
const bundle = (name: string, namespace: string, source: string, dependencies = "") => ({
  description: `Package: ${name}\nVersion: 1.0\nTitle: Independent Fixture\nDescription: Independent import fixture.\nLicense: GPL-3\nAuthor: Ada\nMaintainer: Ada <ada@example.com>\n${dependencies ? `Imports: ${dependencies}\n` : ""}`,
  namespace,
  rSources: [{ path: "R/main.R", source }],
});
const providers = [
  bundle("depfixture", "export(a,b)", "a<-1L;b<-2L;private<-3L"),
  bundle("otherfixture", "export(z)", "z<-3L"),
];
const probe =
  'probe<-function() c(exists("a",envir=parent.env(environment(probe)),inherits=FALSE),exists("b",envir=parent.env(environment(probe)),inherits=FALSE),exists("z",envir=parent.env(environment(probe)),inherits=FALSE))';
const packages = [
  ...providers,
  ...cases.map(([namespace], i) =>
    bundle(
      `consumerfixture${i}`,
      `${namespace}\nexport(probe,aliasValue)`,
      probe + ";aliasValue<-function()z",
      "depfixture, otherfixture",
    ),
  ),
];
it("loads literal import exclusions and combines repeated imports", async () => {
  const r = await createR({ execution: "inline", assets, packages });
  try {
    for (let i = 0; i < cases.length; i++)
      expect(await r.eval(`consumerfixture${i}::probe()`), cases[i]![0]).toEqual(cases[i]![1]);
    for (let i = 10; i < cases.length; i++)
      expect(await r.eval(`consumerfixture${i}::aliasValue()`)).toBe(i === 12 ? 2 : 1);
  } finally {
    await r.dispose();
  }
});
it("rejects computed import controls without running them", async () => {
  await expect(
    createR({
      execution: "inline",
      assets,
      packages: [
        ...providers,
        bundle("badfixture", 'import(depfixture,except=stop("must not run"))', ""),
      ],
    }),
  ).rejects.toThrow("requires literal import arguments");
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches installed native package import bindings",
  async () => {
    const names = packages.map((_, i) =>
      i < 2 ? ["depfixture", "otherfixture"][i]! : `consumerfixture${i - 2}`,
    );
    const files = packages.flatMap((pkg, i) => [
      { path: `${names[i]}/DESCRIPTION`, data: new TextEncoder().encode(pkg.description) },
      { path: `${names[i]}/NAMESPACE`, data: new TextEncoder().encode(pkg.namespace) },
      { path: `${names[i]}/R/main.R`, data: new TextEncoder().encode(pkg.rSources[0]!.source) },
    ]);
    const source = `local({lib<-file.path(getwd(),"library");dir.create(lib);Sys.setenv(R_LIBS=lib);.libPaths(c(lib,.libPaths()));log<-file.path(getwd(),"install.log");status<-system2(file.path(R.home("bin"),"R"),c("CMD","INSTALL","--no-docs","--no-html","--no-multiarch",paste0("--library=",shQuote(lib)),${names.map((n) => JSON.stringify(n)).join(",")}),stdout=log,stderr=log);if(status!=0L)stop(paste(readLines(log),collapse="\\n"));for(n in c(${names
      .slice(2)
      .map((n) => JSON.stringify(n))
      .join(
        ",",
      )})){cat(as.integer(getExportedValue(n,"probe")()),";",sep=",");if(as.integer(sub("consumerfixture","",n))>=10L)cat(getExportedValue(n,"aliasValue")(),";")}})`;
    const result = await capturePackageOracleScript({
      source,
      files,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 120000,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      cases
        .map(
          ([, values], i) =>
            values.map(Number).join(",") + ",;" + (i >= 10 ? `${i === 12 ? 2 : 1} ;` : ""),
        )
        .join(""),
    );
  },
  120000,
);

const inaccessibleImports = ["private", "sum", "absent"] as const;
it.each(inaccessibleImports)("rejects non-exported importFrom binding %s", async (name) => {
  const r = await createR({
    execution: "inline",
    assets,
    packages: [
      ...providers,
      bundle(
        "badfixture",
        `importFrom(depfixture,${name})\nexport(probe)`,
        "probe<-function()TRUE",
        "depfixture",
      ),
    ],
  });
  try {
    await expect(r.eval("badfixture::probe()")).rejects.toThrow(
      `imports missing binding '${name}'`,
    );
  } finally {
    await r.dispose();
  }
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "native installation rejects private, inherited and absent imports",
  async () => {
    const fixtures = [
      providers[0]!,
      ...inaccessibleImports.map((name, i) =>
        bundle(
          `badfixture${i}`,
          `importFrom(depfixture,${name})\nexport(probe)`,
          "probe<-function()TRUE",
          "depfixture",
        ),
      ),
    ];
    const names = ["depfixture", ...inaccessibleImports.map((_, i) => `badfixture${i}`)];
    const files = fixtures.flatMap((pkg, i) => [
      { path: `${names[i]}/DESCRIPTION`, data: new TextEncoder().encode(pkg.description) },
      { path: `${names[i]}/NAMESPACE`, data: new TextEncoder().encode(pkg.namespace) },
      { path: `${names[i]}/R/main.R`, data: new TextEncoder().encode(pkg.rSources[0]!.source) },
    ]);
    const source = `local({lib<-file.path(getwd(),"library");dir.create(lib);Sys.setenv(R_LIBS=lib);.libPaths(c(lib,.libPaths()));log<-file.path(getwd(),"install.log");for(n in c(${names.map((n) => JSON.stringify(n)).join(",")})){status<-suppressWarnings(system2(file.path(R.home("bin"),"R"),c("CMD","INSTALL","--no-docs","--no-html","--no-multiarch",paste0("--library=",shQuote(lib)),n),stdout=log,stderr=log));cat(as.integer(status==0L),";");}})`;
    const result = await capturePackageOracleScript({
      source,
      files,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 120000,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe("1 ;0 ;0 ;0 ;");
  },
  120000,
);

const conflictCases = [
  ["importFrom(depfixture,a)\nimportFrom(conflictprovider,a)", 3, true],
  ["import(depfixture)\nimport(conflictprovider)", 3, true],
  ["importFrom(depfixture,b)\nimportFrom(conflictprovider,b)", 2, false],
  ["importFrom(depfixture,a)\nimportFrom(depfixture,a)", 1, false],
] as const;
const conflictPackages = [
  providers[0]!,
  bundle("conflictprovider", "export(a,b)", "a<-3L;b<-2L"),
  ...conflictCases.map(([ns], i) =>
    bundle(
      `conflictconsumer${i}`,
      ns + "\nexport(probe)",
      `probe<-function()${i === 2 ? "b" : "a"}`,
      "depfixture, conflictprovider",
    ),
  ),
];
const conflictCode = (i: number) =>
  `local({w<-character();v<-withCallingHandlers(conflictconsumer${i}::probe(),warning=function(e){w<<-c(w,conditionMessage(e));invokeRestart("muffleWarning")});c(as.character(v),w)})`;
const conflictExpected = (i: number) => [
  String(conflictCases[i]![1]),
  ...(conflictCases[i]![2]
    ? [
        `replacing previous import 'depfixture::a' by 'conflictprovider::a' when loading 'conflictconsumer${i}'`,
      ]
    : []),
];
it("warns on different imported values and allows identical values silently", async () => {
  const r = await createR({ execution: "inline", assets, packages: conflictPackages });
  try {
    for (let i = 0; i < conflictCases.length; i++) {
      const values = conflictExpected(i);
      const result = await r.evalDetailed(`conflictconsumer${i}::probe()`);
      expect(result.value).toBe(conflictCases[i]![1]);
      expect(result.warnings.map((warning) => warning.message)).toEqual(values.slice(1));
    }
  } finally {
    await r.dispose();
  }
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native conflicting import warnings",
  async () => {
    const names = [
      "depfixture",
      "conflictprovider",
      ...conflictCases.map((_, i) => `conflictconsumer${i}`),
    ];
    const files = conflictPackages.flatMap((pkg, i) => [
      { path: `${names[i]}/DESCRIPTION`, data: new TextEncoder().encode(pkg.description) },
      { path: `${names[i]}/NAMESPACE`, data: new TextEncoder().encode(pkg.namespace) },
      { path: `${names[i]}/R/main.R`, data: new TextEncoder().encode(pkg.rSources[0]!.source) },
    ]);
    const source = `local({lib<-file.path(getwd(),"library");dir.create(lib);Sys.setenv(R_LIBS=lib);.libPaths(c(lib,.libPaths()));log<-file.path(getwd(),"install.log");status<-system2(file.path(R.home("bin"),"R"),c("CMD","INSTALL","--no-docs","--no-html","--no-multiarch",paste0("--library=",shQuote(lib)),${names.map((n) => JSON.stringify(n)).join(",")}),stdout=log,stderr=log);if(status!=0L)stop("fixture installation failed");${conflictCases.map((_, i) => `cat(${conflictCode(i)},";",sep="|")`).join(";")}})`;
    const result = await capturePackageOracleScript({
      source,
      files,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 120000,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      conflictCases.map((_, i) => conflictExpected(i).join("|") + "|;").join(""),
    );
  },
  120000,
);
