# Tasks — Fix Lead Surface (Snapshot Triggers, Archive, Fill From, Summary)

Root causes + exact fix plans: `memos/lead-surface-audit-verdict.md`.
Decisions D1-D5: `design.md`. NOT STARTED — captured 2026-06-10.

## 1. Snapshot trigger bug (D1)

- [ ] 1.1 `current-week-section.tsx:171` + `next-week-section.tsx:117`:
      drop `readOnly` from the add-signal effect dep arrays.
- [ ] 1.2 `lead-form.tsx`: reset both add-signal counters to 0 when
      `viewedSnapshotVersion` becomes non-null (hardening).
- [ ] 1.3 Unit test: simulate add-click → enter snapshot → "Back to
      current" → assert no dialog opens.

## 2. Archive toggle (D2)

- [ ] 2.1 `lead-form.tsx:1562-1572`: render the archiveToggle slot only
      when `hasArchivedPeriods`.
- [ ] 2.2 `archive-toggle.tsx`: optional `archivedCount` prop → "N
      archived" inside the pill (English copy).
- [ ] 2.3 `period-navigator.tsx`: archived marker on archived options.
- [ ] 2.4 `lead-form.tsx:1577`: pass archive-filtered `visiblePeriods`
      to `FillFromButton`.
- [ ] 2.5 Unit tests: toggle hidden without archived periods; combo
      marks archived entries when shown.

## 3. History summary (D3)

- [ ] 3.1 `lead-history-sidebar.tsx`: compute `submittedEntries`; base
      totalRisks / avgItems / traffic-light totals on it; keep
      Submissions ratio; add the muted draft note.
- [ ] 3.2 Unit test: draft risks/items excluded from aggregates,
      included in the Submissions denominator.

## 4. Fill From popover (D4)

- [ ] 4.1 `fill-from-button.tsx`: portal the dropdown to document.body
      with rect positioning + scroll/resize tracking (mirror the
      confirm-modal portal and stage-chip pattern).
- [ ] 4.2 `report-toolbar.tsx:17`: `overflow-x-auto` → `overflow-x-clip`.
- [ ] 4.3 First-row highlight via token classes (hover works); drop the
      inline styles.
- [ ] 4.4 Hide the search input when `pastPeriods.length === 0`.
- [ ] 4.5 Replace the `#999` data-URI search icon with an inline SVG on
      `--color-muted-foreground`.
- [ ] 4.6 "Previous" badge → accent fill + white text (sign-off
      recorded).

## 5. Dashed stripe for incomplete own-stages (D5)

- [ ] 5.1 Verify the own-stage ownership field on the edit-view stage
      model; compute `hasUnfilledOwnStage` in `sdlc-pipeline.tsx`.
- [ ] 5.2 `getProductCardStyle`: dashed left-border style while
      incomplete; color unchanged.
- [ ] 5.3 Unit test: green + unfilled own stage → dashed; all filled →
      solid.

## 6. Verification and acceptance

- [ ] 6.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here.
- [ ] 6.2 Live screenshots: snapshot exit (no dialog), archive toggle
      with count + marked combo, Fill dropdown open (incl. narrow
      viewport), dashed-stripe card; user acceptance before archive.
