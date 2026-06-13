# Tasks — Add Version Pin

Decisions D1-D5 and the revert summary: `design.md`. Re-implements a feature
reverted in `a95681f5` / `6d4726fe` — read both `git show`s before starting.

## 1. Schema (Prisma) and migration

- [x] 1.1 `prisma/schema.prisma`: add `enum VersionSnapshotKind { autosave
pinned }` and `kind VersionSnapshotKind @default(autosave)` on the
      `VersionSnapshot` model (`schema.prisma:452-461`).
- [x] 1.2 Hand-sync the single init migration SQL with the new enum + column
      (MVP DB rule — no incremental alter-table migration).
- [x] 1.3 `migrate reset` the `_dev`/`_test` DB (pass
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); confirm it re-applies.
      Review fix 2026-06-11: `customreport_test` had been missed (only
      `_dev` was reset); reset re-run, `kind` column confirmed present.

## 2. Shared schema

- [x] 2.1 `packages/shared/src/schemas/stage.schema.ts`: add
      `versionSnapshotKindSchema` (Zod enum `['autosave','pinned']`) and a
      `kind` field on `versionSnapshotSchema` (`stage.schema.ts:26-41`) with
      `.default('autosave')`.

## 3. API

- [x] 3.1 `lead-form.prisma-repository.ts`: add `setVersionPinned(sectionId,
version, pinned)` updating the one row by the
      `@@unique([reportSectionId, version])` key.
- [x] 3.2 `lead-form.prisma-repository.ts:210-232` (`listVersions`): include
      `kind: row.kind` in the parsed object.
- [x] 3.3 `lead-form.prisma-repository.ts:490-528`: add `AND "kind" <>
'pinned'` to the retention `DELETE`; keep the three keep-windows
      unchanged.
- [x] 3.4 Service: add `setVersionPinned` with the author-only +
      not-submitted guards (mirror `snapshot.service.ts` /
      `version-history.service.ts`); declare it on the repository interface.
- [x] 3.5 `trpc.router.ts`: add `leadForm.setVersionPinned` mutation
      (`reportSectionId`, `version`, `pinned`) on the same lead-scoped
      middleware chain `createSnapshot` uses (`trpc.router.ts:2014`);
      role-coverage gate.

## 4. Web

- [x] 4.1 `lib/mappers/lead-form.ts:174-180`: add `pinned: boolean` to
      `LeadVersionSnapshot`; map it from `kind === 'pinned'` in the version
      mapper (`lead-form.ts:547`).
- [x] 4.2 `mock-data.ts:116-122`: add `pinned: boolean` to the
      `VersionSnapshot` type and update `MOCK_VERSIONS`.
- [x] 4.3 `version-history-nav.tsx`: add a star pin/unpin control to each
      modal row; group pinned versions above the chronological list; resolve
      the `TODO(v8.5-B-pin)` at `version-history-nav.tsx:23-25`. Reuse an
      existing accent token; row heights unchanged.
- [x] 4.4 `lead-form.tsx:1589-1602`: wire an `onTogglePin` prop to a
      `useMutation` calling `leadForm.setVersionPinned`; invalidate the
      lead-form query on success; English copy only.

## 5. Tests

- [x] 5.1 API integration: pinned snapshot >30 d survives the sweep; pinned
      row in the 24 h–7 d window survives hourly thinning (restore the two
      reverted `version-retention.integration.test.ts` cases against the
      enum). Review fix 2026-06-11: integration tests run for the first
      time after the `_test` reset — `version-retention` +
      `version-history` + `lead-form.prisma-repository` integration files
      all green (22/22).
- [x] 5.2 API contract: `setVersionPinned` flips `kind` and rejects a
      non-author / submitted section; both enum values have a writer.
- [x] 5.3 Web unit (`version-history-nav`): star toggles fire `onTogglePin`;
      pinned versions render in the pinned group; any version is pinnable.

## 6. Verification and acceptance

- [x] 6.1 Gates: `pnpm typecheck && pnpm lint && pnpm test` — all green.
      typecheck: 5/5 passed; lint: no issues; web tests: 935/935;
      api tests: 868/868. Note: `pnpm test` excludes
      `*.integration.test.ts`; integration evidence is recorded in 5.1.
      Full `test:integration` 2026-06-11: all add-version-pin files green;
      4 pre-existing failures remain in
      `weekly-report.scope-filter.integration.test.ts` (test predates the
      2026-05-13 `GroupProduct @@unique([productId])` flip, unrelated to
      this change).
- [x] 6.2 `grep -nE '[а-яА-Я]'` the changed `apps/web/src/**/*.tsx` — zero
      matches (no hardcoded Russian UI copy).
- [x] 6.3 Confirm `enum-state-hygiene`: both `VersionSnapshotKind` values
      have a production writer covered by a test (3.1/3.5 + 5.2).
- [ ] 6.4 Live screenshots: pin an old version, see it move to the pinned
      group with a marked star; unpin restores chronological order; user
      acceptance before archive.
