# Contributing

Use Node 24, pnpm 11, and a clean checkout. Run `pnpm install`, `pnpm grammar:build`, and
`pnpm check`; Worker or UI changes also require `pnpm test:e2e`.

All semantic changes need focused unit tests, a checked-in conformance case, an updated capability
manifest, and an accurate compatibility note. Compatibility claims require evidence at the stated
parse/API/shape/numeric/behavioral level.

Contributions must follow [`docs/clean-room.md`](docs/clean-room.md). Do not copy or mechanically
translate GNU R, webR, or copyleft package source. Public documentation, mathematical definitions,
and black-box observations are acceptable sources when recorded. Pull requests should identify
source material and third-party licensing.

Keep browser code CSP-safe and free of Node built-ins, ambient host access, telemetry, and network
requests. Do not weaken tests or bundle optional analytics backends into core.

Commits must be authored under an approved human identity listed in `.github/human-authors.json`. Do
not add bot or AI-agent identities as authors or in attribution trailers such as `Co-authored-by`,
`Signed-off-by`, `Reviewed-by`, `Acked-by`, or `Tested-by`. Automation may report dependency updates
and verify releases, but a human must apply, review, and commit dependency and version changes. See
[`docs/automation-policy.md`](docs/automation-policy.md).
