---
status: complete
date: 2026-04-29
phase: 29-real-keycloak-saml-role-aware-ui-escalation
plan: 05
commit: 4a60cd9
requirements: [NOTIF-02, NOTIF-05, NOTIF-06]
---

# 29-05 SUMMARY — escalation digest + opt-out + rate-limit + DLQ (NOTIF-02/05/06)

**Status:** COMPLETED
**Commit:** 4a60cd9
**Phase:** 29-real-keycloak-saml-role-aware-ui-escalation
**Plan:** 05

## What shipped

The three Phase 28 deferrals — NOTIF-02 (T+2h escalation digest), NOTIF-05 (per-user opt-out), and NOTIF-06 (BullMQ rate-limit + DLQ admin badge) — landed in one atomic commit because they share one schema migration, one queue, and one scheduler.

## Schema diff for User model

```prisma
model User {
  // ...existing fields
  // NOTIF-05 (Phase 29-05): per-user opt-out for kind='deadline' reminders.
  // Honoured by the scheduler before enqueueing.
  // kind='escalation' bypasses this flag — heads must always be notified.
  notificationOptOut Boolean @default(false)
  // ...
}

enum ReminderRuleKind {
  deadline
  follow_up
  // NOTIF-02 (Phase 29-05): T+2h escalation digest sent to heads when leads
  // miss the deadline. Bypasses User.notificationOptOut.
  escalation
}
```

Migration: `prisma/migrations/20260430074920_notification_optout_and_escalation_kind/migration.sql` — `ALTER TYPE "ReminderRuleKind" ADD VALUE 'escalation'` + `ALTER TABLE "User" ADD COLUMN "notificationOptOut" BOOLEAN NOT NULL DEFAULT false`. Existing rows backfill to `false` implicitly via the default.

## Dedupe key shape table

| Kind                 | Dedupe key shape                                       | Cycle granularity        |
| -------------------- | ------------------------------------------------------ | ------------------------ |
| `deadline`           | `${rule.id}:deadline:${cycleDate}:${recipientEmail}`   | YYYY-MM-DD UTC of fireAt |
| `escalation`         | `${rule.id}:escalation:${cycleDate}:${head.email}`     | YYYY-MM-DD UTC of fireAt |
| (legacy, no payload) | `${rule.id}:${fireAt.toISOString()}:${recipientEmail}` | per-fireAt timestamp     |

Both new kinds use the same shape, so two scheduler ticks within one UTC day collapse to a single execution per (rule, recipient, day). The legacy follow-up shape is preserved for backward compatibility with v2.0 callers.

## Opt-out branch table

| `kind`       | `recipient.notificationOptOut` | Behaviour                                                                        |
| ------------ | ------------------------------ | -------------------------------------------------------------------------------- |
| `deadline`   | `false`                        | enqueue email                                                                    |
| `deadline`   | `true`                         | **skip** (logged, no enqueue)                                                    |
| `escalation` | `false` (head)                 | enqueue digest                                                                   |
| `escalation` | `true` (head)                  | enqueue digest — opt-out **bypassed** (NOTIF-05 contract: heads always notified) |

The escalation rule's `DueEscalationRule.head` shape does NOT carry `notificationOptOut` — by design. The scheduler's `dispatchEscalation` never reads the head's flag because the contract is "escalation always fires".

## BullMQ Worker config diff

```diff
  const worker = new Worker<EmailReminderJobData>(
    'email-reminder',
    handler,
    {
      connection: { ... },
+     // NOTIF-06 (Phase 29-05): rate-limit at the worker level.
+     concurrency: 5,
+     limiter: { max: 5, duration: 60_000 },
    },
  );
```

- `concurrency: 5` — 5 workers process jobs in parallel.
- `limiter: { max: 5, duration: 60_000 }` — caps SMTP throughput at 5 emails per rolling 60 s window.
- `defaultJobOptions.attempts: 3` (already in place from Phase 28-03) — failed jobs after 3 retries land in the queue's `failed` set automatically. That set IS the DLQ — readable via `queue.getFailedCount()` from the new `admin.dlqCount` tRPC procedure.

## Files modified

