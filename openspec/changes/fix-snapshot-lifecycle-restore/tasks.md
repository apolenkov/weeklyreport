# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Shared schema

- [ ] Extend `reportPeriodSchema` (`packages/shared/src/schemas/report.ts`) with
      optional `periodStatus`, `archived`, `autoPublished`, `autoArchived`,
      `publishedAt`, `publishedById`, `reopenedAt` (and confirm `periodState`
      stays optional). All optional so pre-existing snapshots parse. Update
      `report.test.ts` fixtures/assertions for the widened shape.

## API — capture

- [ ] `getSnapshot` (`admin.prisma-repository.ts`): map the new governed fields
      from the already-fetched `report` rows into `reportPeriodSchema.parse(...)`
      (the `findMany()` already returns every column — no query change).

## API — restore

- [ ] Add a pure `resolveLifecycle(period)` helper returning the governed field
      set: each field verbatim when present, else the documented legacy-tuple
      backfill (`periodState` from `archived`/`status`, `periodStatus` from
      `status`, audit flags `?? false`, timestamps `?? null`). Unit-test:
      full-fidelity round-trip, legacy fallback, and the reopened-period case
      (`status="published"`/`periodState="open"`/`periodStatus="reopened"`) is
      preserved, NOT flattened.
- [ ] `applySnapshot`: spread `...resolveLifecycle(period)` into both the update
      and create branches' `data`. Keep the two `lifecycle-write-gate-allow`
      markers (restore is still a non-transition writer) but rewrite their
      comment to the stable rationale and delete the
      `TODO(snapshot-lifecycle-restore)` lines (debt paid).

## Tests & gates

- [ ] Integration test: a published period and a reopened period each survive a
      `getSnapshot` → `applySnapshot` round-trip with every governed field intact
      (published stays viewer-visible; reopened keeps its three distinct values).
- [ ] Confirm the lifecycle-write-gate test is still green (markers retained,
      no new un-exempted literal writes).
- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] Run `pnpm lint:md`.
- [ ] `openspec validate fix-snapshot-lifecycle-restore` passes.
