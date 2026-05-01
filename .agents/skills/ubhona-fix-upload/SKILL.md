---
name: ubhona-fix-upload
description: Work on Ubhona upload issues in the frontend upload request, backend upload routes, file validation, Supabase Storage write, returned URL, and dish form state integration. Use when the blocker is clearly in the upload path. Do not use for hero visuals, unrelated DB model work, or unrelated auth refactors.
---

# Ubhona Fix Upload

- Stay inside the upload path only.
- Check layers in order: browser request, auth dependency, backend route, validation, storage write, returned URL, dish state integration.
- If auth blocks the upload, state that explicitly and stop at auth.
- If backend runtime blocks the upload, state that explicitly and stop at runtime.
- Do not touch hero visuals.
- Do not change unrelated DB models.
- Do not perform unrelated auth refactors.
- Prefer the smallest fix that makes one upload path pass end-to-end.

Use this output shape:

1. upload failing layer
2. evidence
3. files to change
4. smallest upload fix
