# Ubhona Repo Skills

## Available Skills

- `ubhona-diagnose`: Identify the exact failing layer before code changes.
- `ubhona-plan`: Convert a diagnosis into an atomic, testable checklist.
- `ubhona-execute-step`: Implement one approved step only.
- `ubhona-validate`: Validate only the last step with concrete evidence.
- `ubhona-close`: Summarize the completed unit of work and stop.
- `ubhona-fix-auth`: Work only on auth client, session handling, backend verification, and `req.user`.
- `ubhona-fix-upload`: Work only on upload request shape, route handling, validation, storage write, and dish media integration.
- `ubhona-fix-backend-runtime`: Work only on backend startup, route mounting, env loading, health, DB reachability, and Supabase configuration.
- `ubhona-fix-rls`: Work only on Supabase RLS, storage policies, realtime scoping, and tenant isolation validation.
- `ubhona-fix-hero`: Work only on landing hero quality, HeroMedia, 3D burger presentation, motion, lighting, and premium feel.
- `ubhona-fix-analytics`: Work only on analytics capture, aggregation, reporting correctness, and analytics-driven automation signals.
- `ubhona-fix-branch-ops`: Work only on multi-branch scoping, inventory, floor plans, staff workflows, order routing, kitchen state, and branch visibility rules.
- `ubhona-ship-complete`: Deliver a requested Ubhona task end-to-end with diagnosis, implementation, tests, docs, runtime validation, and no dangling threads inside scope.

## Recommended Usage Order

1. `$ubhona-diagnose`
2. `$ubhona-plan`
3. `$ubhona-execute-step`
4. `$ubhona-validate`
5. `$ubhona-close`

Use a domain skill instead of a generic step only when the failing layer is already known.

## Example Invocations

- `Use $ubhona-diagnose to identify the exact remaining blocker in the upload flow.`
- `Use $ubhona-plan to convert that diagnosis into an atomic checklist.`
- `Use $ubhona-execute-step to implement step 1 only.`
- `Use $ubhona-validate to confirm the last step passes.`
- `Use $ubhona-close to summarize the current state and what remains.`

- `Use $ubhona-fix-auth to isolate why req.user is missing after login refresh.`
- `Use $ubhona-fix-upload to identify why thumbnail upload fails after the request leaves the browser.`
- `Use $ubhona-fix-backend-runtime to isolate why /health is timing out despite env vars being present.`
- `Use $ubhona-fix-rls to verify storage access is tenant-scoped and cannot leak across restaurants.`
- `Use $ubhona-fix-hero to improve the landing hero's premium feel without touching auth or backend code.`
- `Use $ubhona-fix-analytics to isolate why a dashboard metric or event pipeline is wrong.`
- `Use $ubhona-fix-branch-ops to isolate why a branch-scoped workflow behaves incorrectly.`
- `Use $ubhona-ship-complete to finish a requested task completely and verify the full user path before closing.`

## Usage Notes

- Prefer one skill per pass unless the handoff is explicit.
- Do not use execution skills before the failing layer is proven.
- Stop after validation unless the user explicitly asks to continue.
- Use `ubhona-ship-complete` only when the user explicitly wants the finished product, not a narrow atomic step.
