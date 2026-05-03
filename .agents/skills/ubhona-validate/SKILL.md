---
name: ubhona-validate
description: Validate only the last completed Ubhona step with concrete evidence. Use after one execution step to confirm PASS or FAIL from runtime, console, network, storage, DB, or render evidence. Do not use for implementation.
---

# Ubhona Validate

- Validate only the last step.
- Use exact evidence, not confidence language.
- Prefer runtime signals over assumptions.
- If validation fails, name the remaining blocker precisely.
- Do not implement fixes.
- Do not validate unrelated flows.

Return only:

1. PASS or FAIL
2. exact evidence
3. runtime, console, or network result
4. remaining blocker if failed
