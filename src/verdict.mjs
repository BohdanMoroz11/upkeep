import { latestVerdict, attemptsAfterVerdict } from "./retry.mjs";

export function reviewResult({ comments, author, sha, localSha, startedAt }) {
  if (localSha !== sha) return null;
  const fresh = comments.filter((c) => Date.parse(c.createdAt) >= Date.parse(startedAt));
  const verdict = latestVerdict(fresh, author);
  return verdict?.sha === sha ? verdict : null;
}

export function retryResult({ comments, author, sha, localSha, runId }) {
  if (localSha !== sha) return null;
  const index = comments.findLastIndex(
    (c) =>
      c.author?.login === author &&
      c.body.startsWith(`<!-- ci-retry-attempt -->\n<!-- ci-retry-state:${runId}:${sha} -->`),
  );
  if (index < 0) return null;
  const blocked = latestVerdict(comments.slice(index + 1), author);
  return { blocked: blocked?.verdict === "BLOCKED" && blocked.sha === sha };
}

export function hasMarker(comments, authors, marker) {
  return comments.some((c) => authors.includes(c.author?.login) && c.body.startsWith(marker));
}

export function watchdogReason({ conflicting, ci, comments, authors, active }) {
  if (conflicting) return "has a merge conflict and needs a rebase or conflict resolution";
  if (active || ci?.status !== "completed" || ci.conclusion !== "failure") return null;
  const verdict = latestVerdict(comments, authors);
  if (verdict && ["BLOCKED", "NEEDS-HUMAN"].includes(verdict.verdict)) return null;
  const attempts = attemptsAfterVerdict(comments, verdict?.index ?? -1, authors);
  return attempts.length >= 3
    ? "has red CI after three automated fix attempts"
    : "has red CI and no review or fixer is running";
}
