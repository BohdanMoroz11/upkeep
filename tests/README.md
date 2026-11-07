# Regression coverage

Run `npm test`. `tests/unit` preserves the source website's trust, retry, and blocked-target
regressions and adds mocked GitHub/registry orchestration tests, final-head checks, caller-workflow
contracts, pagination, and standalone-bundle execution.

No test needs credentials or invokes Claude. A separate reusable CI job verifies actual workflow
source selection on GitHub. These checks do not replace consumer migration and real agent
integration testing.
