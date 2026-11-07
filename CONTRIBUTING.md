# Contributing

This repository is in its initial extraction stage. The working behavior comes from the source
website; preserve it before expanding support.

## Local checks

Use Node.js 26 and run:

```sh
npm ci --ignore-scripts
npm run check
```

Run `npm run format` to format changes. The preset validator is version-pinned in `package.json` and
installed through the lockfile.

## Implementation boundaries

Put state decisions in `src/`, agent instructions in `prompts/`, and controller packaging in
`actions/controller/`. Reusable workflows will live in `.github/workflows/`; consumer event wrappers
will live in `examples/npm/.github/workflows/` once executable.

Add regression tests alongside the extracted controller. Sanitize fixtures and keep private keys,
tokens, private logs, and personal project content out of them. CI currently checks the files that
exist; controller tests and workflow checks will be added with those implementations.

## Changes and releases

Describe the problem, resulting behavior, and relevant validation in PRs. Changes to verdict
markers, stored state, labels, workflow inputs, or secrets affect the consumer interface and need
explicit documentation.

The first release follows extraction and verification in the website. Use immutable release tags for
shared behavior; do not publish a stable tag while caller workflows or recovery paths remain
unverified.
