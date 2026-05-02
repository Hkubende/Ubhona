## Ubhona Codex OS

### What Ubhona Is

Ubhona is a premium restaurant-tech SaaS for 3D and AR menu experiences, restaurant operations, kitchen and staff workflows, media uploads, multi-branch management, analytics, automation, inventory, reservations, and production-grade auth.

### Engineering Priorities

1. Preserve backend correctness before improving surface UX.
2. Isolate the exact failing layer before changing code.
3. Prefer the smallest correct fix over broad cleanup.
4. Keep tenant boundaries, auth, and data integrity intact.
5. Validate each atomic change before continuing.

### Non-Negotiables

- Do not fix multiple unrelated systems in one pass.
- Do not mix infra, auth, DB, and UI unless explicitly instructed.
- Always identify the exact failing layer before editing code.
- Always prefer one atomic fix over a bundled refactor.
- Validate after each step.
- Do not claim success without runtime evidence.
- Do not expand scope because adjacent issues are visible.

### Default Execution Workflow

1. Diagnose.
2. Plan.
3. Execute one atomic step.
4. Validate.
5. Summarize.
6. Stop unless explicitly asked to continue.

### Debugging Rules

- Separate the issue into one layer first: frontend, backend route, auth, DB, storage, RLS, infra, or UI rendering.
- State the failing layer before proposing a fix.
- Use concrete evidence: logs, request shape, console output, route behavior, DB response, storage response, or rendered result.
- If the failing layer is not proven, keep diagnosing.
- If a later layer is blocked by an earlier layer, stop at the earliest confirmed failure.

### Scope Control Rules

- One task unit should change one system or one clearly bounded seam.
- If the request starts in uploads, do not drift into auth or hero polish unless the upload path is blocked there.
- If the request starts in hero UX, do not touch backend, auth, or schema unless asset delivery is the blocker.
- If the request starts in auth, do not refactor uploads or styling unless auth is proven to block them.
- Defer cleanup, naming, and architecture improvements unless they are required for the fix.

### External Reference Rule

- Read repo-local instructions and existing code first.
- Use Context7 for current external library or framework documentation before making version-sensitive changes.
- Use Context7 for API usage, setup/configuration questions, and avoiding stale examples.
- Do not use Context7 to override repo-specific architecture, tenant isolation, auth, or validation rules.

### Validation Expectations

- Validate the exact step that was changed.
- Prefer PASS or FAIL with direct evidence.
- Include the runtime signal used: network request, backend log, health response, DB query result, storage result, browser render, or test output.
- If validation fails, report the remaining blocker precisely.
- Do not start the next implementation step automatically unless explicitly told to continue.

### Preferred Codex Output Format

Use short, exact sections in this order:

1. `failing layer`
2. `why`
3. `evidence`
4. `affected files`
5. `smallest fix`

For planning output, use:

1. testable checklist
2. PASS/FAIL signal per step

For execution output, use:

1. files changed
2. code path changed
3. validation result
4. remaining blocker or next step

### Repo Skill Usage

Use repo-scoped skills under `.agents/skills` when the task matches their boundary.

Examples:

- Use `$ubhona-diagnose` to identify the exact remaining blocker in the upload flow.
- Use `$ubhona-plan` to convert that diagnosis into an atomic checklist.
- Use `$ubhona-execute-step` to implement step 1 only.
- Use `$ubhona-validate` to confirm the step passes.
- Use `$ubhona-close` to summarize the current state.
- Use `$ubhona-fix-auth` when the issue is in token handling, session restoration, backend verification, or `req.user`.
- Use `$ubhona-fix-upload` when the issue is in frontend upload request shape, backend upload routes, validation, storage write, or dish media integration.
- Use `$ubhona-fix-backend-runtime` when the issue is in startup, env loading, health, route mounting, DB reachability, or Supabase configuration.
- Use `$ubhona-fix-rls` when the issue is in Supabase policies, storage scoping, realtime scoping, or cross-tenant access.
- Use `$ubhona-fix-hero` when the issue is in landing hero quality, media composition, motion, or premium feel.
- Use `$ubhona-fix-analytics` when the issue is in event capture, aggregation, reporting correctness, or analytics-derived automation signals.
- Use `$ubhona-fix-branch-ops` when the issue is in multi-branch scoping, branch inventory, staff workflows, kitchen routing, floor plans, or branch visibility rules.
- Use `$ubhona-ship-complete` when the user explicitly wants the full task carried through end-to-end with the real fix, tests, docs, runtime validation, and no dangling threads inside scope.
