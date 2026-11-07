# Changelog

## v0.1.0 — 2026-11-07

Initial extraction from the personal website:

- Renovate preset for grouped routine updates and separately reviewed majors.
- Reusable review, retry, and watchdog workflows with explicit consumer configuration and secrets.
- Bundled controller action and prompts selected from the reusable workflow's exact commit.
- Live Renovate trust checks, final-head verdicts, bounded retries, blocked snapshots, and
  peer-aware wake-up.
- Failure reporting, active-run tracking, credential-only diagnostics, and legacy verdict-author
  migration.
- npm consumer example, setup/security/architecture docs, and automated
  regression/packaging/workflow checks.

Adoption fixes:

- Require upstream research even when peer metadata already proves an update is blocked.
- Clear obsolete blocked labels when re-review produces CLEAN, MIGRATED, or NEEDS-HUMAN.

Supported scope: GitHub.com, Renovate, npm/package-lock at repository root, and Claude Code. Each
adopter owns its GitHub App and model credential. See the verification record for observed behavior
and remaining limits. The preset, workflows, prompts, and bundled runtime are released together
under the v0.1.0 tag.
