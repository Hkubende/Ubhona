---
name: ubhona-fix-rls
description: Work on Ubhona Supabase tenant isolation issues in table RLS, storage policies, realtime scoping, and cross-tenant access checks. Use when the blocker or risk is in data isolation, storage access policy, or realtime leakage. Do not use for hero, generic backend runtime, or non-policy frontend bugs.
---

# Ubhona Fix RLS

- Stay inside Supabase isolation concerns.
- Check table RLS, storage policies, and realtime scoping separately.
- Model the risk as a tenant-boundary problem, not a generic bug.
- Use cross-tenant attack simulation thinking: can restaurant A read, write, list, or subscribe to restaurant B data.
- Do not drift into hero, generic runtime, or unrelated frontend work.
- Prefer the smallest policy correction that closes the leak without breaking intended access.

Use this output shape:

1. isolation failing layer
2. evidence
3. affected policy or files
4. smallest policy fix
