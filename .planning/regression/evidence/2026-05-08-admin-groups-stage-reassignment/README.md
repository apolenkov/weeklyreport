---
date: 2026-05-08
scope: admin-groups-stage-reassignment
status: pass
---

# Admin Groups + Stage Reassignment Evidence

## What Was Proven

```text
[seed fix] --> [live API health] --> [Playwright role=head] --> [Action Log check]
```

- `dev.wipeAndReseed` no longer fails after `StageAssignment` unique key changed to `stageId_projectId`.
- `/admin?tab=products` can replace one product/stage assignee and persists after reload.
- `/admin?tab=groups` can create a reporting group.
- `/admin?tab=users` can assign a user to that group.
- `/admin?tab=actions` records `admin.saveStageAssignment`, `admin.saveReportingGroup`, and `admin.saveUser` as `success`.

## Commands

```bash
rtk proxy pnpm exec prisma generate
rtk proxy pnpm exec prisma db seed
rtk proxy curl -sf http://localhost:3002/health/ready
rtk proxy pnpm --filter @customreport/web exec playwright test --config=playwright.regression.config.ts admin-groups.spec.ts admin-stage-reassignment.spec.ts
```

## Results

```text
Prisma seed: PASS
API /health/ready: PASS
Playwright:
  admin-groups.spec.ts: PASS
  admin-stage-reassignment.spec.ts: PASS
  total: 2 passed / 0 failed
```

Raw Playwright reporter output:

```text
.planning/regression/agent-c-test-results/results.json
.planning/regression/agent-c-test-results/.last-run.json
```

## Bug Fixed During Proof

```text
old seed key: userId_stageId_projectId
new seed key: stageId_projectId
update: userId
```

The stale seed key caused `dev.wipeAndReseed` to fail after the stage-assignment migration. The fix is in `prisma/seed.ts`.
