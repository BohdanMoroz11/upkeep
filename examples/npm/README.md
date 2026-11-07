# npm consumer example

`renovate.json` demonstrates the available development preset. It points to `main`, which is mutable
and unreleased; use a release tag for production adoption once one exists.

The example does not provide automated major reviews yet. Consumer trigger workflows will be added
under `.github/workflows/` with the reusable implementation. Keep your existing dependency review
automation until migration is verified.

The consumer needs npm with a committed `package-lock.json`, its own CI, required branch checks, and
repository auto-merge enabled. It supplies its own schedule, timezone, project instructions, and
credentials. See [setup](../../docs/setup.md).
