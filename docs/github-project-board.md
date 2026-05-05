# GitHub Project Board

## Board

Create a GitHub Project named **Ubhona Production Pipeline**.

## Views

- **Production Smoke**: QA smoke reports, production blockers, and deploy validation.
- **MVP Execution**: MVP tasks grouped by area and priority.
- **Blockers**: Critical failures that require evidence and one atomic next task.

## Columns / Statuses

- Backlog
- Ready
- In Progress
- Blocked
- QA
- Done

## Custom Fields

- **Status**: Backlog, Ready, In Progress, Blocked, QA, Done.
- **Priority**: P0 Critical, P1 High, P2 Medium, P3 Low.
- **Area**: Auth, Onboarding, Orders, Uploads, Dashboard, Admin, Infra, QA.
- **Environment**: Local, Preview, Production.
- **Smoke Result**: PASS, FAIL, BLOCKED, Not Run.

## Recommended Labels

- `qa:smoke`
- `blocker`
- `mvp`
- `auth`
- `onboarding`
- `orders`
- `uploads`
- `dashboard`
- `admin`
- `infra`
- `production`
- `needs-evidence`

## Automation Rules

- New issue with `blocker` -> Ready.
- New issue with `qa:smoke` -> Ready.
- PR opened -> QA.
- PR merged -> Done.
- Issue closed -> Done.

## Operating Rule

Keep each issue tied to one bounded outcome. If smoke QA finds a critical Auth, Onboarding, or Orders failure, stop testing and create one blocker issue with evidence and the next atomic task.
