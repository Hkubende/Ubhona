---
name: ubhona-execute-step
description: Implement one approved atomic step in Ubhona and stop. Use only after a diagnosis and explicit plan exist, and the user wants a single step executed without continuing to later steps. Do not use for broad refactors or multi-step implementation.
---

# Ubhona Execute Step

- Implement one specified step only.
- Change the smallest possible surface that satisfies that step.
- Do not continue to later plan steps.
- Do not refactor unrelated code.
- Do not widen scope because adjacent issues are visible.
- Validate only enough to prove this step changed the intended path.

Return only:

1. files changed
2. exact code path changed
3. why this step only
4. any new risk introduced
