---
phase: 44
plan: 44-03
subsystem: reminders
tags: [UFB-036, NOTIF-06, reminders, policy-applicator]
requires:
  - 44-01 (ReminderPolicy schema + nullable FK)
  - 44-02 (admin.savePolicy/listPolicies/removePolicy tRPC)
  - 44-extension (validFrom/validUntil added to ReminderPolicy)
provides:
  - PolicyApplicatorService.applyToPeriod
  - prisma/backfill-policy-rules.ts (one-shot)
  - uq_rule_report_policy unique index
affects:
  - apps/api/src/modules/admin/admin.prisma-repository.ts (post-create hook)
  - apps/api/src/modules/admin/admin.module.ts (DI)
tech-stack:
  added: [luxon@^3.7.2, @types/luxon@^3.7.1]
  patterns: [post-commit hook, idempotent upsert, validity-window gate]
key-files:
  created:
    - apps/api/src/modules/reminders/policy-applicator.service.ts
    - apps/api/src/modules/reminders/policy-applicator.test.ts
    - prisma/migrations/20260510183000_uq_rule_report_policy/migration.sql
    - prisma/backfill-policy-rules.ts
  modified:
    - prisma/schema.prisma
    - apps/api/src/modules/admin/admin.prisma-repository.ts
    - apps/api/src/modules/admin/admin.module.ts
    - apps/api/package.json
    - package.json
decisions:
  - Validity gate centralized as a static method; same boolean used by live applicator and backfill script.
  - Applicator is wired into AdminPrismaRepository (constructor) instead of AdminService — Period.create lives in the repo, the post-commit hook lives next to it.
  - Backfill targets only `periodStatus != 'published'` periods; published periods are historical and we don't spam late reminders.
  - Applicator is the OPTIONAL constructor dep in AdminPrismaRepository so existing tests instantiate the repo without DI surgery.
metrics:
  duration: ~25min
  completed: 2026-05-10T18:36Z
---

# Phase 44 Plan 03: Period.create hook + backfill cron Summary

**One-liner:** PolicyApplicator materializes one ReminderRule per active ReminderPolicy whose validity window covers `period.deadline`, wired into `admin.savePeriod` post-commit and exposed as a re-runnable backfill script.

## Files Changed

| File                                                                   | Change                                                                   | Reason                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `prisma/schema.prisma`                                                 | `@@unique([reportId, policyId], map: "uq_rule_report_policy")`           | Idempotent upsert key                     |
| `prisma/migrations/20260510183000_uq_rule_report_policy/migration.sql` | NEW: `CREATE UNIQUE INDEX`                                               | Backing index                             |
| `apps/api/src/modules/reminders/policy-applicator.service.ts`          | NEW: `PolicyApplicatorService`                                           | Core seam                                 |
| `apps/api/src/modules/reminders/policy-applicator.test.ts`             | NEW: 13 unit tests                                                       | Validity gate + DST math + orchestration  |
| `apps/api/src/modules/admin/admin.prisma-repository.ts`                | Inject applicator; collect newly-created periods; call after upsert loop | Post-commit hook                          |
| `apps/api/src/modules/admin/admin.module.ts`                           | Provide `PolicyApplicatorService`                                        | DI                                        |
| `apps/api/package.json`                                                | `+luxon ^3.7.2`, `+@types/luxon ^3.7.1`                                  | DST-correct fireAt math                   |
| `prisma/backfill-policy-rules.ts`                                      | NEW: one-shot script                                                     | Cover open periods that pre-date the hook |
| `package.json`                                                         | `+db:backfill:reminder-policies` script                                  | Operator entry point                      |

## Applicator Algorithm

```
applyToPeriod(period):
  policies = prisma.reminderPolicy.findMany(where active=true)
  for policy in policies:
    if not policyAppliesTo(policy, period): skipped++; continue
    fireAt = computeFireAt(period.deadline, policy.offsetMinutes, policy.timezone)
    upsert ReminderRule on (reportId, policyId):
      create -> created++
      update -> updated++
    catch P2002 -> log + skipped++  (concurrent race on the same key)
  return { created, updated, skipped }
```

`computeFireAt` uses Luxon: `DateTime.fromJSDate(deadline, {zone: 'utc'}).setZone(tz).plus({minutes: offsetMinutes}).toUTC().toJSDate()`. Tested for Europe/Moscow (no DST) and America/New_York (DST forward boundary).

