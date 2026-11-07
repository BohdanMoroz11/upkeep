import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createController } from "../../src/controller.mjs";
import { configuration } from "../../src/config.mjs";
import { encodeBlockedRecord } from "../../src/blocked.mjs";
const fixture = JSON.parse(readFileSync(new URL("../fixtures/pr.json", import.meta.url), "utf8"));
const sha = fixture.head.sha;
const timestamp = "2026-11-07T12:00:00Z";
const repo = "example/project";
const bot = "upkeep-test[bot]";
const config = {
  repository: repo,
  eventName: "workflow_dispatch",
  runId: "900",
  server: "https://github.com",
  baseBranch: "main",
  ciWorkflow: "ci.yml",
  reviewWorkflow: "upkeep-review.yml",
  retryWorkflow: "upkeep-retry.yml",
  appSlug: "upkeep-test",
  legacyAuthor: "",
  notify: "maintainer",
  sanityCommand: "npm run check:types",
};
const verdict = (kind = "CLEAN", author = bot, head = sha) => ({
  id: "IC_review",
  body: `<!-- dep-verdict:${kind}:${head} -->\nReviewed.`,
  author: { login: author },
  createdAt: timestamp,
});
function harness(overrides: any = {}) {
  const state = {
    pr: structuredClone(fixture),
    comments: [] as any[],
    runs: [] as any[],
    run: {
      id: 501,
      workflow_id: 5,
      status: "completed",
      conclusion: "failure",
      head_sha: sha,
      head_branch: fixture.head.ref,
      head_repository: { full_name: repo },
    },
    local: sha,
    calls: [] as any[],
    peers: {} as any,
    files: {} as any,
    failDispatch: false,
    ...overrides,
  };
  const output: any = {};
  const github = {
    async request(path: string, options: any = {}) {
      state.calls.push({ path, ...options });
      if (path === `repos/${repo}/pulls/12`) return structuredClone(state.pr);
      if (path === `repos/${repo}/actions/workflows/ci.yml`) return { id: 5 };
      if (path === `repos/${repo}/actions/runs/501`) return state.run;
      if (path === `repos/${repo}/actions/runs/900`)
        return { status: state.active ? "in_progress" : "completed" };
      if (path === "users/upkeep-test%5Bbot%5D") return { id: 42 };
      if (options.method === "POST" && path.endsWith("/dispatches")) {
        if (state.failDispatch) throw new Error("dispatch unavailable");
        return null;
      }
      if (options.method === "POST" && path.endsWith("/comments")) {
        state.comments.push({
          id: "IC_new",
          body: options.body.body,
          author: { login: bot },
          createdAt: timestamp,
        });
        return {};
      }
      if (["DELETE", "POST"].includes(options.method) && path.includes("/labels")) return {};
      throw new Error(`Unexpected API request: ${path}`);
    },
    async comments() {
      return structuredClone(state.comments);
    },
    async pages(path: string) {
      if (path.includes("/commits/")) return [state.pr];
      if (path.includes("/actions/workflows/")) return state.runs;
      if (path.includes("/pulls?")) return [structuredClone(state.pr)];
      throw new Error(`Unexpected page: ${path}`);
    },
    async file(_repo: string, name: string, head: string) {
      return state.files[head]?.[name] ?? state.files[name];
    },
  };
  const c = createController({
    github,
    registry: async (name: string) => state.peers[name],
    localHead: async () => state.local,
    config: { ...config, ...state.config },
    output: (k: string, v: any) => (output[k] = v),
    now: () => new Date(timestamp),
  });
  return {
    state,
    output,
    c,
    writes: () => state.calls.filter((call: any) => call.method && call.method !== "GET"),
  };
}
const dispatchEvent = {
  inputs: { pr_number: "12", head_sha: sha, head_branch: fixture.head.ref, ci_run_id: "501" },
};

