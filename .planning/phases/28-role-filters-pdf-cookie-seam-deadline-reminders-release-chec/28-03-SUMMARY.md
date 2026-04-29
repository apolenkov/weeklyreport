---
phase: 28-role-filters-pdf-cookie-seam-deadline-reminders-release-chec
plan: 03
type: summary
status: complete
requirements: [NOTIF-01, NOTIF-03, NOTIF-04]
commit: f33bb6608aaa801daac0b7c21902d2406f9c9ba9
---

# 28-03 SUMMARY — T-24h deadline reminders (NOTIF-01/03/04)

## File-by-file

| File | Created / Modified | Note |
| --- | --- | --- |
| `apps/api/src/modules/email/templates/deadline.template.tsx` | created | react-email + `<Tailwind>` component + plaintext fallback function |
| `apps/api/src/modules/email/render-template.ts` | created | central renderer; switches on discriminated union `EmailKind` |
| `apps/api/src/modules/email/render-template.test.ts` | created | 4 unit tests covering html/text/subject |
| `apps/api/src/modules/reminders/reminders.scheduler.ts` | created | `@Cron(EVERY_HOUR)` dispatcher + `runOnce(now)` testable seam |
| `apps/api/src/modules/reminders/reminders.scheduler.test.ts` | created | 5 unit tests including "exactly one email per cycle" |
| `apps/api/src/modules/reminders/reminders.module.ts` | modified | registers `RemindersScheduler` provider |
| `apps/api/src/modules/reminders/reminders.service.ts` | modified | `requestReminderExecution(ruleId, email, payload?)` overload; new dedupe-key path for kind='deadline' |
| `apps/api/src/modules/reminders/reminders.service.test.ts` | modified | adds 4 tests for the deadline payload + dedupe key shape |
| `apps/api/src/modules/reminders/reminders.prisma-repository.ts` | modified | adds `findDueDeadlineRules(now)` returning `DueDeadlineRule[]` |
| `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` | modified | dispatches on `kind`; multipart send via `sendMailMultipart` |
| `apps/api/src/infrastructure/email/email.service.ts` | modified | new `sendMailMultipart(to, subject, html, text)` method |
| `apps/api/src/app.module.ts` | modified | `ScheduleModule.forRoot()` registered |
| `apps/api/tsconfig.json` | modified | enables `jsx: react-jsx` and includes `*.tsx` for the email template |
| `apps/api/package.json` | modified | new deps: `@nestjs/schedule`, `@react-email/components`, `@react-email/render`, `react` |

## Prisma `deadline` enum status

`ReminderRuleKind.deadline` was already present in `prisma/schema.prisma:218-221` — no migration required. Re-verified via `grep -nE "(enum ReminderRuleKind|kind ReminderRuleKind)"`. The Zod schema in `packages/shared/src/schemas/report.ts:196` (`adminReminderRuleKindSchema`) also already enumerates `'deadline' | 'follow_up'`. Plan Task 2 / Steps 2.2-2.3 were no-ops — no commit-time schema/migration drift.

## Final dedupe key shape

```ts
// kind='deadline' (Phase 28-03 — new path, set by scheduler):
`${rule.id}:deadline:${cycleDate}:${recipientEmail}`
//   e.g. `aaaa…:deadline:2026-04-19:lead@test.local`
// where cycleDate is the UTC YYYY-MM-DD slice of fireAt.

// Legacy (Phase 28-02 and earlier — preserved for follow-up reminders that
// don't carry a payload):
`${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`
```

The two namespaces are intentionally non-overlapping so a follow-up rule's existing executions don't collide with a deadline rule's fresh executions.

## Test count delta

- After 28-02: 422 unit tests (31 files).
- After 28-03: 435 unit tests (33 files).
- Delta: +13 tests, +2 new files.
  - +5 in `reminders.scheduler.test.ts` (idempotency + multi-recipient + cycle rollover + payload shape).
  - +4 in `reminders.service.test.ts` (deadline payload dedupe key).
  - +4 in `render-template.test.ts` (html/text/subject).

## Architecture notes

- **Raw `Worker` pattern preserved** per CONTEXT.md decision lock — no `@Processor` (NestJS 11 / @nestjs/bullmq 11 DI bug). The processor's `processJob` switches on `'kind' in data` so the legacy and deadline paths coexist without breaking either.
- **Scheduler exposes `runOnce(now: Date)`** as a testable seam alongside the `@Cron` decorator. Unit tests drive the scheduler with stubbed `now` values; the production code path uses `new Date()`.
- **`reportPeriodLabel`** computed at the repository layer — `${start} → ${end}` UTC slices. Avoids leaking timezone choices into the template / scheduler.
- **`sectionUrl`** built from `process.env['APP_BASE_URL']` (defaults to `http://localhost:3000`). Phase 30/31 ops can override per environment.
- **`@react-email/render`** v4 exposes `render` (not `renderAsync`); the plan referenced the older API. Used `render` per current package.

## Verification gates run

- `pnpm --filter @customreport/api typecheck` — exit 0.
- `pnpm --filter @customreport/web typecheck` — exit 0.
- `pnpm --filter @customreport/api test` — 435/435 passed.
- `pnpm --filter @customreport/api test src/infrastructure/bullmq/email-reminder.processor.test.ts` — 3/3 passed.
