# Behavior

This behavior is extracted from the website implementation. Website adoption remains an integration
gate.

## Routine updates

Renovate groups patch, minor, pin, and digest updates into one PR eligible for platform automerge.
Required consumer CI is the merge gate. Major updates explicitly clear inherited grouping so each
target can be reviewed and tracked independently, and receive `dep:major-review`.

## Major review

The agent reads upstream release notes and migration guidance, checks whether current direct
dependents support the new major, and reports one verdict for the final reviewed commit.

| Verdict       | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `CLEAN`       | Adoptable without project changes                         |
| `MIGRATED`    | Adoptable after changes committed and pushed by the agent |
| `BLOCKED`     | An identified upstream constraint prevents adoption       |
| `NEEDS-HUMAN` | A decision requires the maintainer                        |

Verdict comments begin with `<!-- dep-verdict:<VERDICT>:<final-head-sha> -->`. The local and remote
heads must agree. CI validates the result; a human decides whether to merge a major.

Dependency installation is deliberately non-fatal: an unresolved lockfile can be evidence of an
upstream peer conflict. Never use force flags or overrides to bypass incompatible peers.

## Retry and blocked state

A failed CI run is eligible for a fixer only after an adoptable verdict for the relevant head. Stale
and duplicate runs are ignored; fixes stop after three attempts per review. A new review establishes
a new retry budget.

A BLOCKED verdict records the target and incompatible latest direct peers. The PR remains open.
Re-review happens when the target specifier changes, its lockfile entry resolves the target, or all
recorded blockers become compatible. Routine rebases and unrelated dependency changes stay quiet.

The watchdog reports stranded or conflicting PRs. Missing verdicts, crashes, and missing credentials
must be visible. The extraction must preserve and test these failure paths before consumer
migration.

Only incompatible latest published direct peer ranges are tracked as automated BLOCKED state. Other
adoption constraints require NEEDS-HUMAN so the scanner does not repeatedly wake an unrepresentable
blocker.
