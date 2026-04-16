# Ubhona Workflow

Use this when contributing through GitHub or preparing work for review.

## Default Engineering Order

1. Diagnose the exact failing layer.
2. Plan one atomic fix.
3. Execute one bounded change.
4. Validate with direct runtime evidence.
5. Summarize and stop unless more work is explicitly requested.

## Non-Negotiables

- Preserve backend correctness before surface polish.
- Do not mix infra, auth, DB, and UI unless the earlier layer proves to block the later one.
- Prefer the smallest correct fix over broad cleanup.
- Keep auth, tenant boundaries, and data integrity intact.

## Ubhona-Specific Priorities

- Backend runtime and auth take priority over frontend polish.
- Uploads, analytics, branch ops, RLS, and hero quality each have their own domain skill. Use the narrowest one that fits.
- Validate every step before continuing.

## High-Signal References

- Repo instructions: [AGENTS.md](../../AGENTS.md)
- Repo skills overview: [README.md](../../.agents/skills/README.md)
- Frontend scripts: [package.json](../../package.json)
- Backend scripts: [backend/package.json](../../backend/package.json)
