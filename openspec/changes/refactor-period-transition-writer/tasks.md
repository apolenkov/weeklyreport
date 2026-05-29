# Tasks

Grouped by repo target (api only — no shared/ui/web surface changes). Each item
is sized to land in one commit. Gates after every step:
`pnpm typecheck && pnpm lint && pnpm test`.

## API — module

- [x] Add pure `modules/period/period-transition.ts`: `buildTransition(kind,
ctx)` returning the governed-field subset for all kinds (`create`,
      `schedule`, `open`, `publish`, `autoPublish`, `reopen`, `archive`,
      `autoArchive`, `unarchive`). Timestamp-stamping kinds take `now` via
      `ctx` (no internal `new Date()`). Move `legacyTupleToState` /
      `stateToLegacyTuple` / `initialPeriodState` in as internals. Unit-test
      every kind's field set (including the reopen asymmetry) with no DB.
- [x] Add thin `modules/period/period-transition.apply.ts`:
      `applyTransition(tx, reportId, kind, ctx)` running `tx.report.update` and
      returning the row; plus a no-tx convenience wrapper.

## API — migrate writers (one per commit)

- [x] Migrate `auto-publisher.scheduler.ts` to a single `autoPublish`
      transition inside one transaction — closes the tx1/tx2 divergence window.
      (Done by deleting the scheduler's redundant second `report.update`; the
      atomic write now lives in `publishAuto` per the commit above.)
- [x] Migrate `period.prisma-repository.ts` `publishPeriod` (keep the snapshot
      write in the same `$transaction`) and `reopenPeriod`.
- [x] Migrate `admin.prisma-repository.ts` `createPeriodManual` /
      `archivePeriod` / `unarchivePeriod`. Leave `updatePeriodManual` (Edit
      dialog, date/label only — no lifecycle field).
- [ ] Migrate `auto-archiver.scheduler.ts` and `period-creator.scheduler.ts`
      (create + SCHEDULED→OPEN flip).
- [x] Migrate `publication.prisma-repository.ts` assemble/publish path.
      Done early (before auto-publisher): the periodStatus drift lives in the
      shared `saveAssembledReport`, so fixing it here repairs BOTH manual
      `publishReport` and scheduler `publishAuto`, and makes `autoPublish`
      atomic — which is what lets the scheduler's tx2 be deleted next.

## API — enforcement & tests

- [ ] Add a CI gate (lint rule or grep check, mirroring the role-coverage-gate
      pattern) that fails when `report.update`/`report.create` writes any
      lifecycle field (`periodState`, `status`, `periodStatus`, `archived`,
      `autoPublished`, `autoArchived`) outside the transition module.
- [ ] Add the `period-dual-state`-required atomicity integration test: a
      rolled-back transition leaves neither `periodState` nor the legacy fields
      partially updated.

## Cleanup

- [ ] Delete the `period-state.ts` shim once no caller imports its helpers.

## Verification

- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] Run `pnpm lint:md` for the planning docs.
- [ ] `openspec validate refactor-period-transition-writer` passes.
