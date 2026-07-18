## Why

BL-11 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`: three
independent correctness defects in the reminders module, kept as one change
because they share a seam (`apps/api/src/modules/reminders/*` +
`reminders.router.ts`) and the review groups them as one backlog item.

- **(a) Stale-JWT active-report gate.** `dispatchPending`
  (`apps/api/src/infrastructure/trpc/routers/reminders.router.ts:100-106`)
  rejects a manual Remind whenever `input.reportId !== ctx.session.activeReportId`.
  `session.activeReportId` is computed once at login
  (`apps/api/src/modules/auth/user-session.ts:179`) and baked into the JWT —
  it is never re-derived per request. After a period rollover, a head with a
  perfectly legitimate report open gets `FORBIDDEN "report-not-active"` until
  they log out and back in. `WeeklyReportService.getCurrentEditableId()`
  (`apps/api/src/modules/weekly-report/weekly-report.service.ts:85,146-148`)
  already resolves the single newest editable (open/reopened, non-archived,
  `periodStart <= now`) period from the DB — the exact value this gate should
  compare against instead of the stale session claim.
- **(b) Raw UUID in reminder email.** The legacy (no-`kind`) branch of
  `buildQueuePayload` (`apps/api/src/modules/reminders/reminders-queue-payload.ts:45-49`)
  sets `reportPeriod: rule.reportId ?? ""` — the raw report UUID, not a human
  period label. `email-reminder.processor.ts`'s legacy plaintext branch
  renders it verbatim, so a manually-triggered reminder email reads "status
  report period: 550e8400-e29b-...".
- **(c) Pagination silently truncates at 100.** `listExecutions`
  (`apps/api/src/modules/reminders/reminders.prisma-repository.ts:245-261`)
  hard-caps the DB read at `take: 100`; cursor pagination is then applied
  in-memory over that fixed 100-row slice by the service layer. Once a rule
  has accumulated more than 100 executions, `nextCursor` goes `null` before
  the caller has actually seen the older rows — admin execution history
  silently stops, indistinguishable from "no more rows."

## What Changes

- **Slice A — active-report gate**: `dispatchPending` re-derives the current
  editable report id via `weeklyReportService.getCurrentEditableId()` and
  compares `input.reportId` against that DB value instead of
  `ctx.session.activeReportId`.
- **Slice B — period label in legacy payload**: the legacy branch of
  `buildQueuePayload` populates `reportPeriod` with a real period label
  (`periodStart`/`periodEnd` formatted, mirroring the label format already
  used elsewhere for period display) instead of the raw `rule.reportId`.
- **Slice C — pagination**: `listExecutions` pushes cursor pagination into
  the Prisma query itself (real DB-level `cursor`/`skip`/`take`, or an
  equivalent keyset query) so a rule's execution history is fully walkable
  past 100 rows, not silently truncated.

## Claim disposition table

| Sub-claim                                                                | Review evidence                                                                                                                         | Disposition     | Slice |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----- |
| (a) stale `activeReportId` gate rejects legitimate Remind after rollover | `reminders.router.ts:100-106` compares against session-baked value; `getCurrentEditableId` already exists as the DB-derived alternative | CONFIRMED — fix | A     |
| (b) legacy payload's `reportPeriod` is the raw report UUID               | `reminders-queue-payload.ts:45-49` sets `reportPeriod: rule.reportId ?? ""`                                                             | CONFIRMED — fix | B     |
| (c) `listExecutions` truncates cursor pagination at 100 rows             | `reminders.prisma-repository.ts:245-261` hard-caps `take: 100`, service paginates in-memory over that slice                             | CONFIRMED — fix | C     |

## Non-goals

- Not touching `listStuckQueuedExecutions` (`reminders.prisma-repository.ts:218-228`)
  — its `take: 100` is a reaper-internal batch size, not a user-facing
  pagination contract; out of scope.
- Not changing the rich (`kind`-carrying) deadline/escalation payload branch —
  only the legacy no-`kind` branch has the raw-UUID defect.
- Not reworking `admin-reminders-ui`'s "Reminders Engine Is Unchanged"
  boundary — this change only touches engine-side correctness, not the UI
  contract.
- Not adding new pagination UI — Slice C is a backend query fix; the existing
  cursor contract (`nextCursor`) shape is preserved, only its correctness
  past 100 rows changes.

## File manifest

- `apps/api/src/infrastructure/trpc/routers/reminders.router.ts` — `dispatchPending`
  gate (Slice A)
- `apps/api/src/modules/weekly-report/weekly-report.service.ts` — read-only
  dependency, `getCurrentEditableId()` (Slice A, no change expected)
- `apps/api/src/modules/reminders/reminders-queue-payload.ts` — `buildQueuePayload`
  legacy branch (Slice B)
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts` — `listExecutions`
  (Slice C)
- `apps/api/src/modules/reminders/reminders.service.ts` — in-memory pagination
  caller of `listExecutions`, to be updated in lockstep with Slice C (confirm
  exact call site during implementation; not directly read by this proposal's
  research pass)
- Tests (new, none exist today for these exact units):
  - `apps/api/src/infrastructure/trpc/routers/reminders.router.test.ts` (new) — Slice A
  - `apps/api/src/modules/reminders/reminders-queue-payload.test.ts` (new) — Slice B
  - `apps/api/src/modules/reminders/reminders.prisma-repository.test.ts` (new) — Slice C
  - Existing suites likely touched: `apps/api/src/modules/reminders/reminders.service.test.ts`,
    `apps/api/src/modules/reminders/reminders.integration.test.ts`,
    `apps/api/src/infrastructure/trpc/reminders-scope.integration.test.ts`

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — exercises the reminders DB/queue
  path end to end (`reminders.integration.test.ts`,
  `reminders-scope.integration.test.ts`) against the real DB.
- Manual/targeted checks:
  - Slice A: unit test asserting `dispatchPending` succeeds when
    `input.reportId === getCurrentEditableId()` even though
    `ctx.session.activeReportId` holds a stale (different, previously-active)
    id.
  - Slice B: unit test asserting the legacy payload's `reportPeriod` matches
    a formatted period label, not a UUID regex.
  - Slice C: integration test seeding >100 executions for one rule, walking
    `listExecutions` cursor-by-cursor, and asserting every row is eventually
    returned (no truncation at 100).
- `openspec validate reminders-correctness-bundle --strict`

## Sequencing

Depends on `reminder-policy-timezone-validation` (BL-04, P0) landing first —
both changes touch the reminders seam
(`apps/api/src/modules/reminders/**`, `reminders.router.ts`); the timezone
validation change is a schema-level correctness fix (IANA refine) that should
merge before this bundle's router/repository changes to avoid rebasing
churn on shared files. `reminder-policy-timezone-validation` exists as an
OpenSpec change in this repo (`openspec/changes/reminder-policy-timezone-validation/`)
as of this writing — implement/land it first. No dependency on the other
four changes in this batch.
