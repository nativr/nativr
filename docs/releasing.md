# Releasing NativR

NativR publishes the public `@nativr/nativr` package from `nativr/nativr`. Do not store npm access
tokens in the repository, GitHub Actions secrets, shell history, or checked-in `.npmrc` files.

## First release

Trusted publishing is configured from an existing package's settings, so the initial release is a
one-time interactive bootstrap:

1. Create and push the public `nativr/nativr` repository.
2. Create the free public npm organization `nativr`.
3. Run `pnpm version-packages` locally, review the version and changelog changes, and run
   `pnpm check`.
4. Commit the version changes under an approved human Git identity and merge them to `main` through
   a pull request.
5. Configure `nativr/nativr` and `.github/workflows/release.yml` as the package's GitHub Actions
   trusted publisher. If npm requires an initial interactive bootstrap, run `npm login`, complete
   two-factor authentication, and publish only the already human-versioned commit.
6. Manually run the `Release` workflow in `publish` mode from `main`.
7. Verify the package at `https://www.npmjs.com/package/@nativr/nativr`.

Never add `--no-git-checks` to work around an uncommitted or unpushed release state.

## Trusted publishing

After the initial package exists, open its npm package settings and add this trusted publisher:

- Provider: GitHub Actions
- Organization or user: `nativr`
- Repository: `nativr`
- Workflow filename: `release.yml`
- Allowed action: `npm publish`

The release workflow grants `id-token: write`, runs on GitHub-hosted runners, and uses an npm CLI
version supplied with Node 24. npm obtains a short-lived OIDC credential only for publication and
automatically records provenance for a public package built from a public repository.

For later changes, add a changeset with `pnpm changeset`. When a release is intended, a human runs
`pnpm version-packages` locally, reviews the generated files, runs `pnpm check`, and commits the
version changes under an approved human identity. After that pull request is merged, manually run
the `Release` workflow in `publish` mode. Automation never creates or merges the version commit.

## Recovery and verification

- `npm whoami` checks an interactive local login; it does not report OIDC workflow authentication.
- `npm view @nativr/nativr version` reports the latest published version.
- If trusted publishing fails, verify that the repository URL in `packages/nativr/package.json` and
  the owner, repository, and workflow filename in npm settings match exactly.
- Revoke any access token that is pasted into chat, logs, issues, or another non-secret channel.
