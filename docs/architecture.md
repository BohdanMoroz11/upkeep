# Architecture

The extraction has three public pieces: a Renovate preset, reusable GitHub workflows, and a
controller action. The preset is present; workflow and controller interfaces are still being
implemented.

## Consumer and shared repository

The consumer holds event-trigger wrappers, its own CI and project instructions, App configuration,
and dependency branches. Upkeep holds the preset, review/retry/watchdog workflows, generic prompts,
and controller logic.

Reusable workflows must execute the controller and prompts from the same selected Upkeep release. A
normal checkout in a reusable workflow refers to the consumer context, so the implementation must
explicitly distinguish shared code from the dependency branch. It must work without adding Upkeep as
a dependency of the consumer project.

## Controller boundaries

Planned modules:

- `controller.mjs`: operation entry point.
- `github.mjs`: API reads and explicit mutations.
- `trust.mjs`: live Renovate PR and SHA validation.
- `verdict.mjs`: parsing and final-head verification.
- `retry.mjs`: review ordering, deduplication, and retry budgets.
- `blocked.mjs`: durable blocker snapshots and wake decisions.

Extract pure decisions from API orchestration so recorded event cases can be tested without
credentials. Keep shell glue small. Preserve existing comment formats initially; document and
version changes that alter stored state or consumer behavior.

## Release and verification

One immutable release must identify the preset, workflows, controller, and prompts together. Do not
introduce a separately published npm package for the consumer to manage.

Prove the shared path in the source website using regression fixtures and controlled PRs. Verify
routine non-majors, a clean major, an uninstallable/blocked major, retry ordering, blocked wake-up,
and trust rejection. A second consumer is out of scope.

Retire local website logic only once the shared implementation is verified. The public release
follows that migration.