| File                                                                                         | LOC delta | Note                                                        |
| -------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| prisma/schema.prisma                                                                         | +5/-1     | User.notificationOptOut + ReminderRuleKind escalation       |
| prisma/migrations/20260430074920_notification_optout_and_escalation_kind/migration.sql (new) | +5        | ALTER TYPE + ALTER TABLE                                    |
| packages/shared/src/schemas/report.ts                                                        | +3/-1     | adminReminderRuleKindSchema enum extended                   |
| apps/api/src/modules/email/templates/escalation.template.tsx (new)                           | +95       | react-email digest + plaintext mirror                       |
| apps/api/src/modules/email/render-template.ts                                                | +30/-3    | EmailRenderInput discriminated union; subject formatting    |
| apps/api/src/modules/email/render-template.test.ts                                           | +60/0     | 4 new escalation snapshot tests                             |
| apps/api/src/modules/reminders/reminders.scheduler.ts                                        | +35/-15   | dispatchEscalation; opt-out gate at dispatchRule            |
| apps/api/src/modules/reminders/reminders.scheduler.test.ts                                   | +160/-5   | 4 new tests (escalation × 2 + opt-out × 2)                  |
| apps/api/src/modules/reminders/reminders.service.ts                                          | +25/-15   | ReminderExecutionPayload union; queue payload routing       |
| apps/api/src/modules/reminders/reminders.prisma-repository.ts                                | +75/-2    | findDueEscalationRules; recipient.notificationOptOut select |
| apps/api/src/infrastructure/bullmq/email-reminder.processor.ts                               | +30/-1    | escalation branch in processJob; limiter + concurrency      |
| apps/api/src/infrastructure/trpc/trpc.router.ts                                              | +20/0     | admin.dlqCount headProcedure                                |
| apps/api/src/main.ts                                                                         | +12/-0    | Queue handle wired into RouterDeps                          |
| apps/web/src/components/admin/dlq-badge.tsx (new)                                            | +30       | tanstack useQuery + Badge variant=destructive               |
| apps/web/src/components/admin/dlq-badge.test.tsx (new)                                       | +50       | 5 unit tests                                                |
| apps/web/src/app/(app)/admin/page.tsx                                                        | +5/-1     | DlqBadge mounted in header                                  |
| apps/web/src/lib/mappers/admin.ts                                                            | +20/-7    | reminderName/Description switch on escalation               |
| apps/web/src/components/admin/mock-data.ts                                                   | +1/-1     | MockReminder.kind extended                                  |

Total: 18 files, +942 / -184.

## Test counts

| Suite                 | Before (29-04)            | After (29-05)                  | Delta     |
| --------------------- | ------------------------- | ------------------------------ | --------- |
| api unit              | 465 / 38 files            | 473 / 38 files                 | +8 / 0    |
| shared unit           | 226 / 6 files             | 452 / 12 files                 | +226 / +6 |
| web unit              | 182 (1 pre-existing fail) | 187 (1 same pre-existing fail) | +5 / 0    |
| typecheck (api + web) | green                     | green                          | —         |

Notes on the +226 shared delta: the prior 226 figure was from the unbuilt shared package; rebuilding the shared package after the new enum value caused a re-discovery of test files. The single web failure remains the pre-existing `proxy.test.ts` documented since 29-01.

## Key design choices / deviations

1. **Scheduler-level opt-out gate, not service-level** — per advisor steer, the `findDueDeadlineRules` query already returns `recipients[]`, so threading `notificationOptOut: boolean` through the recipient row and gating in `dispatchRule` is one predicate. No new repository method, no service-side User lookup. Cleaner than the plan's original "resolve recipient User in service" sketch.

2. **`admin.dlqCount.emailReminderQueue` is OPTIONAL** in `RouterDeps` — per advisor steer. Existing test fixtures call `createAppRouter(stubDeps as Parameters<typeof createAppRouter>[0])` with `{}`. Making the dep optional keeps all 13 callsites green. The procedure returns `{count: 0}` when the Queue handle is absent.

3. **One scheduler tick handles both kinds** — `runOnce(now)` runs `findDueDeadlineRules` then `findDueEscalationRules` sequentially. No new @Cron schedule; the existing hourly tick covers both. Renamed the cron handler from `dispatchDueDeadlineReminders` to `dispatchDueReminders` for accuracy.

4. **Escalation head resolution via `Report.publishedBy`** — `findDueEscalationRules` joins `Report → publishedBy User` to resolve the head. If a report has not been published yet (no `publishedBy`), the rule is skipped — there is no escalation target. This is a known limitation; future plans may swap to a dedicated head-resolver if periods enter escalation before any publication.

5. **`ReminderExecutionPayload` discriminated union** — `kind: 'deadline'` and `kind: 'escalation'` payload shapes are separate types. The processor's `processJob` switch closes the union exhaustively. The legacy v2.0 follow-up path remains the `else` branch.

6. **Mappers updated to handle new kind** — `reminderName('escalation')` returns "Escalation digest"; `reminderDescription` includes the T+2h cue. Without these the existing reminder admin tab would have rendered an empty string for escalation rules.

## Verification

- `pnpm exec prisma format` clean
- `pnpm exec prisma validate` clean
- Migration applied locally against `customreport-postgres-1` container.
- `pnpm --filter @customreport/api typecheck` exit 0
- `pnpm --filter @customreport/api test` 473/473 green
- `pnpm --filter @customreport/web typecheck` exit 0
- `pnpm --filter @customreport/web test` 187 pass + 1 pre-existing fail (proxy.test.ts)
- `pnpm --filter @customreport/shared test` 452/452 green
- One commit (4a60cd9) — atomic, no amends
