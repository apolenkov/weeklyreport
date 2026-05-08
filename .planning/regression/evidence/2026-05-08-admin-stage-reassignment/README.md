# 2026-05-08 Admin Stage Reassignment Regression

## Scope

User-reported bug:

```text
/admin?tab=products
Product: DevOps-инструменты
Stage: Testing
Action: change assignee Igor -> Maria
Expected: same product/stage slot updates to Maria
Observed: UI did not update; likely duplicate StageAssignment row
```

## Automated Scenario Added

```text
apps/web/e2e/regression/admin-stage-reassignment.spec.ts

[login head]
  --> [wipeAndReseed manual-uat]
  --> [open admin products]
  --> [expand DevOps-инструменты]
  --> [set Testing = Игорь]
  --> [set Testing = Мария]
  --> [reload]
  --> [assert Testing still = Мария]
  --> [open Action Log]
  --> [assert admin.saveStageAssignment success]
```

## Code-Level Regression Run

```text
rtk proxy pnpm --filter @customreport/api test --
  src/modules/admin/admin.service.test.ts
  src/modules/admin/stage-assignment.integration.test.ts
  src/infrastructure/trpc/mutation-audit.test.ts

Result: PASS
Test Files: 57 passed
Tests: 658 passed
```

```text
rtk proxy pnpm exec prisma validate
Result: PASS
```

```text
rtk proxy pnpm --filter @customreport/web lint
Result: PASS
```

## Live Browser Run

```text
rtk proxy pnpm --filter @customreport/web exec playwright test
  --config=playwright.regression.config.ts
  admin-stage-reassignment.spec.ts

Result: PASS
1 test passed
Duration: 4.3s
```

Earlier sandbox-only Chromium failures were superseded after full runtime
access was granted. The current live-stack regression passes.

```text
DB verification after the passing run:
StageAssignment rows for DevOps-инструменты / Testing: 1
Assignee: Мария К.

Action Log verification:
procedure: admin.saveStageAssignment
status: success
targetId: a0000000-0000-4000-8000-000000000207
```

## Fix Contract

```text
StageAssignment uniqueness:
old: (userId, stageId, projectId)
new: (stageId, projectId)

saveStageAssignment:
if row exists for (stageId, projectId) -> update userId
else -> create row
```

## Rerun

```text
pnpm --filter @customreport/web exec playwright test \
  --config=playwright.regression.config.ts \
  admin-stage-reassignment.spec.ts
```
