# Context7 Setup

This repo supports Context7 as an optional documentation source for version-sensitive coding work.

Use Context7 when you need:

- current library or framework API docs
- setup or configuration guidance for tools used in this repo
- version-aware code generation for React, Vite, Tailwind, Prisma, Supabase, Radix, or similar dependencies
- a fast check before changing code that depends on external package behavior

Do not use Context7 as a substitute for repo-local instructions. In Ubhona, local guidance still comes first:

- [AGENTS.md](../AGENTS.md)
- [.github/ubhona-builder-kit/README.md](../.github/ubhona-builder-kit/README.md)
- repo-scoped skills under [.agents/skills](../.agents/skills)

## Recommended Setup

Context7's current official setup path is via the `ctx7` CLI.

For project-local MCP setup:

```bash
npx ctx7@latest setup --project --mcp
```

For project-local CLI + skills setup instead of MCP:

```bash
npx ctx7@latest setup --project --cli --universal
```

Notes:

- `--project` keeps setup local to this repo instead of changing your global agent configuration.
- MCP mode is the preferred option when your coding agent supports MCP well.
- CLI + skills mode is a fallback when MCP is unavailable or you want a lower-friction setup.
- `ctx7 setup` is interactive. Add `--yes` only if you already know the target mode and install location.

## Generated Files

Project-local Context7 setup may generate one of these files depending on the client and mode:

- `.mcp.json`
- `.cursor/mcp.json`
- `.opencode.json`

These are ignored by this repo on purpose because they may contain machine-specific paths, local client settings, or API-key-based configuration.

Do not commit generated Context7 config directly unless you first replace secrets and intentionally decide to maintain a shared project config surface.

## How To Use Context7 In Ubhona

Use Context7 early when working on external-library behavior, especially for:

- React 19 patterns and hooks
- Vite configuration and dev-server behavior
- Tailwind usage and styling conventions
- Prisma schema, client, and migration questions
- Supabase client/runtime behavior
- Radix, shadcn, or lucide integration details

Good prompt patterns:

- `Use Context7 to verify the current React 19 guidance for this hook before editing.`
- `Use Context7 to check the latest Vite config behavior for dev server CORS and host binding.`
- `Use Context7 for Prisma docs before changing this query or schema contract.`
- `Use Context7 to confirm the current Supabase client API before implementing this flow.`

## Repo Workflow Guidance

In this repo, Context7 should be used to reduce outdated API assumptions, not to override repo constraints.

Expected order:

1. Read repo-local instructions and affected code first.
2. Use Context7 for version-sensitive external docs.
3. Apply the smallest repo-consistent change.
4. Validate with runtime or build evidence.

## Assumptions

This guidance assumes:

- Node.js 18+ is available locally
- the coding agent supports either MCP or repo/project skill discovery
- future contributors will prefer project-local setup over global config drift

If Context7 changes its setup flow later, update this file using the current official Context7 docs before changing the repo surface further.
