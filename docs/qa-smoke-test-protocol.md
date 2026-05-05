# Production Smoke QA Protocol

## Purpose

This protocol verifies that the live Ubhona MVP remains usable after deployment without expanding product scope. It is designed to catch production regressions in auth, onboarding, ordering, uploads, and core dashboard rendering.

## Stop Rule

Stop immediately if a critical failure appears in:

- Auth
- Onboarding
- Ordering flow

When the stop rule triggers, record the blocker with evidence and define one next atomic task. Do not continue testing unrelated areas until the blocker is resolved.

## Required Checks

### Homepage

- Loads the latest frontend bundle.
- Shows a recognizable Ubhona, restaurant, menu, or AR signal.
- Has no blank page or severe runtime crash.

### Auth

- Signup/login use the real backend, not mock/local fallback.
- JWT/session persists after page navigation.
- Auth errors are visible and truthful.

### Onboarding

- Restaurant setup completes.
- First menu item can be added.
- QR/storefront link is generated.
- User reaches the dashboard.

### Uploads

- Thumbnail upload works through the API provider.
- Model upload works if enabled for the test account/environment.
- Upload failures show a truthful backend/API error.

### Dashboard Pages

Verify the following pages render without runtime crashes:

- Overview
- Menu
- Orders
- Kitchen
- Payments
- Settings

## Evidence Required For Every Fail

Every failed or blocked smoke item must include:

- Screenshot
- Console error
- Network request URL/status
- Reproduction steps
- Expected result
- Actual result

## Next Atomic Task Format

Use this exact shape for the next task after a failure:

```text
Title:
Problem:
Reproduction:
Expected:
Actual:
Suspected layer:
Files likely involved:
Acceptance criteria:
```

## Pass Criteria

A production smoke run passes only when all required checks have concrete evidence and no stop-rule blocker is present.
