# Human-authored Git history

NativR uses automation for reporting and verification, not for authorship. Commits reachable from
`main` must be authored by a human contributor. Bot and AI-agent accounts must not appear as commit
authors or co-authors.

## Dependency updates

- GitHub dependency alerts may report vulnerable or outdated dependencies.
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
pushed to `main`. It rejects known bot identities, AI-agent identities, and AI/bot `Co-authored-by`
trailers. Repository branch protection should require the `Human-authored commits` check and require
pull requests for `main`.

One exact historical exception exists for Dependabot trailers in the human-authored commit
`684c44ca1bae7b7588831a23eae232f6f90eaa76`. The exception preserves published Git history and does
not permit the same identity on any future commit.
