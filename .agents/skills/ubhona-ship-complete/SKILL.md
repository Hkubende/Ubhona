---
name: ubhona-ship-complete
description: Deliver a Ubhona task end-to-end with full implementation quality. Use when the user explicitly wants the finished product, not a partial fix, and expects diagnosis, implementation, tests, documentation, validation, and closeout to be carried through without dangling threads. Do not use for brainstorming-only requests or when the user asks to stop after a single atomic step.
---

# Ubhona Ship Complete

- Use this skill when the user explicitly asks for the whole thing to be done end-to-end.
- Treat "good enough" as failure if a real fix, test, deploy-safe validation, or documentation update is still missing.
- Preserve Ubhona's existing discipline:
  - diagnose first
  - stop at the earliest proven blocker
  - keep tenant boundaries, auth, RLS, and data integrity intact
  - do not widen scope into unrelated systems

## Operating Standard

- The answer is the finished product, not a roadmap to maybe build it later.
- Search before building.
- Test before shipping.
- Prefer the real fix over a workaround whenever the real fix is available.
- Do not leave dangling threads if they can be closed in the same pass with reasonable effort.
- Carry work through implementation, verification, and necessary docs unless the user explicitly narrows scope.

## Execution Workflow

1. Prove the failing layer.
2. Identify all required seams for a complete fix inside the requested scope.
3. Implement the real fix.
4. Add or update targeted tests.
5. Add or update documentation if behavior, setup, or operating assumptions changed.
6. Validate the full user path, not just unit-level behavior.
7. Close every thread that is necessary for a truthful "done".
8. Summarize what is fixed, what was verified, and any remaining blocker only if it is truly outside your control.

## Completeness Rules

- If backend behavior changed, add backend validation.
- If frontend behavior changed, validate the real user journey.
- If env or deploy behavior changed, validate the runtime signal that proves it.
- If a bug is caused by deploy-source mismatch, runtime identity must be proven before claiming success.
- If the user asked for a finished result, do not stop after code edits alone.

## Scope Guardrails

- Complete does not mean unbounded.
- Stay within the user's requested system and its proven dependencies.
- Fix all required seams for that request, but do not drift into unrelated cleanup or opportunistic refactors.
- If a later failure is blocked by an earlier runtime failure, fix the earlier one first and continue until the full requested path is proven or an external blocker is reached.

## Required Validation Mindset

- Unit or route tests where appropriate.
- Build validation when code changed.
- Runtime validation for the real path the user cares about.
- Prefer PASS/FAIL with direct evidence:
  - network request
  - rendered behavior
  - backend log
  - DB result
  - health endpoint
  - storage write
  - test output

## Documentation Expectations

- Update repo docs when deployment steps, env expectations, or operational behavior changed.
- Update skill or repo guidance if the new work introduces a repeated workflow the team should reuse.
- Do not create ceremony docs that add no future value.

## Output Contract

Return only:

1. files changed
2. code path changed
3. validation result
4. remaining blocker or next step

## Example Invocations

- `Use $ubhona-ship-complete to finish Task 7 end-to-end, including runtime validation.`
- `Use $ubhona-ship-complete to ship the upload fix completely with tests and live verification.`
- `Use $ubhona-ship-complete to take this from bug report to verified done without stopping after the first patch.`
