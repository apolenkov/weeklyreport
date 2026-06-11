# Tasks — Remove Version History Entirely, Stabilize Saving

Decisions D1-D8: `design.md`. NOT STARTED — rewritten 2026-06-11 to the
user's full-removal decision (supersedes the old "stub + keep schema"
task list, recoverable via git history of this file).
Depends on: `save-now-pending-indicator` (lands earlier in the queue;
build on its `save-now-button.tsx` state, do not regress its tests).
`pnpm typecheck` is expected red between groups 1-3; gates are judged
in group 5.

## 1. Prisma schema + shared read model (D3, D6)

- [x] 1.1 `prisma/schema.prisma`: drop the `VersionSnapshot` model
      (lines ~452-461), the `VersionSnapshotKind` enum (~line 690), and
      the `versionSnapshots` relation on `ReportSection` (~line 247).
- [x] 1.2 Hand-sync the single init migration SQL: delete the
      `VersionSnapshot` table and `VersionSnapshotKind` enum DDL (MVP
      DB rule — no incremental alter-table migration).
- [x] 1.3 `prisma migrate reset` BOTH the `_dev` and `_test` databases
      with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`; confirm both
      re-apply and the table is gone (add-version-pin once missed
      `_test` — verify both). Never prod.
- [x] 1.4 `packages/shared/src/schemas/stage.schema.ts`: remove
      `versionSnapshotKindSchema`, `versionSnapshotSchema`, and the
      `VersionSnapshot` / `VersionSnapshotKind` types; strip their
      cases from `packages/shared/src/schemas/report.test.ts`.
- [x] 1.5 `packages/shared/src/schemas/report.schema.ts:414-416`:
      remove `versionCount`, `latestVersion`, `latestVersionAt` from
      `myHistoryEntrySchema`.

## 2. API removal (D1, D2, D3)

- [x] 2.1 `trpc.router.ts`: delete the five procedures —
      `leadForm.versions` (~1981), `restoreVersion` (~1995),
      `getVersion` (~2014), `createSnapshot` (~2034),
      `setVersionPinned` (~2051). One `TODO(versions-v2)` comment at
      the former block. No procedures added (role-coverage gate
      untouched).
- [x] 2.2 `trpc.router.ts` `myHistory` (~349-406): remove the
      `versionSnapshots` include, the snapshot dates from the
      `lastEditAt` reduction, `latestVersion`, and the
      `versionCount` / `latestVersion` / `latestVersionAt` output
      fields.
- [x] 2.3 Delete `snapshot.service.ts`; in
      `version-history.service.ts` delete `listVersions`,
      `getVersion`, `setVersionPinned`, `restoreVersion` and move the
      surviving `fillFrom` into `lead-form.service.ts` (or a sibling
      `fill-from.service.ts`), dropping its pre-overwrite
      `createVersionSnapshot` call with a `TODO(versions-v2)` one-liner
      (D2). Update module/DI wiring and the repository interface in the
      service file; `repository.fillFromSection` stays.
- [x] 2.4 `lead-form.prisma-repository.ts`: remove `getVersion` (~197),
      `listVersions` (~210), the restore write path (~296-303 fidelity-
      bug anchor), `createVersionSnapshot` + the retention sweep
      (~461-528), and `setVersionPinned` (~812); sweep
      `lead-form-shared.ts` for orphaned helpers/types.
- [x] 2.5 Tests: delete `version-history.integration.test.ts`,
      `version-retention.integration.test.ts`,
      `version-snapshot.characterization.integration.test.ts`; strip
      version/snapshot cases from `lead-form.contract.test.ts`,
      `fill-from.integration.test.ts` (pre-overwrite snapshot
      assertions), and
      `lead-form.prisma-repository.integration.test.ts` (D1 — versions-
      v2 starts from a fresh design, not these tests).

## 3. Web removal + ComingSoon control (D3, D4, D5)

- [x] 3.1 `lead-form.tsx`: remove `versionsQ` (query, the
      `!versionsQ.data` skeleton-gate term, load-error toast),
      `getVersionQ` + `viewedSnapshotVersion` + the snapshot overlay
      and its skeleton branch, `restoreMut` + `handleRestoreVersion`,
      `createSnapshotMut` + the `onSaveSuccessAction` wiring,
      `onTogglePin`, the `Version N · ` autosave-label prefix
      (~1427-1430), and the `versions` input of `mapLeadFormData`.
      `TODO(versions-v2)` at the former save-success trigger.
- [x] 3.2 `use-lead-form-autosave.ts`: remove the orphaned
      `onSaveSuccessAction` prop + `onSaveSuccessRef`
      (lines 45, 101-104, 125); rewrite the affected hook tests to the
      no-snapshot contract (D4).
- [x] 3.3 Delete `version-history-nav.tsx`, `version-row.tsx`,
      `version-history-nav.test.tsx`, `version-history-nav-pin.test.tsx`,
      and `__snapshots__/version-history-nav.test.tsx.snap`; remove
      `MOCK_VERSIONS` + the `VersionSnapshot` type from `mock-data.ts`,
      `LeadVersionSnapshot` + the version mapper from
      `lib/mappers/lead-form.ts` (+ `lib/mappers/index.ts` export), and
      `versionCount` / `latestVersion` / `latestVersionAt` from
      `lib/mappers/lead-history.ts` (+ their test cases).
- [x] 3.4 New `apps/web/src/components/lead/version-coming-soon.tsx`:
      inert `VersionComingSoonControl` per
      `nav-bar.tsx:170-184` `LanguageComingSoonControl` — disabled
      button, `aria-disabled`,
      `aria-label="Version history is coming soon"`,
      `title="Coming Soon"`, `data-testid="version-coming-soon"`,
      wrapped in `ComingSoonBadge`; English copy only;
      `TODO(versions-v2)` activation marker; unit test (renders
      disabled control + tooltip). Wire it into the `lead-form.tsx`
      toolbar slot (~1589-1602).
- [x] 3.5 Orphan sweep for 3.1-3.4 driven by `pnpm typecheck`, not
      memory: unused imports, dead mapper fields, stale cache-key
      invalidations; update `lead-form.test.tsx`,
      `lead-form-addressable.test.tsx`,
      `lead-form-viewmode.snapshot.test.tsx` and any other test still
      referencing versions.

## 4. Save stability — the user's #1 ask (D7)

- [x] 4.1 Audit `use-lead-form-autosave.test.tsx` +
      `save-now-button.test.tsx` against the D7 contract: debounce
      coalescing; error → `state: "error"` + `dirty: true` + retry on
      next edit; `beforeunload` guard while dirty; `forceSave` cancels
      the timer / queues while in flight; success path has no side
      effects beyond the draft write. Add missing cases; remove only
      assertions about now-deleted snapshot behavior; do not regress
      `save-now-pending-indicator` tests.
- [x] 4.2 Manual live check on :3000 (restart the dev server only after
      group 3 lands): lead page loads with no version queries; edit →
      autosave → "Saved"; Save now → pending indicator → saved;
      devtools-offline → "Save failed" surfaces and the next edit
      retries; toolbar shows the inert ComingSoon version control with
      tooltip.

## 5. Specs, cleanup guards, gates (D8)

- [x] 5.1 `npx openspec validate defer-versions-coming-soon` passes;
      at archive time confirm `openspec/specs/version-pinning/` is
      removed by the REMOVED delta (delete the directory in the archive
      commit if tooling leaves it).
      Result 2026-06-11: "Change 'defer-versions-coming-soon' is valid".
- [x] 5.2 Cleanup guard — all three greps return zero matches outside
      `openspec/` (changes archive included) and `.git`:
      `grep -rn "VersionSnapshot" --exclude-dir={node_modules,.git,.next,dist,openspec} .`
      `grep -rn "versionSnapshot" --exclude-dir={node_modules,.git,.next,dist,openspec} .`
      `grep -rn "version-history-nav" --exclude-dir={node_modules,.git,.next,dist,openspec} .`
      (rebuild `packages/shared/dist` rather than grepping stale build
      output).
      Result 2026-06-11: zero matches in tracked source; remaining hits
      are git-ignored artifacts (`.scratch/` logs, `e2e/sweep/.reports/`,
      `.next-sweep/` caches) plus descriptive prompt text in
      `.claude/workflows/overnight-everything.js`; rebuilt
      `packages/shared/dist` is clean.
- [x] 5.3 UI-strings check on touched tsx: `grep -nE '[а-яА-Я]'` —
      matches only in comments/tests/data.
      Result 2026-06-11: zero Cyrillic matches in touched production tsx.
- [x] 5.4 Gates — record results here:
      `pnpm typecheck && pnpm lint`;
      `pnpm --filter @customreport/shared test`,
      `pnpm --filter @customreport/api test`,
      `pnpm --filter @customreport/web test`;
      API integration suite for `report-sections` (fill-from +
      repository files green);
      `pnpm test && pnpm build`.
      Do not stage or revert the pre-existing
      `product-accordion.test.tsx.snap` modification.
      Results 2026-06-11: typecheck green; lint green (ESLint no
      issues); shared 598 passed; api unit 904 passed; web 1015 passed
      (incl. 2 new D7 cases); api integration 99 passed / 2 env-skipped
      (fill-from + repository green); `pnpm test` green; `pnpm build`
      green.
