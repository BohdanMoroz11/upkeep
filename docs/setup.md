# Setup

The shared agent workflows are not available yet. This document records the setup contract for
extraction; it is not an end-to-end installation guide for a released version.

## Renovate preset

`default.json` is the repository-hosted preset, following
[Renovate's preset naming](https://docs.renovatebot.com/config-presets/). The
[npm example](../examples/npm/renovate.json) references the development branch. After a release
exists, consumers should pin both preset and workflows to that release.

Before enabling non-major automerge, install Renovate, enable repository auto-merge, and configure
branch protection with the consumer's required CI checks. The preset cannot configure GitHub
settings. Schedules and timezones belong in the consuming repository.

## Agent credentials

The intended setup uses a private GitHub App owned by each adopter and installed on selected
consuming repositories. It needs repository Contents, Pull requests, Issues, and Actions permissions
at read/write level; Metadata is implicitly read-only. Webhook delivery is unnecessary because
Actions supplies the events.

The website implementation uses these repository configuration names:

| Kind     | Name                        | Value                          |
| -------- | --------------------------- | ------------------------------ |
| Variable | `DEP_AGENT_APP_CLIENT_ID`   | App Client ID                  |
| Variable | `DEP_AGENT_APP_SLUG`        | Exact App slug without `[bot]` |
| Secret   | `DEP_AGENT_APP_PRIVATE_KEY` | Complete PEM private key       |
| Secret   | `CLAUDE_CODE_OAUTH_TOKEN`   | Claude Code model credential   |

These names describe the source implementation. Reusable workflow inputs and explicit secret
mappings will be finalized during extraction. Deployment credentials are not part of Upkeep.

## Consumer responsibilities

The consumer retains its CI, required checks, `AGENTS.md` instructions, package manifests, and
lockfile. Planned workflow inputs include base branch, CI workflow name, quick sanity command, and
notification target. The final names and defaults will be documented alongside executable caller
examples.
