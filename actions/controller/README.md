# Controller action

`action.yml` runs the committed `dist/index.cjs` bundle with Node 24. It embeds semver and the
review/retry prompts; it requires no npm install in the consuming project. The reusable workflows
stage this same bundle outside the consumer checkout and run it with Node 26 by default.

Inputs are `operation`, `config` (JSON using reusable workflow input names), and optional `pr`,
`sha`, and `branch`. Runtime credentials are supplied through step-scoped `GH_TOKEN`. `gh`, git, and
npm must be available; the standard Ubuntu runner provides them.

Supported operations:

| Operation        | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `preflight`      | Validate a review event and inspect the live PR     |
| `retry-gate`     | Validate failed CI and its verdict/retry chain      |
| `verify-head`    | Compare inspected, remote, and local heads          |
| `prepare-agent`  | Render the prompt and record the active run         |
| `verify-review`  | Check final verdict, capture blockers or recheck CI |
| `verify-retry`   | Check retry result, capture blockers or recheck CI  |
| `watchdog`       | Scan blocked and stranded major PRs                 |
| `report-failure` | Report failures on trusted PRs                      |

The CLI accepts the operation as its first argument and configuration in `UPKEEP_CONFIG`. Explicit
operations use `UPKEEP_PR`, `UPKEEP_SHA`, `UPKEEP_BRANCH`, `UPKEEP_KIND`, `UPKEEP_CI_RUN_ID`, and
`UPKEEP_STARTED_AT` as appropriate. `UPKEEP_INSTALL_LOG` identifies installation evidence. Normal
action invocation accepts `INPUT_OPERATION`, `INPUT_CONFIG`, `INPUT_PR`, `INPUT_SHA`, and
`INPUT_BRANCH` instead. GitHub event/run metadata comes from the standard Actions environment.

Outputs are declared in `action.yml` and written using random multiline delimiters. Errors fail the
process and annotate the run. See the reusable workflows for the complete supported orchestration
rather than assembling a privileged job from individual operations.

Run `npm run build` after changing runtime code or prompts. `npm run build:check` verifies that the
checked-in bundle matches the sources.