## Validity-Gate Examples

| Scenario                          | `policy.active` | `policy.validFrom` | `policy.validUntil` | `period.deadline` | Result                                    |
| --------------------------------- | --------------- | ------------------ | ------------------- | ----------------- | ----------------------------------------- |
| In-window forever-policy          | true            | 2026-01-01         | null                | 2030-01-01        | rule created                              |
| In-window bounded                 | true            | 2026-05-01         | 2026-08-01          | 2026-06-15        | rule created                              |
| Boundary: deadline === validFrom  | true            | 2026-05-01         | 2026-08-01          | 2026-05-01        | rule created (inclusive)                  |
| Boundary: deadline === validUntil | true            | 2026-05-01         | 2026-08-01          | 2026-08-01        | rule created (inclusive)                  |
| Before validFrom                  | true            | 2026-05-01         | 2026-08-01          | 2026-04-15        | skipped                                   |
| After validUntil                  | true            | 2026-05-01         | 2026-08-01          | 2026-09-15        | skipped                                   |
| Inactive policy                   | false           | 2026-05-01         | null                | 2026-06-15        | skipped (filtered by `WHERE active=true`) |
| Paused (active=false)             | false           | 2026-05-01         | null                | 2026-06-15        | skipped                                   |

## Test Counts

- Plan-specific: **13 new tests** in `policy-applicator.test.ts` (validity gate × 7, DST math × 2, orchestration × 4)
- Full api unit suite: **695 / 695 passed** (was 678 pre-44-03)
- ESLint clean, `tsc --noEmit` clean

## Backfill Smoke

Ran twice against dev DB after seeding a temp policy:

```
[backfill] active policies=1 open periods=1
[backfill] done created=1 updated=0 skipped=0
[backfill] active policies=1 open periods=1
[backfill] done created=0 updated=1 skipped=0   ← idempotent: no duplicates
```

Database verified: 1 ReminderRule for `(reportId=a0...001, policyId=test-policy-001)`, `fireAt = deadline − 1440 min`. Test policy + rule deleted after smoke.

## Docker Post-Conditions

1. Migration applied via `prisma migrate deploy` in `customreport-api-1`.
2. Prisma client regenerated in container + on host.
3. `pnpm install` rerun in container after copying updated `package.json` + `pnpm-lock.yaml` so `luxon` was symlinked.
4. `docker compose restart api` → `curl http://localhost:3002/health/live` returned `{"status":"ok"}`.

## Deviations from Plan

### Plan-as-written did not mention validFrom/validUntil

Scope was extended after the plan was written (commit 2fa84ec added the validity window). Implementation adds the gate as a centralized static method `PolicyApplicatorService.policyAppliesTo`, used identically by the live applicator and the backfill script. **Tracked as: scope-aligned, not a deviation per Rule 1-3.**

### Wiring lives in repo, not service

Plan suggested `PeriodService.create(...)` but the codebase has no such method — `PeriodService` only handles publish/reopen. The actual `Report` (= Period) creation happens inside `AdminPrismaRepository.saveSnapshot` via `prisma.report.create`. Hooked the applicator at that exact site, post-commit-loop. **Rule 3 — fix blocking ambiguity in the plan; documented here.**

### Luxon was already transitive (via `cron`/`cron-parser`)

Added it as a direct dep anyway for a stable contract — we don't want a future cron upgrade to silently drop our DST math.

### Applicator is OPTIONAL constructor param

`AdminPrismaRepository` constructor takes `policyApplicator?: PolicyApplicatorService` so existing unit tests that `new AdminPrismaRepository(prismaStub)` keep compiling without DI surgery. NestJS DI provides the real one in production.

## Self-Check: PASSED

- `policy-applicator.service.ts` exists ✓
- `policy-applicator.test.ts` exists ✓
- `prisma/migrations/20260510183000_uq_rule_report_policy/migration.sql` exists ✓
- `prisma/backfill-policy-rules.ts` exists ✓
- migration applied in dev DB ✓
- 695/695 api unit tests pass ✓
- API container healthy after restart ✓
- `apps/api/src/modules/reminders/reminders.scheduler.ts` UNTOUCHED ✓