describe("controller trust and review ordering", () => {
  it.each(["fork", "actor", "label", "sha"])(
    "rejects %s before privileged operations",
    async (kind) => {
      const h = harness();
      if (kind === "fork") h.state.pr.head.repo.full_name = "outsider/fork";
      if (kind === "actor") h.state.pr.user.login = "outsider";
      if (kind === "label") h.state.pr.labels = [];
      if (kind === "sha") h.state.pr.head.sha = "c".repeat(40);
      h.state.config = { eventName: "pull_request_target" };
      const expected = kind === "sha" ? fixture : h.state.pr;
      // Use a fresh controller with the original inspected event SHA.
      const eventH = harness({ ...h.state, config: { eventName: "pull_request_target" } });
      await expect(
        eventH.c.preflight({ pull_request: { ...expected, number: 12, head: fixture.head } }),
      ).rejects.toThrow("rejected");
      expect(eventH.writes()).toEqual([]);
    },
  );
  it("deduplicates automatic review events but permits an explicit re-review", async () => {
    const h = harness({ comments: [verdict()], config: { eventName: "pull_request_target" } });
    const result = await h.c.preflight({ pull_request: fixture });
    expect(result.reason).toBe("head already reviewed");
    expect(h.output.pr_number).toBeUndefined();
    expect(h.writes()).toEqual([]);
    const manual = harness({ comments: [verdict()] });
    await manual.c.preflight(dispatchEvent);
    expect(manual.output.pr_number).toBe("12");
  });
  it("emits the live SHA for a trusted manual review", async () => {
    const h = harness();
    await h.c.preflight(dispatchEvent);
    expect(h.output.head_sha).toBe(sha);
    expect(h.output.pr_number).toBe("12");
  });
  it("waits when consumer CI failed before the verdict, then starts after it", async () => {
    const h = harness();
    await h.c.retryGate(dispatchEvent);
    expect(h.output.skip).toBe("true");
    expect(h.writes()).toEqual([]);
    h.state.comments.push(verdict());
    await h.c.retryGate(dispatchEvent);
    expect(h.output.skip).toBe("false");
    expect(h.output.attempt).toBe(1);
  });
  it.each(["workflow", "repository", "head", "status"])(
    "rejects an unrelated CI %s",
    async (kind) => {
      const h = harness({ comments: [verdict()] });
      if (kind === "workflow") h.state.run.workflow_id = 6;
      if (kind === "repository") h.state.run.head_repository.full_name = "outsider/fork";
      if (kind === "head") h.state.run.head_sha = "c".repeat(40);
      if (kind === "status") h.state.run.status = "in_progress";
      await h.c.retryGate(dispatchEvent);
      expect(h.output.skip).toBe("true");
      expect(h.writes()).toEqual([]);
    },
  );
  it("validates local checkout too", async () => {
    const h = harness({ local: "c".repeat(40) });
    await expect(h.c.verifyHead(12, sha, fixture.head.ref)).rejects.toThrow("Local");
    expect(h.writes()).toEqual([]);
  });
  it("dispatches fast failing CI only after a verified adoptable verdict", async () => {
    const h = harness({
      comments: [verdict()],
      runs: [{ id: 501, head_sha: sha, status: "completed", conclusion: "failure" }],
    });
    await h.c.verifyReview(12, timestamp);
    expect(h.output.verdict).toBe("CLEAN");
    expect(h.writes().at(-1)).toMatchObject({
      body: { inputs: { pr_number: "12", head_sha: sha, ci_run_id: "501" } },
    });
  });
  it.each(["old", "outsider", "moved"])(
    "rejects a %s verdict and reports failure once",
    async (kind) => {
      const v = verdict();
      if (kind === "old") v.createdAt = "2026-01-01T00:00:00Z";
      if (kind === "outsider") v.author.login = "outsider";
      const h = harness({ comments: [v], local: kind === "moved" ? "c".repeat(40) : sha });
      await expect(h.c.verifyReview(12, timestamp)).rejects.toThrow("Missing verdict");
      await expect(h.c.verifyReview(12, timestamp)).rejects.toThrow();
      expect(h.writes().filter((v: any) => v.path.endsWith("/comments"))).toHaveLength(1);
    },
  );
  it("consumes an unreported crashed retry attempt", async () => {
    const h = harness({ comments: [verdict()] });
    await expect(h.c.verifyRetry(12, "501", sha)).rejects.toThrow("Missing retry");
    expect(h.state.comments.at(-1).body).toContain(`<!-- ci-retry-state:501:${sha} -->`);
    await h.c.retryGate(dispatchEvent);
    expect(h.output.skip).toBe("true");
  });
  it("does not suppress crash reports just because an active marker links the run", async () => {
    const h = harness({
      comments: [
        {
          body: `<!-- upkeep-active:v1:review:${sha}:900 -->\nhttps://github.com/example/project/actions/runs/900`,
          author: { login: bot },
        },
      ],
    });
    await h.c.reportFailure(12, "review");
    await h.c.reportFailure(12, "review");
    expect(h.writes()).toHaveLength(1);
    expect(h.state.comments.at(-1).body).toContain("workflow-failed:900");
  });
  it("never comments on an untrusted failure target", async () => {
    const h = harness();
    h.state.pr.user.login = "outsider";
    await h.c.reportFailure(12, "review");
    expect(h.writes()).toEqual([]);
  });
  it("uses a generic prompt and configured sanity command", async () => {
    const h = harness();
    await h.c.prepareAgent(12, sha, fixture.head.ref, "review");
    expect(h.output.prompt).toContain("npm run check:types");
    expect(h.output.prompt).toContain(repo);
    expect(h.output.prompt).not.toContain("bohdan");
    expect(h.output.bot_id).toBe("42");
  });
});

