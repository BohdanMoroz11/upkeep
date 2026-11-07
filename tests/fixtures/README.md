# Event fixtures

`pr.json` is a synthetic same-repository Renovate PR. Orchestration tests derive fork, actor, label,
and stale-head variants from it. The blocked-state tests retain the real shape of the TypeScript 7
peer-conflict regression with synthetic author identities; peer versions are recorded examples, not
current registry assertions.

Keep fixture repositories and SHAs synthetic. Exclude credentials, private content, and unnecessary
logs.
