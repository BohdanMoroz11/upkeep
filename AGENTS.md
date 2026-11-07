# Upkeep

Public dependency-update automation extracted from `BohdanMoroz11/personal-website`.

- Initial scope: GitHub, Renovate, npm/package-lock, Claude Code.
- The source website is the integration consumer. No second consumer is required.
- Current base contains a Renovate preset, documentation, example, and CI. Reusable agent workflows
  and controller code are the next extraction step; do not describe them as available until
  implemented.
- `default.json` is the public Renovate preset; `renovate.json` would configure this repository
  itself.
- Consumer CI and project instructions stay in the consumer. Shared code must not embed its
  hostname, notification username, deployment token, or commands.
- Keep review/retry/watchdog decisions in tested controller modules, and GitHub mutations in an
  explicit API layer.
- Preserve exact-head verdicts, bounded retries, durable BLOCKED state, and Renovate trust checks.
  Never bypass incompatible peer ranges to force a green build.
- Consumer installation must not execute with a write token. Document the remaining boundary when
  agent commands run with scoped credentials.
- `npm run check` runs formatting and Renovate preset validation. Add regression tests with
  controller extraction.
- License: MIT. No release or compatibility promises until website adoption is verified.
