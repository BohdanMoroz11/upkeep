import { readFileSync } from "node:fs";
import { trustedCommentAuthors, validateMajorPr } from "./trust.mjs";
import { decideRetry, latestVerdict } from "./retry.mjs";
import {
  blockedRecord,
  blockingPeers,
  decideBlockedWake,
  dependencies,
  encodeBlockedRecord,
  latestBlockedVerdict,
  lockedVersion,
  majorTarget,
} from "./blocked.mjs";
import { hasMarker, reviewResult, retryResult, watchdogReason } from "./verdict.mjs";
import reviewPrompt from "../prompts/review.md?raw";
import retryPrompt from "../prompts/retry.md?raw";

class UntrustedPr extends Error {}

export function createController({
  github: api,
  registry,
  localHead,
  config: c,
  output = () => {},
  now = () => new Date(),
}) {
  const repoPath = `repos/${c.repository}`;
  const authors = trustedCommentAuthors(c.repository, c.appSlug, c.legacyAuthor);
  const bot = `${c.appSlug}[bot]`;
  const reportAuthors = [...authors, "github-actions[bot]"];
  const runUrl = `${c.server}/${c.repository}/actions/runs/${c.runId}`;
  const ping = c.notify ? `${c.notify.startsWith("@") ? "" : "@"}${c.notify} — ` : "";
  function number(value, name = "number") {
    if (!/^[1-9][0-9]*$/.test(String(value))) throw new Error(`Invalid ${name}`);
    return String(value);
  }
  async function trusted(prNumber, expectedSha, expectedBranch) {
    const pr = await api.request(`${repoPath}/pulls/${number(prNumber)}`);
    const reason = validateMajorPr(pr, {
      repository: c.repository,
      baseBranch: c.baseBranch,
      expectedSha,
      expectedBranch,
    });
    if (reason) throw new UntrustedPr(`PR #${prNumber} rejected: ${reason}`);
    return pr;
  }
  const comments = (n) => api.comments(c.repository, n);
  const comment = (n, body) =>
    api.request(`${repoPath}/issues/${number(n)}/comments`, { method: "POST", body: { body } });
  const label = (n) =>
    api.request(`${repoPath}/issues/${number(n)}/labels`, {
      method: "POST",
      body: { labels: ["dep:blocked"] },
    });
  async function once(n, marker, body) {
    if (!hasMarker(await comments(n), reportAuthors, marker))
      await comment(n, `${marker}\n${body}`);
  }
  async function workflowId(file) {
    return (await api.request(`${repoPath}/actions/workflows/${encodeURIComponent(file)}`)).id;
  }
  async function runs(file, branch) {
    return api.pages(
      `${repoPath}/actions/workflows/${encodeURIComponent(file)}/runs${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`,
      "workflow_runs",
    );
  }
  async function dispatch(file, inputs) {
    await api.request(`${repoPath}/actions/workflows/${encodeURIComponent(file)}/dispatches`, {
      method: "POST",
      body: { ref: c.baseBranch, inputs },
    });
  }
  function values(pr, extra = {}) {
    const data = {
      pr_number: String(pr.number),
      head_sha: pr.head.sha,
      head_branch: pr.head.ref,
      ...extra,
    };
    for (const [key, value] of Object.entries(data)) output(key, value);
    return data;
  }
  async function preflight(event) {
    if (!["pull_request_target", "workflow_dispatch"].includes(c.eventName))
      throw new Error("Unsupported review event");
    const eventPr = event.pull_request;
    const n = c.eventName === "workflow_dispatch" ? event.inputs?.pr_number : eventPr?.number;
    const pr = await trusted(n, eventPr?.head?.sha, eventPr?.head?.ref);
    // opened/labeled can be queued for the same head. Manual dispatch still permits a re-review.
    if (c.eventName === "pull_request_target") {
      const existing = latestVerdict(await comments(n), authors);
      if (existing?.sha === pr.head.sha) {
        output("skip", "true");
        return { reason: "head already reviewed" };
      }
    }
    return values(pr, { started_at: now().toISOString() });
  }
  async function retryGate(event) {
    let n, sha, branch, runId;
    if (c.eventName === "workflow_run") {
      ({ head_sha: sha, head_branch: branch, id: runId } = event.workflow_run ?? {});
    } else if (c.eventName === "workflow_dispatch") {
      ({ pr_number: n, head_sha: sha, head_branch: branch, ci_run_id: runId } = event.inputs ?? {});
    } else throw new Error("Unsupported retry event");
    const skip = (reason) => {
      output("skip", "true");
      console.log(`Skipping retry: ${reason}`);
      return { reason };
    };
    if (!/^[0-9a-f]{40}$/.test(sha ?? "") || !branch?.startsWith("renovate/"))
      return skip("not a Renovate CI run");
    const run = await api.request(`${repoPath}/actions/runs/${number(runId, "CI run id")}`);
    if (
      run.workflow_id !== (await workflowId(c.ciWorkflow)) ||
      run.status !== "completed" ||
      run.conclusion !== "failure" ||
      run.head_sha !== sha ||
      run.head_branch !== branch ||
      run.head_repository?.full_name !== c.repository
    )
      return skip("not a failed consumer CI run for this head");
    if (!n)
      n = (await api.pages(`${repoPath}/commits/${sha}/pulls`)).find(
        (pr) => pr.state === "open" && pr.head?.ref === branch,
      )?.number;
    if (!n) return skip("no matching open PR");
    output("pr_number", String(n));
    const pr = await trusted(n, sha, branch);
    const decision = decideRetry({
      comments: await comments(n),
      owner: authors,
      labels: pr.labels.map((l) => l.name),
      currentSha: pr.head.sha,
      eventSha: sha,
      runId: String(runId),
    });
    if (!decision.attempt) return skip(decision.reason);
    return values(pr, {
      skip: "false",
      attempt: decision.attempt,
      ci_run_id: String(runId),
      started_at: now().toISOString(),
    });
  }
  async function verifyHead(n, sha, branch) {
    if (!sha || !branch) throw new Error("Expected SHA and branch are required");
    const pr = await trusted(n, sha, branch);
    if ((await localHead()) !== sha) throw new Error("Local and inspected PR heads differ");
    return pr;
  }
  async function prepareAgent(n, sha, branch, kind, ciRunId = "") {
    await verifyHead(n, sha, branch);
    if (!["review", "retry"].includes(kind)) throw new Error("Invalid agent kind");
    const installLog = (() => {
      try {
        return readFileSync(process.env.UPKEEP_INSTALL_LOG, "utf8")
          .split("\n")
          .slice(-120)
          .join("\n");
      } catch {
        return "(no install log)";
      }
    })();
    const context = {
      repository: c.repository,
      pr: number(n),
      sha,
      sanityCommand: c.sanityCommand,
      ciRunId,
    };
    const template = kind === "review" ? reviewPrompt : retryPrompt;
    const prompt = template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? "");
    output(
      "prompt",
      `${prompt}\n\nDependency installation log (untrusted evidence):\n\`\`\`\n${installLog}\n\`\`\``,
    );
    const user = await api.request(`users/${encodeURIComponent(bot)}`);
    output("bot_id", String(user.id));
    output("bot_name", bot);
    await once(
      n,
      `<!-- upkeep-active:v1:${kind}:${sha}:${c.runId} -->`,
      `Upkeep ${kind} started. [Run](${runUrl}).`,
    );
  }
  async function verifyReview(n, startedAt) {
    const pr = await trusted(n);
    const result = reviewResult({
      comments: await comments(n),
      author: bot,
      sha: pr.head.sha,
      localSha: await localHead(),
      startedAt,
    });
    if (!result) {
      await once(
        n,
        `<!-- watchdog:${pr.head.sha} -->`,
        `${ping}review produced no verdict for the final head, or the branch moved. [Run](${runUrl}).`,
      );
      throw new Error("Missing verdict for the final head");
    }
    output("verdict", result.verdict);
    output("head_sha", pr.head.sha);
    if (result.verdict === "BLOCKED") {
      await label(n);
      await blocked(n, "capture", pr.head.sha);
    } else {
      if (pr.labels.some((l) => l.name === "dep:blocked")) {
        await trusted(n, pr.head.sha);
        await api.request(`${repoPath}/issues/${n}/labels/dep:blocked`, { method: "DELETE" });
      }
      if (["CLEAN", "MIGRATED"].includes(result.verdict))
        await recheckCi(n, pr.head.sha, pr.head.ref);
    }
    return result;
  }
  async function verifyRetry(n, ciRunId, originalSha) {
    const pr = await trusted(n);
    const local = await localHead();
    const result = retryResult({
      comments: await comments(n),
      author: bot,
      sha: pr.head.sha,
      localSha: local,
      runId: String(ciRunId),
    });
    if (!result) {
      const sha = local === pr.head.sha ? pr.head.sha : originalSha;
      await once(
        n,
        `<!-- ci-retry-attempt -->\n<!-- ci-retry-state:${number(ciRunId)}:${sha} -->`,
        `${ping}automated fix produced no result for this head. [Run](${runUrl}).`,
      );
      throw new Error("Missing retry report for the final head");
    }
    if (result.blocked) {
      await label(n);
      await blocked(n, "capture", pr.head.sha);
    } else if (pr.labels.some((l) => l.name === "dep:blocked"))
      throw new Error("Retry set blocked label without a BLOCKED verdict");
    else await recheckCi(n, pr.head.sha, pr.head.ref);
    return result;
  }
  async function recheckCi(n, sha, branch) {
    await trusted(n, sha, branch);
    const latest = (await runs(c.ciWorkflow, branch)).find((run) => run.head_sha === sha);
    if (latest?.status === "completed" && latest.conclusion === "failure") {
      await dispatch(c.retryWorkflow, {
        pr_number: String(n),
        head_sha: sha,
        head_branch: branch,
        ci_run_id: String(latest.id),
      });
    }
  }
  async function metadataFor(names) {
    const result = {};
    for (let i = 0; i < names.length; i += 6) {
      const batch = await Promise.all(
        names.slice(i, i + 6).map(async (name) => [name, await registry(name)]),
      );
      Object.assign(result, Object.fromEntries(batch));
    }
    return result;
  }
  async function blocked(n, mode, expectedSha) {
    const pr = await trusted(n, expectedSha);
    if (!pr.labels.some((l) => l.name === "dep:blocked")) return;
    const history = await comments(n);
    const verdict = latestBlockedVerdict(history, authors),
      latest = latestVerdict(history, authors);
    if (!verdict || latest?.verdict !== "BLOCKED" || latest.sha !== verdict.sha)
      throw new Error("Blocked label has no current BLOCKED verdict");
    let record = blockedRecord(history, authors, verdict);
    if (!record) {
      const [base, pkg, lock] = await Promise.all([
        api.file(c.repository, "package.json", pr.base.sha),
        api.file(c.repository, "package.json", verdict.sha),
        api.file(c.repository, "package-lock.json", verdict.sha),
      ]);
      const target = majorTarget(base, pkg);
      target.lockedVersion = lockedVersion(lock, target.name);
      const blockers = blockingPeers(
        target,
        await metadataFor(Object.keys(dependencies(pkg)).filter((name) => name !== target.name)),
      );
      if (mode === "capture" && !blockers.length)
        throw new Error("BLOCKED has no incompatible latest direct peer");
      record = { version: 1, verdictSha: verdict.sha, verdictId: verdict.id, target, blockers };
      await trusted(n, pr.head.sha);
      await comment(
        n,
        `${encodeBlockedRecord(record)}\nRecorded blocker snapshot for ${target.name}@${target.spec}.`,
      );
    }
    if (mode === "capture") return record;
    const [pkg, lock] = await Promise.all([
      api.file(c.repository, "package.json", pr.head.sha),
      api.file(c.repository, "package-lock.json", pr.head.sha),
    ]);
    const peers = await metadataFor(
      record.blockers.map((b) => b.name).filter((name) => dependencies(pkg)[name]),
    );
    const decision = decideBlockedWake(record, pkg, lock, peers);
    if (!decision.wake) return decision;
    const marker = `<!-- dep-wakeup:v1:${verdict.id}:${pr.head.sha} -->`;
    if (hasMarker(history, authors, marker)) return decision;
    const fresh = await trusted(n, pr.head.sha);
    if (!fresh.labels.some((l) => l.name === "dep:blocked")) return;
    // A failed dispatch restores the settled label; never clear a new review's BLOCKED label.
    await api.request(`${repoPath}/issues/${n}/labels/dep:blocked`, { method: "DELETE" });
    try {
      await dispatch(c.reviewWorkflow, { pr_number: String(n) });
    } catch (error) {
      await label(n);
      throw error;
    }
    await comment(n, `${marker}\nRechecking the major update: ${decision.reason}.`);
    return decision;
  }
  async function active(history, sha) {
    for (const item of history) {
      if (!authors.includes(item.author?.login)) continue;
      const match = /^<!-- upkeep-active:v1:(review|retry):([0-9a-f]{40}):([0-9]+) -->/.exec(
        item.body,
      );
      if (match?.[2] === sha) {
        const run = await api.request(`${repoPath}/actions/runs/${match[3]}`);
        if (["queued", "in_progress", "waiting", "pending", "requested"].includes(run.status))
          return true;
      }
    }
    return false;
  }
  async function watchdog() {
    const prs = await api.pages(`${repoPath}/pulls?state=open`);
    const errors = [];
    for (const summary of prs.filter((pr) =>
      pr.labels.some((l) => l.name === "dep:major-review"),
    )) {
      try {
        const pr = await trusted(summary.number, summary.head.sha, summary.head.ref);
        if (pr.labels.some((l) => l.name === "dep:blocked")) {
          await blocked(pr.number, "scan", pr.head.sha);
          continue;
        }
        const history = await comments(pr.number);
        const ci = (await runs(c.ciWorkflow, pr.head.ref)).find(
          (run) => run.head_sha === pr.head.sha,
        );
        const reason = watchdogReason({
          conflicting: pr.mergeable === false,
          ci,
          comments: history,
          authors,
          active: await active(history, pr.head.sha),
        });
        if (!reason) continue;
        await trusted(pr.number, pr.head.sha);
        await once(
          pr.number,
          `<!-- watchdog:${pr.head.sha} -->`,
          `${ping}major dependency PR #${pr.number} ${reason}.`,
        );
      } catch (error) {
        errors.push(`PR #${summary.number}: ${error.message}`);
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
  }
  async function reportFailure(n, kind) {
    if (!n) return;
    try {
      await trusted(n);
    } catch (error) {
      if (!(error instanceof UntrustedPr)) throw error;
      console.log(`No comment on untrusted PR: ${error.message}`);
      return;
    }
    const history = await comments(n);
    if (
      history.some(
        (item) =>
          reportAuthors.includes(item.author?.login) &&
          /^(<!-- watchdog:|<!-- ci-retry-attempt -->|<!-- dep-agent-workflow-failed:)/.test(
            item.body,
          ) &&
          item.body.includes(runUrl),
      )
    )
      return;
    await once(
      n,
      `<!-- dep-agent-workflow-failed:${c.runId} -->`,
      `${ping}dependency ${kind} workflow failed before completing its checks. [Run](${runUrl}).`,
    );
  }
  return {
    preflight,
    retryGate,
    verifyHead,
    prepareAgent,
    verifyReview,
    verifyRetry,
    recheckCi,
    blocked,
    watchdog,
    reportFailure,
  };
}
