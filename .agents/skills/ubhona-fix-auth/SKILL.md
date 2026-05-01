---
name: ubhona-fix-auth
description: Work on Ubhona auth issues in the frontend auth client, token and session handling, backend auth verification, req.user resolution, login/logout, and session restoration. Use when the blocker is clearly in auth. Do not use for hero styling, uploads unless blocked by auth, or database schema changes unless auth cannot work without them.
---

# Ubhona Fix Auth

- Stay inside auth client, session state, token flow, backend verification, and `req.user`.
- Verify whether the failure is in frontend token storage, backend JWT verification, user lookup, or active restaurant resolution.
- Treat upload, billing, and UI failures as downstream unless auth is the confirmed blocker.
- Do not touch hero styling.
- Do not touch uploads unless auth is what blocks them.
- Do not change database schema unless auth cannot work without it.
- Prefer the smallest auth fix that restores a valid session path.

Use this output shape:

1. auth failing layer
2. evidence
3. files to change
4. smallest auth fix
