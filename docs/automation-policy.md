# Human-authored Git history

NativR uses automation for reporting and verification, not for authorship. Commits reachable from
`main` must be authored by a human contributor. Bot and AI-agent accounts must not appear as commit
authors or co-authors.

Approved human identities are explicitly listed in `.github/human-authors.json`. Adding a real
contributor to that list requires review and a commit from an already-approved human identity. This
allowlist is the primary control; bot and AI-agent name patterns provide defense in depth.

## Dependency updates

- GitHub dependency alerts may report vulnerable or outdated dependencies.
- Dependabot may open one grouped weekly pull request as an availability report. Its bot-authored
  commits are intentionally ineligible for merge; a human must reproduce an accepted update locally
  and commit it under an approved identity.
- Dependabot security-update commits and automated security fixes remain disabled; alerts remain
  enabled.
- Dependabot, Renovate, GitHub Actions, and similar services must not merge or push dependency
  commits to `main`.
- A human reviews the proposed update, applies it locally, runs the required checks, and commits it
  under their verified Git identity through a pull request.

## Releases

The `Release` workflow is intentionally read-only during its preview job. It reports pending
Changesets but never creates a release branch, pull request, or version commit.

To release:

1. Run `pnpm version-packages` locally.
2. Review the generated manifests and changelogs and run `pnpm check`.
3. Commit the version changes under a verified human Git identity and merge them through a pull
   request.
4. Manually run the `Release` workflow in `publish` mode from `main`.

The publish job rechecks reachable commit authorship before publishing. It has read-only repository
permissions and cannot create or merge commits.

## Enforcement

The `Commit authorship` workflow checks every commit introduced by a pull request and every commit
pushed to `main`. Pull-request checks execute the trusted workflow and policy script from `main` and
never execute code from the untrusted pull-request checkout. The policy rejects authors and
co-authors that are not on the approved-human allowlist and also rejects known bot or AI-agent
identity patterns. Repository branch protection requires the `Human-authored commits` check and a
pull request for `main`, including for administrators. GitHub Actions has read-only default
repository permissions and cannot approve pull requests; the trusted authorship workflow receives
only the additional commit-status permission needed to report its result on the pull-request head.
It has no content, review, or merge write permission. Repository auto-merge is disabled.

Codex may edit the working tree, but it must not create a commit unless the user explicitly requests
one. When explicitly requested, the commit must use the configured approved human identity and must
not contain an AI or bot `Co-authored-by` trailer.

One exact historical exception exists for Dependabot trailers in the human-authored commit
`684c44ca1bae7b7588831a23eae232f6f90eaa76`. The exception preserves published Git history and does
not permit the same identity on any future commit.
