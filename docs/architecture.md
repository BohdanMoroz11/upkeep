# Architecture

Upkeep exposes a Renovate preset, three reusable workflows, and a bundled controller action. The
consumer retains event wrappers, CI, credentials, project instructions, and dependency branches.

## Runtime selection

Each job checks out the repository and commit identified by `job.workflow_repository` and
`job.workflow_sha`. These refer to the reusable workflow defining the job, rather than the caller.
See
[GitHub's job context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context).
This targets GitHub.com; the fields are not available on GitHub Enterprise Server.

Before any consumer checkout, the job copies the committed standalone bundle to the runner temporary
directory. The bundle contains semver and both prompts. Checking out the inspected dependency SHA
into the workspace cannot delete the staged runtime. No source installation, consumer dependency, or
independently selected controller version is required.

The same bundle is exposed as a Node 24 JavaScript action under `actions/controller`. Workflow jobs
run it with their configured Node version (26 by default). `scripts/build.mjs` produces it
deterministically, and CI rejects stale output. The dependency's license notice is retained in the
bundle; the repository's MIT license covers Upkeep code.

## Controller modules

- `controller.mjs`: preflight, retry eligibility, verification, blocker capture, watchdog scanning,
  dispatch, and failure reporting.
- `github.mjs`: paginated REST reads, mutations via JSON stdin, file retrieval, and public npm
  metadata queries without inherited credentials.
- `config.mjs`: consumer inputs and safe sanity-command validation.
- `trust.mjs`: live repository/actor/base/label/branch/SHA validation.
- `verdict.mjs`: final-head checks, trusted markers, and watchdog decisions.
- `retry.mjs`: initial-review ordering, exact-head chains, duplicate-run rejection, and
  three-attempt budgets.
- `blocked.mjs`: version-one blocker snapshots and wake decisions.

API orchestration receives injected GitHub/registry/clock/worktree adapters for tests. Pure state
logic is independent of workflow events and shell. REST comment node IDs preserve legacy snapshots
originally created using GraphQL IDs. Comments, PRs, and runs are paginated.

## Events and state

Consumer wrappers own triggers and concurrency. Automatic duplicate review events skip an already
reviewed head. An explicit manual dispatch can request a re-review. Retry events validate the actual
consumer CI workflow ID, repository, SHA, branch, status, and verdict chain before issuing a write
token.

An App-authored `upkeep-active:v1` comment links the current review/retry run to its inspected SHA.
The watchdog checks the run status before reporting red CI; it does not assume a `workflow_run`
job's own head SHA is the dependency PR SHA.

Blocked snapshots retain `dep-blocked-state:v1`. A wake removes the settled label before dispatch,
restores it if dispatch fails, and records the successful wake. This avoids deleting a fresh BLOCKED
label posted by a quickly started reviewer. Runtime failures are surfaced; untrusted PRs never
receive privileged execution.

## Verification and release

Tests cover migrated state regressions, API orchestration, trust rejection, caller contracts, and
executing a copied bundle without sources or node_modules. A reusable CI check verifies GitHub's
workflow-source context on the hosted runner. Workflow syntax is checked with actionlint; its
current schema needs one narrow exception for the documented new job identity fields.

The website uses the pinned shared path. Hosted blocked-review/gate and controlled agent fix/push
evidence is recorded in [verification](verification.md), with unobserved natural-update cases
identified separately. A second real consumer is out of scope. Complete cleanup review before
tagging preset/workflows/runtime together.
