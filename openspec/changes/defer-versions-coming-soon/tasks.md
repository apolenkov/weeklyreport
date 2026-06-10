# Tasks — Defer Version History, Stabilize Saving

Decisions D1-D6: `design.md`. NOT STARTED — captured 2026-06-11.
Order is load-bearing (D2 before/with D1 — never backend stubs first,
or the lead page skeleton-locks on `versionsQ`).
Depends on: `save-now-pending-indicator` (lands earlier tonight;
build on its `save-now-button.tsx` state, do not regress its tests).

## 1. Web — stop calling version endpoints (D2, D4)

- [ ] 1.1 `lead-form.tsx`: remove `versionsQ` (query, skeleton-gate
      term at the `!versionsQ.data` check, load-error toast block
      ~473-481), the `Version N · ` prefix in `autosaveLabel`, and the
      `versions` input of `mapLeadFormData` (+ mapper signature and
      `data.versions` consumers). `TODO(defer-versions-coming-soon)`
      at the former query site.
- [ ] 1.2 `lead-form.tsx`: remove the F3.4 snapshot view surface —
      `viewedSnapshotVersion` state, `getVersionQ`, snapshot banner +
      "Back to current", snapshot-mode skeleton branch, and the
      snapshot stage-status lookup (~line 812 block); remove
      `restoreMut` + `handleRestoreVersion`.
- [ ] 1.3 `lead-form.tsx`: remove `createSnapshotMut` and the
      `onSaveSuccessAction` snapshot trigger (lines ~616-631,
      676-682); `TODO(defer-versions-coming-soon)` at the former
      write trigger.
- [ ] 1.4 `use-lead-form-autosave.ts`: remove the now-orphaned
      `onSaveSuccessAction` prop + `onSaveSuccessRef`; update hook
      tests to the new contract (D4).
- [ ] 1.5 Orphan sweep for 1.1-1.4: unused imports
      (`VersionHistoryNav` props, `VersionSnapshot` from mock-data),
      dead mapper fields, stale `invalidateLeadForm`/cache-keys
      entries; `pnpm typecheck` must drive the sweep, not memory.

## 2. Web — inert ComingSoon control (D5)

- [ ] 2.1 Rewrite `version-history-nav.tsx` as the prop-less inert
      `VersionHistoryNav`: disabled button + `aria-disabled`,
      `aria-label="Version history is coming soon"`,
      `title="Coming Soon"`,
      `data-testid="version-history-coming-soon"`, wrapped in
      `ComingSoonBadge` per `nav-bar.tsx:170-184`; English copy only;
      `TODO(defer-versions-coming-soon)` activation marker.
- [ ] 2.2 Rewrite `version-history-nav.test.tsx` to the inert
      contract: renders disabled control + badge tooltip; no
      arrows/pill/restore handlers exist.
- [ ] 2.3 Update `lead-form.tsx` toolbar render site (~1589-1602) to
      the prop-less control; update `lead-form.test.tsx` blocks that
      reference Save Version / snapshot navigation (~line 242) to the
      new contract.

## 3. API — loud stubs (D1, D3)

- [ ] 3.1 `trpc.router.ts`: `leadForm.versions` (1961),
      `getVersion` (~1993), `restoreVersion` (1975),
      `createSnapshot` (2014) throw
      `new Error("Not implemented — see TODO(defer-versions-coming-soon)")`
      before the service call, each with the `TODO` marker comment.
      Services, repository, retention logic and their integration /
      characterization tests stay untouched and green.
- [ ] 3.2 Contract test (extend `lead-form.contract.test.ts` or
      sibling): each of the 4 procedures rejects with the stub
      message.
- [ ] 3.3 `version-history.service.ts` `fillFrom`: keep the internal
      pre-overwrite `createVersionSnapshot` (D3) and mark it
      `TODO(defer-versions-coming-soon)` as the single remaining
      writer.

## 4. Save stability (D6)

- [ ] 4.1 Audit `use-lead-form-autosave.test.tsx` +
      `save-now-button.test.tsx` against the D6 contract list; add
      missing cases only (debounce coalescing; error → `state:
    "error"` + `dirty: true` + retry on next edit; `forceSave`
      cancels timer / queues while in flight; success path has no
      snapshot side effect). Remove nothing.
- [ ] 4.2 Manual live check on :3000 (dev server, do not restart):
      lead page loads with no versions query; edit → autosave →
      "Saved"; Save-now → pending indicator → saved; network error
      (devtools offline) → "Save failed" surfaces and retry works;
      toolbar shows the inert ComingSoon version control with
      tooltip.

## 5. Planning + docs + gates

- [ ] 5.1 Spec delta sanity: `npx openspec validate
    defer-versions-coming-soon` passes.
- [ ] 5.2 UI-strings check on touched tsx: `grep -nE '[а-яА-Я]'` —
      matches only in comments/tests/data.
- [ ] 5.3 Gates: `pnpm typecheck && pnpm lint && pnpm test &&
    pnpm build` — record results here. Do not stage or revert the
      pre-existing `product-accordion.test.tsx.snap` modification.
