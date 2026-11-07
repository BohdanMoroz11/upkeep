import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { GitHub } from "../../src/github.mjs";
import { reviewResult, retryResult } from "../../src/verdict.mjs";
import { smokeRuntime } from "../../scripts/smoke-runtime.mjs";
const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const workflow = (file: string) => parse(read(file));
const sha = "a".repeat(40);

describe("standalone packaging and workflow contracts", () => {
  it("runs the committed bundle without source files or node_modules", () => {
    expect(smokeRuntime()).toContain("head_sha");
  });
  it("paginates comments without losing the original GraphQL node ids", async () => {
    const api = new GitHub();
    const pages: any[] = [];
    api.request = async (path) => {
      pages.push(path);
      return path.endsWith("page=1")
        ? Array.from({ length: 100 }, () => ({
            node_id: "IC_legacy",
            body: "old",
            user: { login: "app[bot]" },
            created_at: "2026-11-07T00:00:00Z",
          }))
        : [];
    };
    const comments = await api.comments("example/project", 12);
    expect(comments).toHaveLength(100);
    expect(comments[0].id).toBe("IC_legacy");
    expect(pages[1]).toContain("page=2");
  });
  it.each(["review", "retry", "watchdog"])(
    "checks out %s runtime from its own selected workflow commit",
    (kind) => {
      const doc = workflow(`.github/workflows/${kind}.yml`);
      for (const job of Object.values(doc.jobs) as any[]) {
        const checkout = job.steps[0];
        expect(checkout.with.repository).toBe("${{ job.workflow_repository }}");
        expect(checkout.with.ref).toBe("${{ job.workflow_sha }}");
        for (const step of job.steps.filter((s: any) => s.uses?.startsWith("actions/checkout@")))
          expect(step.with["persist-credentials"]).toBe(false);
      }
    },
  );
  it.each(["review", "retry"])(
    "keeps %s installation before token minting and reports job failures",
    (kind) => {
      const doc = workflow(`.github/workflows/${kind}.yml`),
        steps = doc.jobs[kind].steps;
      const install = steps.findIndex(
        (s: any) => s.name === "Install dependencies as non-fatal evidence",
      );
      const token = steps.findIndex((s: any) => s.id === "agent_token");
      expect(install).toBeGreaterThan(0);
      expect(token).toBeGreaterThan(install);
      expect(steps[install]["continue-on-error"]).toBe(true);
      expect(steps[install].env).toBeUndefined();
      expect(steps[token - 1].name).toBe("Recheck inspected head before issuing write token");
      expect(doc.jobs["report-failure"].if).toContain("result == 'failure'");
      expect(doc.on.workflow_call.secrets["app-private-key"].required).toBe(true);
    },
  );
  it.each(["review", "retry", "watchdog"])(
    "ships a matching %s event wrapper with explicit secrets",
    (kind) => {
      const wrapper = workflow(`examples/npm/.github/workflows/upkeep-${kind}.yml`);
      expect(wrapper.jobs[kind].uses).toBe(
        `BohdanMoroz11/upkeep/.github/workflows/${kind}.yml@main`,
      );
      expect(wrapper.jobs[kind].secrets).not.toBe("inherit");
      expect(wrapper.concurrency["cancel-in-progress"]).toBe(false);
    },
  );
  it("preserves the retry dispatch inputs and failed-CI trigger", () => {
    const doc = workflow("examples/npm/.github/workflows/upkeep-retry.yml");
    expect(Object.keys(doc.on.workflow_dispatch.inputs)).toEqual([
      "pr_number",
      "head_sha",
      "head_branch",
      "ci_run_id",
    ]);
    expect(doc.on.workflow_run.workflows).toEqual(["CI"]);
  });
});

describe("final-head verification", () => {
  const author = "app[bot]",
    date = "2026-11-07T00:00:00Z";
  const comment = (body: string) => ({ body, author: { login: author }, createdAt: date });
  it("accepts a same-second fresh verdict and rejects a mismatched local head", () => {
    const data = {
      comments: [comment(`<!-- dep-verdict:CLEAN:${sha} -->`)],
      author,
      sha,
      localSha: sha,
      startedAt: date,
    };
    expect(reviewResult(data)?.verdict).toBe("CLEAN");
    expect(reviewResult({ ...data, localSha: "b".repeat(40) })).toBeNull();
  });
  it("accepts a BLOCKED retry verdict only after the attempt report", () => {
    const attempt = comment(`<!-- ci-retry-attempt -->\n<!-- ci-retry-state:501:${sha} -->`),
      blocked = comment(`<!-- dep-verdict:BLOCKED:${sha} -->`);
    const data = { author, sha, localSha: sha, runId: "501" };
    expect(retryResult({ ...data, comments: [attempt, blocked] })).toEqual({ blocked: true });
    expect(retryResult({ ...data, comments: [blocked, attempt] })).toEqual({ blocked: false });
  });
});
