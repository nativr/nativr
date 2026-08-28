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

// This human-authored, already-published main-branch commit retained Dependabot trailers from its
// source PR. Rewriting it would change public history. Keep the exception exact so no later commit
// or different identity can inherit it.
const historicalTrailerExceptions = new Set([
  "684c44ca1bae7b7588831a23eae232f6f90eaa76|co-author|dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
]);

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
    ...[...message.matchAll(/^Co-authored-by:\s*(.+)$/gimu)].map((match) => ({
      kind: "co-author",
      value: match[1].trim(),
    })),
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
    "\nRecreate the affected commit under an approved human identity and remove bot/AI co-author trailers. Add a real contributor to .github/human-authors.json only through an already-approved human-authored commit.",
  );
  process.exit(1);
}

console.log(`Commit authorship policy passed for ${commits.length} commit(s).`);
