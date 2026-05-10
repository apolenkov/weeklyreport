# Phase 44 Plan 01: ReminderPolicy schema + backfill — Summary

**Status:** done
**Requirement:** UFB-036 (Reminder Policy model)
**Migration:** `20260510165002_reminder_policies`

## What changed

| File                                                               | Change                                                                                                    |    Lines |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------: |
| `prisma/schema.prisma`                                             | Added `model ReminderPolicy`, `enum ReminderAudience`, `policyId` FK + relation + index on `ReminderRule` |      +28 |
| `prisma/migrations/20260510165002_reminder_policies/migration.sql` | Generated DDL + hand-edited backfill block                                                                | 66 (new) |

No source code changes — schema-only plan, as the plan's "Out of Scope" section requires.
`reminders.scheduler.ts` untouched.

## Migration shape

```
[CreateEnum ReminderAudience] → [AlterTable ReminderRule + policyId]
                                      │
                                      ▼
[CreateTable ReminderPolicy] → [Index policy.kind+active, policy.active, rule.policyId]
                                      │
                                      ▼
[AddForeignKey rule.policyId → policy.id  ON DELETE SET NULL]
                                      │
                                      ▼
[Backfill INSERT DISTINCT (kind, offsetMin, tz) → ReminderPolicy]
                                      │
                                      ▼
[UPDATE rule.policyId by tuple match]
```

## Backfill verification

Verified by running the exact backfill block manually against the post-`db:reset:hard`
seeded DB (the migration itself runs before `seed-simple` so the prod path executes
on whatever rules already exist — at install time the table is empty, which is the
correct no-op outcome):

| metric            | value                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| seeded rules      | 2 (1 deadline + 1 escalation, same Report)                                                                 |
| derived policies  | 2                                                                                                          |
| orphan rules left | 0                                                                                                          |
| derived tuples    | `(deadline, 0min, Europe/Moscow, LEAD_WITH_DRAFT)` and `(escalation, 120min, Europe/Moscow, HEAD_OF_LATE)` |

So at the seed scale the dedup is 1:1; the dedup behavior is exercised whenever
two rules share `(kind, offset, tz)` against different reports.

## Test counts

| Suite                                  | Before | After |
| -------------------------------------- | -----: | ----: |
| Unit (`pnpm test -- reminders` filter) |    678 |   678 |
| Integration (reminders+all)            |     58 |    58 |

All green. Reminders scheduler / service / repo / contract / dedupe-key suites
unchanged behavior.

## Deviations from plan

### Rule 3 (blocking-issue auto-fix) — backfill SQL adapted to actual schema

The plan's backfill SQL references a `ReportPeriod` table joined as
`JOIN "ReportPeriod" rp ON rp.id = rep."periodId"` and uses `rp.deadline`
as the deadline anchor. The current schema has **no `ReportPeriod` model**:
`Report` itself owns the `deadline` column directly (each `Report` row
_is_ the period). So the plan SQL would fail at migration time with
`relation "ReportPeriod" does not exist`.

**Adaptation:** the backfill joins only `"Report"` and reads `rep.deadline`.
Functionally identical — the period deadline is the same instant — only the
join shape changes. Cast `ROUND(...)` to `INTEGER` so it matches the
`offsetMinutes Int` column type (Postgres `ROUND(double precision)`
returns `double precision`, which would mismatch the column).

### Test-DB migration drift (out-of-scope deviation, fixed)

When running the integration suite the first time, every test failed with
`column "ReportingGroup.headUserId" does not exist`. The
`customreport_test` DB lagged two migrations behind `customreport`
(UFB-039 + this plan). Ran `prisma migrate deploy` against the test DB to
catch it up; not a code change, just operator hygiene. Logging it here so
the next agent sees the cause.

## Self-Check: PASSED

- `prisma/schema.prisma` — declares `ReminderPolicy`, adds `policyId` FK + relation + `@@index([policyId])` ✓
- `prisma/migrations/20260510165002_reminder_policies/migration.sql` — exists, contains DDL + backfill ✓
- `prisma migrate dev` applied cleanly against `customreport` ✓
- `prisma generate` — clean, no codegen drift ✓
- Backfill verified manually: 2 rules → 2 policies, 0 orphans ✓
- `pnpm --filter @customreport/api test -- reminders` — 678/678 pass ✓
- `pnpm --filter @customreport/api test:integration -- reminders` — 58/58 pass ✓
- `prisma format` + `prisma validate` — clean ✓
- `reminders.scheduler.ts` — untouched ✓
