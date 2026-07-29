# Releasing NativR

NativR publishes the public `nativr` package from `nativr/nativr`. Do not store npm access tokens in
the repository, GitHub Actions secrets, shell history, or checked-in `.npmrc` files.

## First release

Trusted publishing is configured from an existing package's settings, so the initial release is a
one-time interactive bootstrap:

1. Create and push the public `nativr/nativr` repository.
2. Merge the Changesets release pull request, which changes `nativr` from `0.0.0` to `0.1.0`.
3. Run `npm login` locally and complete npm web login and two-factor authentication.
4. From the repository root, run `pnpm check` and `pnpm release`.
5. Verify the package at `https://www.npmjs.com/package/nativr`.

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

For later changes, add a changeset with `pnpm changeset`. A push to `main` updates the release pull
request. Merging that pull request publishes the new version through trusted publishing.

## Recovery and verification

- `npm whoami` checks an interactive local login; it does not report OIDC workflow authentication.
- `npm view nativr version` reports the latest published version.
- If trusted publishing fails, verify that the repository URL in `packages/nativr/package.json` and
  the owner, repository, and workflow filename in npm settings match exactly.
- Revoke any access token that is pasted into chat, logs, issues, or another non-secret channel.
