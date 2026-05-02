---
name: ubhona-fix-backend-runtime
description: Work on Ubhona backend runtime issues in startup, route mounting, health endpoint behavior, env loading, DB reachability, and Supabase configuration. Use when the server fails to start, routes are missing, health is failing, or runtime dependencies are not resolving. Do not use for hero, upload feature polish, or frontend-only issues.
---

# Ubhona Fix Backend Runtime

- Stay inside backend runtime behavior.
- Check startup first, then env loading, then route mounting, then health behavior, then DB reachability, then Supabase configuration.
- Separate boot failure from request-time failure.
- Treat auth, uploads, and UI as downstream unless runtime is confirmed healthy.
- Do not work on hero or frontend-only issues.
- Do not drift into feature refactors.
- Prefer the smallest runtime fix that restores predictable health and route behavior.

Use this output shape:

1. runtime failing layer
2. evidence
3. files to change
4. smallest runtime fix
