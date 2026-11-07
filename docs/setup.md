# Setup

Upkeep is unreleased. These are executable development examples; website migration and a real Claude
review/retry remain to be verified before the first release.

## Prerequisites

Use GitHub.com, Renovate, and an npm project with `package.json` and `package-lock.json` at the
repository root. The consumer owns its CI and project instructions. Configure repository auto-merge
and branch protection with the actual required CI checks before enabling routine-update automerge.

Create `dep:major-review` and `dep:blocked` repository labels. The Renovate preset groups
patch/minor/pin/digest updates for automerge and keeps majors separate. Schedules and timezones are
consumer choices.

## App and secrets

Create a private GitHub App owned by your account and install it on the consuming repository.
Disable webhook delivery. Give it repository Contents, Pull requests, Issues, and Actions
permissions at read/write level. Metadata is implicitly read-only. Every adopter controls their own
App private key; Upkeep does not operate a shared credential service.

Set these consumer repository values:

| Kind     | Name                        | Value                          |
| -------- | --------------------------- | ------------------------------ |
| Variable | `DEP_AGENT_APP_CLIENT_ID`   | App Client ID                  |
| Variable | `DEP_AGENT_APP_SLUG`        | Exact App slug without `[bot]` |
| Secret   | `DEP_AGENT_APP_PRIVATE_KEY` | Complete PEM private key       |
| Secret   | `CLAUDE_CODE_OAUTH_TOKEN`   | Claude Code model credential   |

## Consumer files

Copy the three workflows from [examples/npm/.github/workflows](../examples/npm/.github/workflows)
into your repository, retaining the default filenames. Merge the
[example Renovate configuration](../examples/npm/renovate.json) into your own configuration. Each
wrapper maps secrets explicitly; do not replace the mapping with `secrets: inherit`.

The examples use `@main` / `#main` for development. Select a reviewed commit for testing and use a
tagged release when one exists. Pin the preset and reusable workflows together. The reusable
workflows obtain their own exact source using
[GitHub's job workflow context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context),
so their runtime and prompts come from the selected workflow commit. No second version input or
consumer npm dependency is needed. GitHub Enterprise Server is not supported by this interface.

Keep `workflow_dispatch` in the review and retry wrappers: the watchdog and completed reviews
dispatch these consumer files, not Upkeep's files. They must exist on the configured base branch for
normal dispatch. The retry wrapper's `workflow_run.workflows` value is the consumer CI workflow's
**name**, while the `ci-workflow` input is its **filename**. Both must identify the same CI
workflow.

For a non-`main` base, change both `base-branch` and the watchdog wrapper's push branch filter.

## Inputs

| Input                   | Default             | Meaning                                                      |
| ----------------------- | ------------------- | ------------------------------------------------------------ |
| `app-client-id`         | Required            | Consumer App Client ID                                       |
| `app-slug`              | Required            | App slug without `[bot]`                                     |
| `base-branch`           | `main`              | PR base and dispatch ref                                     |
| `ci-workflow`           | `ci.yml`            | Consumer CI workflow filename                                |
| `review-workflow`       | `upkeep-review.yml` | Consumer review wrapper filename                             |
| `retry-workflow`        | `upkeep-retry.yml`  | Consumer retry wrapper filename                              |
| `notification-target`   | Empty               | Optional login or org/team for warnings                      |
| `legacy-comment-author` | Empty               | Explicit trusted author of pre-adoption verdicts             |
| `sanity-command`        | `npm run typecheck` | One `npm run <script>` invocation after agent edits          |
| `node-version`          | `26`                | Node used for project commands and runtime                   |
| `model`                 | `sonnet`            | Claude model for review/retry                                |
| `credentials-only`      | `false`             | Watchdog only: authenticate without scanning or changing PRs |

The reusable workflows accept secrets `app-private-key` and, for review/retry,
`claude-code-oauth-token`. The App is installed only on selected repositories, and issued tokens are
scoped to the current consumer. The reporter uses the built-in GitHub token for failure comments on
trusted PRs.

When migrating existing automation, set `legacy-comment-author` explicitly to the prior verdict
author's GitHub login. Otherwise only the configured App's verdicts/state are trusted. Existing
GraphQL comment IDs and marker formats are preserved.

## Verification and adoption

First run the watchdog wrapper manually with `credentials_only: true`. It requests all permissions
used by Upkeep, checks the App identity and installation access, and skips PR scanning. Then verify
the website's recorded event cases and an actual agent review/retry before retiring local workflows.
Fixtures cover state transitions but cannot prove hosted model authentication or git pushes.

Major updates still require a human merge decision. Read [behavior](behavior.md) and
[security assumptions](../SECURITY.md) before adoption.
