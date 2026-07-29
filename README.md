# NativR

**Write R. Run JavaScript.**

> Experimental: NativR implements a small, explicitly documented R-compatible subset. It is not GNU
> R and does not run arbitrary R packages.

NativR is an independent, browser-native analytics runtime written in TypeScript. It parses
supported R source with Tree-sitter, normalizes that syntax into a NativR-owned AST, and interprets
it locally with explicit vector semantics. The default public API runs in a Web Worker and performs
no network access during evaluation.

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

The current milestone supports atomic literals, assignments, arithmetic vectorization and recycling,
lexical closures with lazy arguments, and the builtins `c`, `length`, `sum`, `mean`, `sqrt`, `abs`,
`is.na`, and `is.nan`. See the
[compatibility contract](https://github.com/nativr/nativr/blob/main/docs/compatibility-contract.md)
for exact boundaries.

Source releases are managed with Changesets. npm publication uses GitHub Actions trusted publishing
without a long-lived registry token; see the
[release guide](https://github.com/nativr/nativr/blob/main/docs/releasing.md).

## Development

Use Node 24 and pnpm 11.

If the checkout is inside Dropbox, OneDrive, or another synchronized folder, first follow the
[machine-local dependency setup](https://github.com/nativr/nativr/blob/main/docs/development.md#keep-dependencies-outside-a-synchronized-source-folder)
so Git synchronizes source while dependencies and test artifacts remain outside the project tree.

```text
pnpm install
pnpm grammar:build
pnpm check
pnpm dev
```

The repository is a pnpm workspace:

```text
R source -> @nativr/parser -> normalized @nativr/ast
                                  |
                                  v
                  @nativr/runtime <- @nativr/base
                                  |
                                  v
                  @nativr/nativr Worker API -> playground
```

NativR intentionally does not implement package installation, data frames, graphics, S3/S4, dynamic
evaluation, filesystem access, or network access. Planned directions are documented in the
[roadmap](https://github.com/nativr/nativr/blob/main/docs/roadmap.md).

This Apache-2.0 project follows an independent clean-room policy. It is not affiliated with or
endorsed by the R Foundation, Posit, OpenAI, or R package authors. No official R branding is used.

## License

Apache License 2.0. Third-party notices are in
[`NOTICE`](https://github.com/nativr/nativr/blob/main/NOTICE).