function blockedHarness(extra: any = {}) {
  const record = {
    version: 1,
    verdictSha: sha,
    verdictId: "IC_review",
    target: { name: "typescript", spec: "^7.0.0", version: "7.0.0", lockedVersion: "6.0.0" },
    blockers: [{ name: "checker", version: "1.0.0", peerRange: "^6" }],
  };
  const pr = structuredClone(fixture);
  pr.labels.push({ name: "dep:blocked" });
  const pkg = { devDependencies: { typescript: "^7.0.0", checker: "^1.0.0" } };
  return harness({
    pr,
    comments: [verdict("BLOCKED"), { body: encodeBlockedRecord(record), author: { login: bot } }],
    files: {
      "package.json": pkg,
      "package-lock.json": { packages: { "node_modules/typescript": { version: "6.0.0" } } },
    },
    peers: { checker: { version: "1.0.1", peerDependencies: { typescript: "^6" } } },
    ...extra,
  });
}
describe("blocked controller and watchdog orchestration", () => {
  it("keeps a blocked rebase quiet", async () => {
    const h = blockedHarness();
    await h.c.watchdog();
    expect(h.writes()).toEqual([]);
  });
  it("wakes only when upstream supports the target", async () => {
    const h = blockedHarness({
      peers: { checker: { version: "2.0.0", peerDependencies: { typescript: "^7" } } },
    });
    await h.c.watchdog();
    expect(h.writes().map((v: any) => v.method)).toEqual(["DELETE", "POST", "POST"]);
    expect(h.writes()[1].body).toEqual({ ref: "main", inputs: { pr_number: "12" } });
  });
  it("restores the blocked label if dispatch fails", async () => {
    const h = blockedHarness({
      failDispatch: true,
      peers: { checker: { version: "2.0.0", peerDependencies: { typescript: "^7" } } },
    });
    await expect(h.c.watchdog()).rejects.toThrow("dispatch unavailable");
    expect(h.writes().at(-1)).toMatchObject({ body: { labels: ["dep:blocked"] } });
  });
  it("captures a versioned snapshot from a BLOCKED review", async () => {
    const h = blockedHarness();
    h.state.comments = [verdict("BLOCKED")];
    h.state.files[fixture.base.sha] = {
      "package.json": { devDependencies: { typescript: "^6.0.0", checker: "^1.0.0" } },
    };
    await h.c.verifyReview(12, timestamp);
    expect(h.state.comments.at(-1).body).toMatch(/^<!-- dep-blocked-state:v1:/);
  });
  it("does not ping while a review is active", async () => {
    const h = harness({
      active: true,
      runs: [{ head_sha: sha, status: "completed", conclusion: "failure" }],
      comments: [{ body: `<!-- upkeep-active:v1:review:${sha}:900 -->`, author: { login: bot } }],
    });
    await h.c.watchdog();
    expect(h.writes()).toEqual([]);
  });
  it("does not trust an outsider active marker and deduplicates warnings", async () => {
    const h = harness({
      active: true,
      runs: [{ head_sha: sha, status: "completed", conclusion: "failure" }],
      comments: [
        { body: `<!-- upkeep-active:v1:review:${sha}:900 -->`, author: { login: "outsider" } },
      ],
    });
    await h.c.watchdog();
    await h.c.watchdog();
    expect(h.writes()).toHaveLength(1);
  });
});

describe("consumer configuration", () => {
  it("allows a configured base branch and explicit legacy author", () => {
    expect(
      configuration(
        { "app-slug": "app", "base-branch": "develop", "legacy-comment-author": "maintainer" },
        { GITHUB_REPOSITORY: repo },
      ),
    ).toMatchObject({ baseBranch: "develop", legacyAuthor: "maintainer" });
  });
  it.each(["npm run test; cat /etc/passwd", 'npm run test"),Bash(*)', "node custom.js"])(
    "rejects unsafe sanity command %s",
    (value) => {
      expect(() =>
        configuration({ "app-slug": "app", "sanity-command": value }, { GITHUB_REPOSITORY: repo }),
      ).toThrow("sanity-command");
    },
  );
});
