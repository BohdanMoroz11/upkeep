# Agent prompts

`review.md` and `retry.md` are generic instructions embedded into the controller bundle at build
time. Rendering supplies repository/PR context, the configured sanity command, and failed CI run ID.
Installation output is appended as untrusted evidence with safe multiline output handling.

Project conventions remain in the consumer's AGENTS.md / CLAUDE.md. Prompts require fetched upstream
sources, mechanically checked peer compatibility, no forced peer bypass, and a report for the final
local/remote head. Only incompatible published direct peer ranges enter automated BLOCKED tracking;
other constraints require a human decision.
