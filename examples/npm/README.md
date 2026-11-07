# npm consumer example

This example contains the Renovate preset reference and three executable trigger wrappers. It
targets GitHub.com and an npm project whose manifests live at the repository root. Follow
[setup](../../docs/setup.md) for labels, required CI, auto-merge, App configuration, and secrets.

The examples pin the preset and workflows to **v0.1.0**. Update those references together when
adopting another reviewed release. The runtime automatically uses the reusable workflow's selected
source commit.

- `upkeep-review.yml`: labeled/opened major PRs and explicit re-review dispatch.
- `upkeep-retry.yml`: completed CI runs and dispatch from a finished review/fixer.
- `upkeep-watchdog.yml`: base pushes, six-hour scans, and credential-only diagnostics.

Customize `ci-workflow` (filename), the retry event's `workflows` list (CI name), `base-branch` and
the push filter together, `sanity-command`, and optional notification target. Keep dispatch input
names intact. If renaming review/retry wrappers, pass the matching filename inputs so the controller
dispatches your files.

When replacing automation with owner-authored historical comments, set `legacy-comment-author` to
that exact login. The default trusts only the configured App. Keep existing automation until the
shared integration is verified; do not enable both agent paths on the same PRs.
