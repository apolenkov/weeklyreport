# Tasks

## Decisions (human, per value) — RESOLVED 2026-06-03

- [x] T1: `CarryOverStatus.failed` (+ `pending`) — **REMOVE**. Carry-over is
      synchronous: the service writes only `completed` (or throws, persisting
      nothing). No error/queued state was ever designed. Enum collapses to the
      single live value `completed`; field default `pending`→`completed`.
- [x] T2: `ReminderRuleStatus.paused` — **IMPLEMENT** (not remove). Investigation
      found `paused` was ~90% wired, not dead: the scheduler skips paused rules,
      the derived-rules panel renders a "Paused" badge, and both web mappers
      (`mapReminder`, `toAdminReminderRuleInput`) convert it — only the write
      trigger was missing. The pause toggle already exists on the _policy_
      (`policy.active`); derived `ReminderRule` rows are read-only and must mirror
      it. Wired the cascade at policy-save (not period-save, so the @Cron
      scheduler stops firing immediately): `saveReminderPolicy` and
      `archiveReminderPolicy` now flip a policy's derived rules to
      `active ? "active" : "paused"`. Reader + anticipatory index retained.
- [x] T3: `PdfExportStatus.processing` — **REMOVE**. Export goes
      `queued`→`completed`/`failed` directly; `processing` is written nowhere
      (service, BullMQ processor). The only reader was a UI poll condition.

## Apply

- [x] T4: Removals applied — `prisma/schema.prisma` enums + field default, Zod
      enums in `@customreport/shared`, pdf-export domain↔db mapper, the
      `export-pdf-button` poll condition, and the single init migration's
      `CREATE TYPE` lines + CarryOver column default (edited in place to preserve
      the hand-grafted FTS `GENERATED` columns; `migrate reset` re-applies it).
- [x] T5: `paused` implemented — cascade writer in `admin.prisma-repository.ts`
      (`saveReminderPolicy` + `archiveReminderPolicy`) + integration tests in
      `admin.integration.test.ts` asserting an inactive/archived policy parks its
      derived rules `paused` and re-activating resumes them.

## Verification

- [x] T6a: `pnpm typecheck` green (5/5 packages).
- [x] T6b: `pnpm lint` green.
- [x] T6c: `pnpm test` (unit/web: shared 564, api 861, web 579) + `pnpm build`
      (5/5) green. `customreport_test` rebuilt via `migrate reset` from the
      edited init migration — applied cleanly (FTS `GENERATED` grafts + narrowed
      enums all valid). API integration suite: **121 passed**, including the two
      new paused-cascade tests. 4 PRE-EXISTING failures in
      `weekly-report.scope-filter.integration.test.ts` are unrelated to this
      change — see Notes.
- [x] T7: `openspec validate cleanup-dead-enum-states --strict` passes.

## Notes

- Evidence: `/tmp/catalog-findings-backup/_gaps.md` §4 + `_gaps-round2.md`
  (PdfExportStatus.processing), code-verified this session.
- **Out-of-scope pre-existing failure surfaced by the test-DB reset:**
  `weekly-report.scope-filter.integration.test.ts` (4 cases, Phase 56-D
  cross-group GroupProduct visibility) fails on `groupProduct.createMany` with
  "Unique constraint failed on `productId`". The schema enforces
  `@@unique([productId])` (B1: one-group-per-product invariant), which directly
  contradicts the test attaching one product to two groups. Unchanged by this
  change (git diff touches neither GroupProduct nor that test); the init
  migration carries the constraint at `GroupProduct_productId_key`. It was
  latent because the vitest integration suite wasn't being run locally (no
  `.env.test`); the reset brought `customreport_test` to the canonical schema
  and exposed it. Belongs in its own change: either drop the B1 invariant to a
  composite `@@unique([groupId, productId])` to allow cross-group M:M, or fix
  the test to respect one-group-per-product.
