# Repo Skills

These are the Ubhona repo-scoped skills currently available under `.agents/skills`.

## Core Flow

- `ubhona-diagnose`
  - Identify the exact failing layer before code changes.
- `ubhona-plan`
  - Convert a confirmed diagnosis into an atomic checklist.
- `ubhona-execute-step`
  - Implement one approved step only.
- `ubhona-validate`
  - Validate the last completed step with direct evidence.
- `ubhona-close`
  - Summarize the current state and stop.

## Domain Skills

- `ubhona-fix-auth`
  - Auth client, session handling, backend verification, `req.user`.
- `ubhona-fix-upload`
  - Upload request shape, backend upload routes, validation, storage write, dish media integration.
- `ubhona-fix-backend-runtime`
  - Startup, env loading, health, DB reachability, route mounting, Supabase configuration.
- `ubhona-fix-rls`
  - Supabase RLS, storage policies, realtime scoping, tenant isolation.
- `ubhona-fix-hero`
  - Landing hero quality, motion, premium feel, 3D burger presentation.
- `ubhona-fix-analytics`
  - Analytics capture, aggregation, reporting correctness, analytics-driven automation.
- `ubhona-fix-branch-ops`
  - Branch scoping, inventory, floor plans, staff workflows, order routing, kitchen state.

## Recommended Usage Order

1. `ubhona-diagnose`
2. `ubhona-plan`
3. `ubhona-execute-step`
4. `ubhona-validate`
5. `ubhona-close`

## Source Files

- [README.md](../../.agents/skills/README.md)
- [ubhona-diagnose](../../.agents/skills/ubhona-diagnose/SKILL.md)
- [ubhona-plan](../../.agents/skills/ubhona-plan/SKILL.md)
- [ubhona-execute-step](../../.agents/skills/ubhona-execute-step/SKILL.md)
- [ubhona-validate](../../.agents/skills/ubhona-validate/SKILL.md)
- [ubhona-close](../../.agents/skills/ubhona-close/SKILL.md)
- [ubhona-fix-auth](../../.agents/skills/ubhona-fix-auth/SKILL.md)
- [ubhona-fix-upload](../../.agents/skills/ubhona-fix-upload/SKILL.md)
- [ubhona-fix-backend-runtime](../../.agents/skills/ubhona-fix-backend-runtime/SKILL.md)
- [ubhona-fix-rls](../../.agents/skills/ubhona-fix-rls/SKILL.md)
- [ubhona-fix-hero](../../.agents/skills/ubhona-fix-hero/SKILL.md)
- [ubhona-fix-analytics](../../.agents/skills/ubhona-fix-analytics/SKILL.md)
- [ubhona-fix-branch-ops](../../.agents/skills/ubhona-fix-branch-ops/SKILL.md)
