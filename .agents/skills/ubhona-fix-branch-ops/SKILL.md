---
name: ubhona-fix-branch-ops
description: Work on Ubhona branch and operations issues in multi-branch scoping, branch-specific inventory, floor plans, staff workflows, order routing, kitchen state, and branch-level visibility rules. Use when the blocker is clearly in branch operations behavior. Do not use for hero visuals, generic auth work, upload pipelines, or unrelated analytics problems.
---

# Ubhona Fix Branch Ops

- Stay inside multi-branch and branch-operations behavior.
- Separate the failing layer clearly: branch resolution, branch-scoped data fetch, branch-scoped write, workflow state transition, visibility rule, or operational UI rendering.
- Verify branch isolation and branch-targeted behavior before changing UX.
- Treat auth or runtime as upstream blockers only when they directly prevent branch operations from working.
- Do not drift into hero visuals, upload fixes, or unrelated analytics work.
- Do not refactor unrelated domain models.
- Prefer the smallest fix that restores one branch-scoped workflow or visibility rule.

Use this output shape:

1. branch-ops failing layer
2. evidence
3. files to change
4. smallest branch-ops fix
