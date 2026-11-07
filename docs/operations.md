# Operations and recovery

Use the consumer's workflow names and filenames; the examples use `upkeep-review.yml`,
`upkeep-retry.yml`, and `upkeep-watchdog.yml`. The website retains its pre-adoption filenames,
configured through inputs.

## A blocked update is quiet

Check the latest BLOCKED verdict and versioned peer snapshot. Red CI is expected while published
peer ranges exclude the target. The watchdog reads current npm metadata and automatically re-reviews
a relevant change. Rebases and unrelated dependency updates do not wake it.

For an intentional fresh review, manually dispatch the consumer review wrapper with `pr_number`. Do
not add force flags, overrides, or synthetic CLEAN verdicts to get past a peer conflict. A verified
non-BLOCKED re-review removes the obsolete settled label.

## A workflow failed or no verdict appeared

Open the linked Actions run. Preflight errors identify an untrusted or stale PR; no privileged
review should run. Missing credentials or token errors require fixing the consumer's App
installation/configuration. Use the credentials-only watchdog diagnostic before retrying.

A model crash or missing report is a failed run even if no commit was pushed. The separate reporter
comments only on a trusted PR. After fixing the cause, manually dispatch review again. Do not copy
an old verdict marker to the new head.

## CI stays red

The retry gate validates the actual CI workflow, current PR head, adoptable verdict, and retry
budget. A blocked or NEEDS-HUMAN review does not enter the fixer loop. After three attempts, inspect
the logs and make the required human decision. An explicit new initial review establishes a new
retry budget; do not erase failure comments to hide spent attempts.

If a branch is conflicted, use Renovate's rebase control or resolve the conflict deliberately.
Renovate may avoid automatic rebases after agent commits.

## Upgrade or roll back

Change the preset and reusable workflow references together to a reviewed tag or commit, validate
the consumer CI, and run credentials-only verification when credentials or workflow packaging
change. Keep explicit secret mappings and any legacy-author setting needed for historical state.

Rollback uses a previously reviewed shared commit. Re-enabling an old local authoring workflow while
the shared author is also active can duplicate work; make the switch atomically.
