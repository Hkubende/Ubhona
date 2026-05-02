---
name: ubhona-fix-analytics
description: Work on Ubhona analytics issues in event capture, dashboard metrics, aggregation logic, filters, attribution, reporting correctness, and automation signals derived from analytics. Use when the blocker is clearly in analytics collection, transformation, or presentation. Do not use for auth, hero UI polish, upload pipelines, or generic backend runtime issues.
---

# Ubhona Fix Analytics

- Stay inside analytics capture, aggregation, filtering, metric computation, reporting, and analytics-driven automation signals.
- Separate the failing layer clearly: event source, transport, persistence, aggregation, query logic, or dashboard rendering.
- Verify metric correctness before changing presentation.
- Treat auth, runtime, and uploads as upstream blockers only when they directly prevent analytics from functioning.
- Do not drift into generic dashboard polish unless the bug is in analytics presentation.
- Do not refactor unrelated backend systems.
- Prefer the smallest fix that restores one broken metric path or reporting flow.

Use this output shape:

1. analytics failing layer
2. evidence
3. files to change
4. smallest analytics fix
