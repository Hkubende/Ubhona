# MCPs

These are the active MCP servers currently useful in the Ubhona build workflow.

## Enabled MCP Servers

- `chrome-devtools`
  - Browser inspection, console errors, network failures, UI/runtime verification.
- `shadcn`
  - Component lookup and UI reference material.
- `figma`
  - Design context, design system search, code connect, direct Figma workflows.

## Optional Repo-Safe MCP Additions

- `context7`
  - Current library and framework documentation for version-sensitive coding tasks.
  - Recommended as a project-local setup rather than a committed shared MCP config.
  - Setup guidance: [docs/context7.md](../../docs/context7.md)

## Suggested Use in Ubhona

- `chrome-devtools`
  - Validate storefront, dashboard, auth, uploads, checkout, and backend-connected UI flows.
- `shadcn`
  - Find base component patterns when extending admin or dashboard UI.
- `figma`
  - Sync design context, inspect design system assets, or implement design-to-code changes.
- `context7`
  - Verify current external docs before editing code that depends on framework or library behavior.

## Notes

- The MCP inventory is environment-dependent. This file documents the currently enabled set seen from the workspace.
- Repo skills remain the first layer for workflow control. MCPs support investigation, design, and UI verification.
- Context7 is documented for this repo but intentionally not committed as an active MCP config because generated setup files can be machine-specific.
