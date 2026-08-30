import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const authorPolicy = JSON.parse(
  readFileSync(new URL("../.github/human-authors.json", import.meta.url), "utf8"),
);
const approvedHumanIdentities = new Set(
  authorPolicy.authors.flatMap(({ name, emails }) =>
    emails.map((email) => `${name.trim().toLowerCase()} <${email.trim().toLowerCase()}>`),
  ),
);

const blockedIdentityPatterns = [
  { label: "GitHub bot account", pattern: /\[bot\]/iu },
  { label: "Dependabot", pattern: /dependabot/iu },
  { label: "GitHub Actions", pattern: /github-actions/iu },
  { label: "Renovate", pattern: /(?:^|\W)renovate(?:\W|$)/iu },
  { label: "Codex", pattern: /(?:^|\W)codex(?:\W|$)/iu },
  { label: "ChatGPT", pattern: /chatgpt/iu },
  { label: "OpenAI automation", pattern: /openai[- +_]*(?:bot|agent|codex)/iu },
  { label: "Copilot automation", pattern: /copilot[- +_]*(?:bot|agent)?(?:\W|$)/iu },
  { label: "Claude automation", pattern: /claude[- +_]*(?:bot|agent)(?:\W|$)/iu },
  { label: "AI agent", pattern: /(?:^|\W)ai[- +_]*agent(?:\W|$)/iu },
];

// These human-authored, already-published main-branch commits retained Dependabot attribution
// trailers from their source PRs. Rewriting them would change public history. Keep every exception
// exact so no later commit, trailer kind, or different identity can inherit it.
const historicalTrailerExceptions = new Set([
  "684c44ca1bae7b7588831a23eae232f6f90eaa76|co-author|dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
  "684c44ca1bae7b7588831a23eae232f6f90eaa76|signed-off-by|dependabot[bot] <support@github.com>",
  "a88083a4be3fdba15bd7a48d5551c679540e4288|signed-off-by|dependabot[bot] <support@github.com>",
  "13387fa5bff57c2bbc9a457f0d15a531f14e1eab|signed-off-by|dependabot[bot] <support@github.com>",
  "9778ee6fd71cdbc4541d9ec74278bee8473af414|signed-off-by|dependabot[bot] <support@github.com>",
  "f664bf7bc31be08978d315bccfbe3d594d0ca1c3|signed-off-by|dependabot[bot] <support@github.com>",
  "cd301aebcfbc102283e603ae047977140ece8a7a|signed-off-by|dependabot[bot] <support@github.com>",
  "736ec6dfb938b2beb75ab46756b8baa9ce8bc7b4|signed-off-by|dependabot[bot] <support@github.com>",
]);

const attributionTrailers = [
  { kind: "co-author", key: "Co-authored-by" },
  { kind: "signed-off-by", key: "Signed-off-by" },
  { kind: "reviewed-by", key: "Reviewed-by" },
  { kind: "acked-by", key: "Acked-by" },
  { kind: "tested-by", key: "Tested-by" },
];

const zeroBefore = /^0+$/u;
const explicitRange = process.env.NATIVR_COMMIT_RANGE?.trim();
const requested = process.argv.slice(2);
let revisionArgs;

if (requested.length === 1 && requested[0] === "--all") {
  // "All" means every commit reachable from the checked-out branch, not commits reachable only
  // through unrelated tags or remote refs.
  revisionArgs = ["HEAD"];
} else if (requested.length > 0) {
  revisionArgs = requested;
} else if (explicitRange) {
  const [before, after] = explicitRange.split("..", 2);
  revisionArgs = zeroBefore.test(before ?? "") && after ? [after] : [explicitRange];
} else {
  const hasParent = spawnSync("git", ["rev-parse", "--verify", "HEAD^"], {
    encoding: "utf8",
  });
  revisionArgs = hasParent.status === 0 ? ["HEAD^..HEAD"] : ["HEAD"];
}

const log = spawnSync(
  "git",
  ["log", "--no-show-signature", "--format=%H%x1f%an%x1f%ae%x1f%B%x1e", ...revisionArgs],
  { encoding: "utf8" },
);

if (log.status !== 0) {
  process.stderr.write(log.stderr || "Unable to inspect Git commit authors.\n");
  process.exit(log.status ?? 1);
}

const violations = [];
const commits = log.stdout
  .split("\x1e")
  .map((record) => record.trimStart())
  .filter(Boolean);

for (const record of commits) {
  const [hash, authorName, authorEmail, ...messageParts] = record.split("\x1f");
  const message = messageParts.join("\x1f");
  const identities = [
    { kind: "author", value: `${authorName} <${authorEmail}>` },
    ...attributionTrailers.flatMap(({ kind, key }) =>
      [...message.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gimu"))].map((match) => ({
        kind,
        value: match[1].trim(),
      })),
    ),
  ];

  for (const identity of identities) {
    const normalizedIdentity = identity.value.trim().toLowerCase();
    const blocked = blockedIdentityPatterns.find(({ pattern }) => pattern.test(identity.value));
    const exceptionKey = `${hash}|${identity.kind}|${normalizedIdentity}`;
    const approved = approvedHumanIdentities.has(normalizedIdentity);
    if ((!approved || blocked) && !historicalTrailerExceptions.has(exceptionKey)) {
      violations.push({
        hash: hash.slice(0, 12),
        kind: identity.kind,
        identity: identity.value,
        reason: blocked?.label ?? "an identity not listed in .github/human-authors.json",
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Commit authorship policy failed:\n");
  for (const violation of violations) {
    console.error(
      `- ${violation.hash}: ${violation.kind} ${violation.identity} matches ${violation.reason}`,
    );
  }
  console.error(
    "\nRecreate the affected commit under an approved human identity and remove bot/AI attribution trailers. Add a real contributor to .github/human-authors.json only through an already-approved human-authored commit.",
  );
  process.exit(1);
}

console.log(`Commit authorship policy passed for ${commits.length} commit(s).`);
