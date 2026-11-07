# Verification record

The integration consumer is
[the personal website](https://github.com/BohdanMoroz11/personal-website). This record separates
hosted observations from fixture coverage; it is not a claim that every dependency ecosystem has
been tested.

## Hosted observations

| Path                                            | Evidence                                                                                          | Result                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-repository runtime and App authentication | [Credential-only run](https://github.com/BohdanMoroz11/personal-website/actions/runs/42385415375) | Pinned source checkout, secret mapping, token permissions, App identity, and consumer access passed; no scan mutations                                |
| First shared watchdog                           | [Post-adoption run](https://github.com/BohdanMoroz11/personal-website/actions/runs/42385903983)   | Existing legacy blocked snapshot was accepted; unrelated rebases did not wake the PR                                                                  |
| Real major review and snapshot                  | [TypeScript 7 review](https://github.com/BohdanMoroz11/personal-website/actions/runs/42385975671) | App-authored exact-head BLOCKED verdict and fresh peer snapshot; exposed missing upstream research                                                    |
| Revised source-reading prompt                   | [Isolated re-review](https://github.com/BohdanMoroz11/personal-website/actions/runs/42386371202)  | Source-cited BLOCKED verdict and snapshot posted; [public verdict](https://github.com/BohdanMoroz11/personal-website/pull/48#issuecomment-6708990071) |
| Real failed CI on a blocked major               | [Retry gate](https://github.com/BohdanMoroz11/personal-website/actions/runs/42386175297)          | Logged `Skipping retry: blocked bump`; no fixer token or model invocation                                                                             |

The initial review admitted it had not fetched release guidance. The revised prompts require
research even for peer-blocked updates, a Sources read section, and a retrieval-failure explanation.
This is an agent instruction, not a mechanical proof that a model actually read a document.

## Controlled agent fix and push

A disposable [fixture PR #79](https://github.com/BohdanMoroz11/personal-website/pull/79) introduced
a small broken sum function and an asserting unit test, without changing production code or
manifests.
[Initial CI failed at the intended assertion](https://github.com/BohdanMoroz11/personal-website/actions/runs/42386748356).

An owner-only manual diagnostic used the same pinned Claude action, App credentials, bot identity,
disabled checkout credential persistence, and token-after-install ordering as the shared fixer.
[The diagnostic passed](https://github.com/BohdanMoroz11/personal-website/actions/runs/42387045904).
The agent read the CI log, changed only subtraction to addition, committed as the configured App
bot, pushed
[commit 8e7fb50](https://github.com/BohdanMoroz11/personal-website/commit/8e7fb50c6873eb65fc865edde84d9c703e730b17),
and reported the matching final SHA. The App push triggered
[new consumer CI](https://github.com/BohdanMoroz11/personal-website/actions/runs/42387156438), and
static checks, Playwright/axe, and Lighthouse all passed.

This verifies actual model/git authentication and CI triggering. It is a composed integration
diagnostic, not an assertion that a naturally occurring adoptable major passed through the entire
shared retry workflow. Production Renovate trust checks were not relaxed, and no synthetic adoptable
verdict was placed on the real blocked major. The fixture was closed without merging after all three
CI checks passed, and the temporary diagnostic branches were removed.

## Regression coverage

The test suite covers clean/adoptable verdict eligibility, CI finishing before review, duplicate and
stale events, retries and exhaustion, wrong actor/repository/label/base/SHA, final-head reports,
crashes, blocked snapshots, unrelated rebases, compatible peer wake-up, and dispatch rollback. Tests
also cover clearing a stale blocked label when a re-review becomes CLEAN, MIGRATED, or NEEDS-HUMAN.

Packaging tests execute a copied bundle without source files or node_modules. Hosted Upkeep CI
verifies reusable-workflow source selection. These do not require model credentials.

## Remaining limits

At adoption time the only open Renovate major was genuinely peer-blocked. No real adoptable major
was forced through the review/retry gate. Upstream compatibility wake-up and a naturally occurring
non-major automerge remain observation cases; their decisions and preserved policy are checked by
fixtures and configuration validation.

Record live results without replacing the real blocker with a synthetic verdict. A second consumer
is not a release requirement.
