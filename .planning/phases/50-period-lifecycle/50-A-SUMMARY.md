# Phase 50-A — Defaults consumers wiring — SUMMARY

**Status:** complete
**Closed:** 2026-05-11
**Plan:** `50-A-PLAN.md`

## What shipped

Two atomic commits wire all three AppSettings fields into real consumer code paths:

| Commit    | Field(s) wired                            | Consumer site                                                                                                                                                                                           |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `91b504e` | `periodLengthDays`, `defaultDeadlineDays` | `ensureWeeklyReport` in `apps/api/src/modules/auth/auth.routes.ts` — `getCurrentWeekBounds` now takes optional `periodLengthDays`, deadline computed as `periodStart + defaultDeadlineDays`             |
| `6e588a2` | `notificationFromEmail`                   | `EmailReminderProcessor` reads `AppSettings.notificationFromEmail` once per job, forwards as `from` arg to `EmailService.sendMail{,Multipart}`; null falls back to constructor-resolved `SMTP_FROM` env |

## Acceptance Criteria — verification

- [x] `defaultDeadlineDays` consumer: hardcoded `+ 4 days` replaced with `settings.defaultDeadlineDays` in `ensureWeeklyReport`
- [x] `periodLengthDays` consumer: `periodEnd = periodStart + (settings.periodLengthDays - 1)` (Mon-anchored)
- [x] `notificationFromEmail` consumer: BullMQ email-reminder processor reads from settings, falls back to env
- [x] Existing Periods are NOT retroactively recomputed (verified via test fixtures)
- [x] Test fixtures updated where they previously asserted hardcoded deadlines
- [x] All existing tests stay green

## Tests

```
apps/api  vitest run  → 771 passed (was 730 — +41 from new test files)
apps/web  vitest run  → 318 passed
tsc --noEmit          → exit 0
```

New test files:

- `apps/api/src/infrastructure/bullmq/email-reminder.processor.test.ts` (+75 lines)
- `apps/api/src/modules/auth/auth.routes.test.ts` (+35 lines)

## Modified files

- `apps/api/src/modules/auth/auth.routes.ts` (+53 lines)
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` (+25 lines)
- `apps/api/src/infrastructure/email/email.service.ts` (+26 lines)

## Deviations from plan

- Plan step 4 expected Luxon-based deadline arithmetic with `defaultTimezone` and a hardcoded 18:00 hour. The shipped code uses simpler day-add for now — the Luxon timezone-aware deadline path is owned by `business-date.computeDeadline` from 50-C, and 50-B will adopt it for the cron auto-publisher path. No semantic loss for 50-A's acceptance criteria; full Luxon adoption deferred to 50-B + 51-A.

## Next

`50-B` (cron consumers) is now unblocked — it can read both `business-date.ts` (from 50-C, commit `4f69443`) and the wired settings (from 50-A).

## Closer

```
+--- 50-A status ----+
│ shipped  YES       │
│ commits  91b504e   │
│          6e588a2   │
│ tests    771 / 318 │
│ tsc      0         │
│ next     50-B      │
+--------------------+
```
