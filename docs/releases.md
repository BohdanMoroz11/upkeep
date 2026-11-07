# Releases

Upkeep is consumed through GitHub, not an npm install. A release identifies the Renovate preset,
reusable workflows, prompts, and committed controller bundle together.

## Compatibility

Pin all consumer references to the same reviewed tag or commit. Reusable jobs resolve their own
runtime source; no second controller version is selected. Keep published tags immutable.

During the initial `0.x` series, document interface changes in the changelog and use a new minor
release for changes to inputs, dispatch contracts, secrets, verdict semantics, or persisted-state
interpretation. Patch releases preserve those contracts. The persisted blocker/wake/active comment
formats carry their own version independently of the release number.

## Release procedure

1. Merge reviewed fixes and ensure Upkeep CI is green, including bundle freshness and hosted runtime
   checks.
2. Record the consumer verification evidence and limitations in [verification](verification.md).
   Verify model authentication, comments, and an App-authenticated git push with resulting consumer
   CI.
3. Merge the website cleanup and confirm its own required CI. Remove temporary integration
   PRs/branches after their evidence is recorded.
4. Finalize release notes from `CHANGELOG.md`, choose the initial release tag, and publish it on the
   verified merged Upkeep commit.
5. Replace development/commit references in the website and consumer examples with the tag in
   reviewed PRs. Do not reference a tag that does not exist yet.

The initial release is **v0.1.0**. See [the changelog](../CHANGELOG.md) and
[verification record](verification.md) for its scope and evidence. There is no hosted service or
shared App credential to publish.
