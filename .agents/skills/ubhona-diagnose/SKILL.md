---
name: ubhona-diagnose
description: Identify the exact failing layer in Ubhona before making code changes. Use when the user asks to debug, isolate a blocker, find the root cause, or determine whether the problem is in frontend, backend, auth, DB, storage, RLS, infra, or UI rendering. Do not use for implementation.
---

# Ubhona Diagnose

- Identify one exact failing layer before proposing any fix.
- Separate layers explicitly: frontend, backend route, auth, DB, storage, RLS, infra, or UI rendering.
- Use concrete evidence only: request shape, console output, backend log, health result, DB response, storage response, or rendered behavior.
- Stop at the earliest confirmed failing layer.
- If a later layer is blocked by an earlier one, name the earlier one as the failure.
- Do not change code.
- Do not guess.

Return only:

1. failing layer
2. evidence
3. affected files
4. smallest likely fix
