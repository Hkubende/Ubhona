---
name: ubhona-plan
description: Turn a diagnosed Ubhona issue into an atomic execution checklist. Use after the failing layer is already identified and the user wants a step-by-step plan with independently testable steps. Do not use for diagnosis or implementation.
---

# Ubhona Plan

- Build a step-by-step checklist from the confirmed diagnosis.
- Make each step independently testable.
- Keep steps atomic and ordered.
- Do not combine unrelated fixes.
- Do not implement anything.
- If a step crosses system boundaries, split it.
- Include the expected PASS or FAIL signal for each step.

Return only:

1. step-by-step checklist
2. PASS/FAIL signal per step
