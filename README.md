# NativR

**Write R. Run JavaScript.**

> Experimental: NativR is an independent browser-native implementation targeting versioned,
> browser-admissible behavioral compatibility with GNU R 4.6.1. It is not GNU R and does not yet run
> arbitrary R packages.

NativR parses R source with Tree-sitter, converts it to a NativR-owned normalized AST, and
interprets it in TypeScript. The default API runs in a Web Worker. Evaluation has no ambient
network, filesystem, DOM, process, native-pointer, or dynamic-code capability.

## Quick start

```sh
pnpm add @nativr/nativr
```

```ts
import { createR } from "@nativr/nativr";

const r = await createR();
const result = await r.eval(`
  x <- c(1, 2, 3, 4, 5)
  mean(x)
`);

console.log(result); // 3
await r.dispose();
```

The default `interactive-safe` resource profile is deliberately bounded. Package validation can opt
into a larger, still finite budget without weakening normal browser sessions:

```ts
const r = await createR({ runtimeProfile: "package-test" });
```

Explicit `limits` override individual fields of the selected profile.

## Load an unchanged pure-R package

NativR follows **Base R once, package source many times**. Pure-R package functions should remain R
code rather than being rewritten package-by-package in TypeScript.

Create an integrity-locked browser artifact at build time:

```sh
pnpm add -D @nativr/package-tools
pnpm exec nativr-package install pkgconfig --output packages.json
```

```ts
import { createR } from "@nativr/nativr";
import packageSet from "./packages.json" with { type: "json" };

const r = await createR({ packages: packageSet.bundles });
await r.eval("library(pkgconfig)");
console.log(await r.eval('pkgconfig::get_config("unset", 42L)')); // 42
await r.dispose();
```

The installer resolves and pins the source dependency closure, rejects native or unsafe install
surfaces, verifies integrity, and emits data-only bundles for the Worker. A package is not called
compatible merely because the installer accepts it: NativR reports progression from archive
admission (P0) through namespace loading, attachment, representative execution, examples, tests, and
applicable package-check behavior (P7).

See the [package-loading contract](docs/pure-r-packages.md),
[pinned package corpus](compatibility/package-corpus.json), and
[complete bundle example](examples/pure-r-package.ts).

## One-file browser example

Save this as `index.html` and serve it from a static web server. Inline mode avoids a bundler for
this small demo; production applications normally use the Worker-first default.

```html
<!doctype html>
<button id="run">Run R</button>
<pre id="output">Loading NativR...</pre>

<script type="module">
  import { createR } from "https://cdn.jsdelivr.net/npm/@nativr/nativr@0.1.1/dist/index.js";

  const cdn = "https://cdn.jsdelivr.net/npm/@nativr/nativr@0.1.1/dist/";
  const r = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("web-tree-sitter.wasm", cdn),
      rGrammarWasm: new URL("tree-sitter-r.wasm", cdn),
    },
  });

  const output = document.querySelector("#output");
  output.textContent = "Ready";
  document.querySelector("#run").onclick = async () => {
    output.textContent = JSON.stringify(await r.eval("mean(c(1, 2, 3, 4, 5))"));
  };
</script>
```

For an editable R console, use the [single-file HTML + JavaScript REPL](examples/browser-repl.html).
R evaluation remains local and network-free after the package and Wasm assets load.

## Compatibility is evidence, not a name count

The normative release-gating target is GNU R 4.6.1. Patched R and R-devel are advisory profiles and
cannot silently redefine behavior. Browser-inapplicable operating-system surfaces use documented
adaptations or fail closed.

Compatibility claims require executable evidence:

- checked-in regression cases;
- a live, exact-version GNU R oracle;
- recursive Oracle v2 object graphs for nested values and attributes;
- pinned unchanged-package development, regression, and holdout corpora;
- explicit first-blocker and platform-deviation records.

API-name overlap is inventory only. The generated
[canonical compatibility status](compatibility/status.json) is the source for public metrics; the
[GNU R compatibility ledger](docs/gnu-r-compatibility.md),
[compatibility contract](docs/compatibility-contract.md), and
[normative profile](compatibility/profiles.json) define the details.

## Architecture

```text
R source -> @nativr/parser -> normalized @nativr/ast
                                  |
                                  v
                  @nativr/runtime <- @nativr/base
                                  |
                                  v
                  @nativr/nativr Worker API -> playground

source package -> @nativr/package-tools -> pinned data bundle -> isolated namespace
```

Production packages are browser-first, ESM-only, CSP-safe, and free of Node built-ins, `eval`,
`new Function`, or generated JavaScript execution. Native packages are a later phase requiring a
versioned, capability-safe Wasm ABI; NativR will not expose unrestricted host pointers, dynamic
loading, ambient filesystem access, or a shell to package code.

## Security and clean-room independence

Host interactions are explicit construction-time adapters. URLs, sockets, commands, line input,
navigation, and native calls are unavailable unless the embedding application supplies and
authorizes the corresponding capability. Virtual storage and graphics journals remain bounded and
session-owned.

NativR is developed under an independent [clean-room policy](docs/clean-room.md). GNU R may be used
only as a black-box behavioral oracle. GNU R, webR, and incompatible package implementation source
must never be copied, translated, linked, or embedded in this Apache-2.0 implementation.

## Development

Use Node 24 and pnpm 11:

```text
pnpm install
pnpm grammar:build
pnpm check
pnpm test:e2e
pnpm conformance:r
pnpm conformance:r:v2
pnpm dev
```

The differential commands require exact GNU R 4.6.1 by default. The [agent guide](AGENTS.md),
[development guide](docs/development.md), [RFC index](docs/rfcs/README.md),
[roadmap](docs/roadmap.md), and [release guide](docs/releasing.md) contain the full project rules.

NativR is not affiliated with or endorsed by the R Foundation, Posit, OpenAI, or R package authors.

## License

Apache License 2.0. Third-party notices are in [NOTICE](NOTICE).
