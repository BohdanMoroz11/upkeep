# Contributing

This repository is in its initial extraction stage. The working behavior comes from the source
website; preserve it before expanding support.

## Local checks

Use Node.js 26 and run:

```sh
npm ci --ignore-scripts
npm run check
```

Run `npm run format` to format changes. The preset validator and build/test tools are pinned and
installed through the lockfile. Run `npm run build` after runtime or prompt changes; the bundle is a
committed artifact.

## Implementation boundaries

Put state decisions in `src/`, agent instructions in `prompts/`, and controller packaging in
`actions/controller/`. Reusable workflows live in `.github/workflows/`; executable consumer event
wrappers live in `examples/npm/.github/workflows/`.

Add regression tests with controller changes. Sanitize fixtures and exclude secrets, private logs,
and personal project content. CI checks regressions, bundle freshness, preset validity, workflow
syntax, and hosted reusable-workflow source selection.

## Changes and releases

Describe the problem, resulting behavior, and relevant validation in PRs. Changes to verdict
markers, stored state, labels, workflow inputs, or secrets affect the consumer interface and need
explicit documentation.

The first release follows extraction and verification in the website. Use immutable release tags for
shared behavior; do not publish a stable tag while caller workflows or recovery paths remain
unverified.
