# Security

Upkeep is unreleased. No version is currently supported for production adoption.

## Reporting

Use
[GitHub private vulnerability reporting](https://github.com/BohdanMoroz11/upkeep/security/advisories/new)
when available. Otherwise contact Bohdan through [bohdanmoroz.com](https://bohdanmoroz.com) to
arrange private disclosure. Do not put credentials or exploit details in public issues.

## Intended trust boundary

Consumers own their GitHub App installations and model credentials. App tokens are restricted to the
consuming repository and requested permissions. The shared project does not distribute a maintainer
private key to adopters.

Before privileged review, validate the live PR's repository, Renovate author, label, branch, base,
and inspected SHA. Run dependency installation without persisted checkout credentials or a write
token. Check for branch movement before privileged execution and reject stale reports.

An agent may run project commands after receiving its scoped write token. A malicious dependency or
script executed then could attempt to use that token. This design limits credential scope; it is not
a sandbox for arbitrary dependency code.

Required CI and branch protection are part of the merge gate. An agent verdict is not a substitute
for them.
