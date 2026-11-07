# Controller source

State logic and injected orchestration live here; `entry.mjs` connects them to GitHub Actions. See
[architecture](../docs/architecture.md) for module boundaries and
[controller action](../actions/controller/README.md) for operations.

Never import project dependencies into this runtime or read controller code from a dependency PR.
Keep mutations in the API adapter and pass collaborators to orchestration tests.
