## Why

BL-13 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`, folded
together with the council-confirmed "Orchestrator amendments" miss: a second
unmanaged `ioredis` client in `trpc.context.ts` (SessionRevocationService
constructed outside DI) — the same class of defect as BL-13's `main.ts`
instance, so both Redis-lifecycle leaks are fixed as one slice in this
change.

Five independent defects in the PDF-export backend, all confirmed by direct
source read:

- **(a) Premature terminal "failed" status.** `onJobFailed`
  (`apps/api/src/infrastructure/bullmq/pdf-export.processor.ts:64-99`) calls
  `markExportFailed` on every failed BullMQ attempt, with no check of
  `job.attemptsMade` vs `job.opts.attempts` (`attempts: 3` is configured in
  `pdf-export.service.ts:212`). `email-reminder.processor.ts:111-130` already
  has the correct pattern: compute `attemptsUsed = job.attemptsMade + 1` vs
  `maxAttempts = job.opts.attempts ?? 1` and only write the terminal state
  when `attemptsUsed >= maxAttempts`. The PDF processor lacks this guard, so
  a job that will still retry is briefly shown "failed" to any status poller.
- **(b) Two unmanaged Redis clients.** `main.ts:443` and
  `trpc.context.ts:221` both construct `new SessionRevocationService(undefined, envConfig)`
  — a fresh, unmanaged ioredis client each, never closed by shutdown hooks.
  `bull-board.module.ts:107-114` documents and follows the correct pattern:
  resolve the DI-managed singleton via `app.get(SessionRevocationService)`
  because "a `new` instance would leak an unmanaged ioredis client." The DI
  instance is already available (`main.ts:396`,
  `app.get(SessionRevocationService)`, passed into router deps).
- **(c) Opt-in ownership check.** `getPdfExportStatus(jobId, requestedBy?)`
  (`pdf-export.service.ts:225-236`) only enforces ownership when `requestedBy`
  is truthy — `if (!job || (requestedBy && job.requestedBy !== requestedBy))`.
  The router call site always passes `ctx.session.userId`, so the live
  authenticated path is safe today, but the service method itself is
  bypassable by any caller (worker code, future script) that omits the
  parameter — the safety property lives in caller discipline, not the type.
- **(d) Metric over-count.** `requests_total.inc()`
  (`pdf-export.service.ts:179-181`) fires after `createExportJob` validation
  but before the BullMQ `pdfQueue.add(...)` enqueue
  (`pdf-export.service.ts:182-215`), so a subsequent enqueue throw still
  counts as a request.
- **(e) No group-scope check at request time.** `requestPdfExport`
  (`pdf-export.service.ts:156-223`) only checks `report?.status !== "published"`;
  authorization is role-only (`leadershipProcedure` at the router) with no
  report/group-scope check, so any head/admin/viewer can enqueue a render job
  for a published report outside their group — bounded to a wasted worker job
  (the download re-check still scopes access), not a content leak.

## What Changes

- **Slice A — terminal-attempt guard**: `onJobFailed` in
  `pdf-export.processor.ts` gains the same `attemptsUsed >= maxAttempts` guard
  `email-reminder.processor.ts` already uses, and only calls `markExportFailed`
  on the terminal attempt.
- **Slice B — Redis client lifecycle**: both `main.ts:443` and
  `trpc.context.ts:221` stop constructing `new SessionRevocationService(...)`
  and instead resolve the DI-managed singleton via `app.get(SessionRevocationService)`,
  following the pattern already documented and used in `bull-board.module.ts:107-114`.
- **Slice C — required `requestedBy`**: `getPdfExportStatus`'s `requestedBy`
  parameter becomes required (drop the `?`), so the ownership check cannot be
  silently skipped by omission; the router call site (already passing
  `ctx.session.userId`) needs no behavior change.
- **Slice D — metric placement**: `requests_total.inc()` moves to after the
  BullMQ enqueue succeeds, so a failed enqueue no longer inflates the counter.
- **Slice E — group-scope check**: `requestPdfExport` adds a
  `canReadReport(session, reportId)`-shaped scope check (reusing the existing
  scope-check pattern from `analytics`/`telemetry`, per the review's
  recommendation) at the request seam, rejecting out-of-group requests before
  a job is ever enqueued.

## Claim disposition table

| Sub-claim                                                                                          | Review evidence                                                                                                      | Disposition                              | Slice |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----- |
| (a) `onJobFailed` marks every failed attempt "failed", not just the terminal one                   | `pdf-export.processor.ts:64-99` has no attempts check; `email-reminder.processor.ts:111-130` has the pattern to copy | CONFIRMED — fix                          | A     |
| (b1) `main.ts:443` constructs `new SessionRevocationService`                                       | direct read, line 443                                                                                                | CONFIRMED — fix                          | B     |
| (b2) `trpc.context.ts:221` constructs a second `new SessionRevocationService` (council/Codex miss) | direct read, line 221; council "Orchestrator amendments" CONFIRMED                                                   | CONFIRMED — fix, folded into this change | B     |
| (c) `getPdfExportStatus`'s ownership check is skippable via optional `requestedBy`                 | `pdf-export.service.ts:225-236`, line 231                                                                            | CONFIRMED — fix (make required)          | C     |
| (d) `requests_total.inc()` fires before enqueue succeeds                                           | `pdf-export.service.ts:179-181` vs enqueue at 182-215                                                                | CONFIRMED — fix                          | D     |
| (e) `requestPdfExport` has no group-scope check                                                    | `pdf-export.service.ts:156-223`, only a `status !== "published"` check; router is role-only                          | CONFIRMED — fix                          | E     |

## Non-goals

- Not changing `bull-board.module.ts` — it already does this correctly and is
  the reference pattern Slice B copies.
- Not touching the DI-managed `SessionRevocationService` singleton's own
  implementation, `main.ts:396`'s `app.get(SessionRevocationService)` call
  (already correct), or the revoked-set Redis semantics.
- Not adding a full report/group-scope authorization layer — Slice E reuses
  the existing `canReadReport`-shaped check already used elsewhere; it does
  not design a new authz primitive.
- Not addressing DLQ/queue-depth observability (BL-27) — that is a separate
  P2 change.
- Not touching `pdf-export-integrity`'s existing print-template readiness
  requirements — this change only adds new requirements alongside them.

## File manifest

- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts` — `onJobFailed`
  (Slice A)
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` — reference
  pattern, read-only (Slice A)
- `apps/api/src/main.ts` — line 443 `new SessionRevocationService` (Slice B)
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — line 221 `new SessionRevocationService`
  (Slice B)
- `apps/api/src/infrastructure/bullmq/bull-board.module.ts` — reference
  pattern, read-only (Slice B)
- `apps/api/src/modules/pdf-export/pdf-export.service.ts` —
  `getPdfExportStatus`, `requests_total.inc()`, `requestPdfExport` (Slices C, D, E)
- `apps/api/src/infrastructure/trpc/routers/pdf-export.router.ts` — call
  sites for `status`/`request` procedures (Slices C, E — confirm no signature
  break)
- Tests:
  - `apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts` (existing) — Slice A
  - `apps/api/src/infrastructure/trpc/pdf-export-session.test.ts` (existing) — Slice B
  - `apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts` (existing) — Slice B
  - `apps/api/src/modules/pdf-export/pdf-export.service.test.ts` (existing) — Slices C, D, E
  - `apps/api/src/modules/pdf-export/pdf-export.contract.test.ts` (existing) — Slice E
  - `apps/api/src/modules/pdf-export/pdf-export.download-handler.integration.test.ts` (existing) — Slice B
  - `apps/api/src/modules/pdf-export/pdf-export.integration.test.ts` (existing) — Slices A, D, E

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — exercises the BullMQ processor and
  Redis-backed session-revocation path against real infra
  (`pdf-export.integrity.test.ts`, `pdf-export.download-handler.integration.test.ts`).
- Manual/targeted checks:
  - Slice A: unit test forcing 2 of 3 configured attempts to fail and
    asserting the DB row is not `failed` until the 3rd (terminal) attempt.
  - Slice B: grep-level check — `grep -rn "new SessionRevocationService" apps/api/src`
    returns zero hits after the change (only `app.get(SessionRevocationService)`
    remains); a boot-time count of live ioredis connections used by
    `SessionRevocationService` drops from 3 to 1 (verify via `redis-cli client list`
    against dev Redis, name/count connections before and after).
  - Slice C: typecheck alone catches any remaining call site omitting
    `requestedBy` once the parameter is required.
  - Slice D: unit test forcing the enqueue call to throw and asserting
    `requests_total` is not incremented.
  - Slice E: unit test requesting a PDF for a report outside the caller's
    group and asserting rejection before any `pdfQueue.add` call.
- `openspec validate pdf-export-backend-lifecycle --strict`

## Sequencing

Depends on `session-hydration-error-scoping` (BL-05, P1) landing first — both
changes touch `apps/api/src/infrastructure/trpc/trpc.context.ts`; the
hydration-scoping change narrows the session-hydration try/catch in the same
file this change edits (line 221, `new SessionRevocationService`), so
merging it first avoids a rebase collision on shared context-factory code.
`session-hydration-error-scoping` exists as an OpenSpec change in this repo
(`openspec/changes/session-hydration-error-scoping/`) as of this writing —
implement/land it first. No dependency on the other four changes in this
batch.
