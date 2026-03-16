# MenuVista Project Status

Last Updated: 2026-03-15  
Branch: `checkpoint/2026-03-15-platform`

## Current State
- Multi-tenant platform foundation is active across backend + frontend.
- Role-based access control is DB-backed (`platform_admin`, `restaurant_owner`, `restaurant_manager`, `staff`).
- Subscription and plan-gating foundation is implemented (`starter`, `pro`, `enterprise`).
- Admin control panel exists with restaurants, billing, support, and platform tracking views.
- Audit logging exists for sensitive admin actions:
  - suspend restaurant
  - reactivate restaurant
- Critical protection tests exist and pass:
  - admin authorization
  - plan gating

## Completed Milestones
1. Platform auth, onboarding, protected dashboard, menu manager.
2. Storefront by slug (`/r/:slug/*`) with restaurant-specific data.
3. Order flow + payment/STK integration foundation.
4. Subscription metadata + gating + pricing page.
5. Admin routes + admin APIs + role protection.
6. Audit log model + instrumentation for sensitive admin status actions.
7. Backend tests for high-risk protections.

## Latest Checkpoint Commits
1. `6d63e54` feat(backend): add platform API core with RBAC, subscriptions, admin and audit logging
2. `ac16588` feat(frontend): add platform routes, storefront/admin flows, and shared client libs
3. `5f29a86` test(backend): cover admin authorization and subscription plan gating
4. `d6d0bf2` chore(repo): harden ignore rules for env and test artifacts

## Quality / Safety
- Backend TypeScript: passing
- Frontend TypeScript: passing
- Backend test suite: passing (`9` tests)
- Working tree: clean at checkpoint

## Immediate Next Priorities
1. Add admin audit log viewer page (`/admin/audit`).
2. Expand tests for audit log writes + query endpoint.
3. Finalize migration/deploy runbook usage per environment.
4. Add CI checks for backend tests + type checks on PR.

## Update Protocol (Keep This File Current)
- Update `Last Updated` on every meaningful progress step.
- Append major completed work under **Completed Milestones**.
- Replace **Latest Checkpoint Commits** with newest stable checkpoint set.
- Keep this file one-page and decision-focused (no long logs).
