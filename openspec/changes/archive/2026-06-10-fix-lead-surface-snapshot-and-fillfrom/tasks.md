# Tasks — Fix Lead Surface (Snapshot Triggers, Archive, Fill From, Summary)

Root causes + exact fix plans: `memos/lead-surface-audit-verdict.md`.
Decisions D1-D5: `design.md`. NOT STARTED — captured 2026-06-10.

## 1. Snapshot trigger bug (D1)

- [x] 1.1 `current-week-section.tsx:171` + `next-week-section.tsx:117`:
      drop `readOnly` from the add-signal effect dep arrays.
- [x] 1.2 `lead-form.tsx`: reset both add-signal counters to 0 when
      `viewedSnapshotVersion` becomes non-null (hardening).
- [x] 1.3 Unit test: simulate add-click → enter snapshot → "Back to
      current" → assert no dialog opens.

## 2. Archive toggle (D2)

- [x] 2.1 `lead-form.tsx:1562-1572`: render the archiveToggle slot only
      when `hasArchivedPeriods`.
- [x] 2.2 `archive-toggle.tsx`: optional `archivedCount` prop → "N
      archived" inside the pill (English copy).
- [x] 2.3 `period-navigator.tsx`: archived marker on archived options.
- [x] 2.4 `lead-form.tsx:1577`: pass archive-filtered `visiblePeriods`
      to `FillFromButton`.
- [x] 2.5 Unit tests: toggle hidden without archived periods; combo
      marks archived entries when shown.

## 3. History summary (D3)

- [x] 3.1 `lead-history-sidebar.tsx`: compute `submittedEntries`; base
      totalRisks / avgItems / traffic-light totals on it; keep
      Submissions ratio; add the muted draft note.
- [x] 3.2 Unit test: draft risks/items excluded from aggregates,
      included in the Submissions denominator.

## 4. Fill From popover (D4)

- [x] 4.1 `fill-from-button.tsx`: portal the dropdown to document.body
      with rect positioning + scroll/resize tracking (mirror the
      confirm-modal portal and stage-chip pattern).
- [x] 4.2 `report-toolbar.tsx:17`: `overflow-x-auto` → `overflow-x-clip`.
- [x] 4.3 First-row highlight via token classes (hover works); drop the
      inline styles.
- [x] 4.4 Hide the search input when `pastPeriods.length === 0`.
- [x] 4.5 Replace the `#999` data-URI search icon with an inline SVG on
      `--color-muted-foreground`.
- [x] 4.6 "Previous" badge → accent fill + white text (sign-off
      recorded).
- [x] 4.7 Feedback round 2 (user, 2026-06-10, post-acceptance):
      "[Archived]" prefix on archived rows in the Fill From list —
      same marker vocabulary as the period combo; unit test added;
      spec wording extended in delta + main spec. Also reseeded the
      stale dev DB (duplicate Week 21 was old-seed data, not a code
      bug) — current seed yields no date collisions.

## 5. Dashed stripe for incomplete own-stages (D5)

- [x] 5.1 Verify the own-stage ownership field on the edit-view stage
      model; compute `hasUnfilledOwnStage` in `sdlc-pipeline.tsx`.
- [x] 5.2 `getProductCardStyle`: dashed left-border style while
      incomplete; color unchanged.
- [x] 5.3 Unit test: green + unfilled own stage → dashed; all filled →
      solid.

## 6. Verification and acceptance

- [x] 6.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here.
      RESULTS 2026-06-10 (workflow `wf_d1099987-b19`, 1 fix round —
      prettier-only): typecheck PASS, lint PASS, test PASS (lead +
      report-shell suites 288/288; 3 new test files), build PASS;
      `prettier --check` clean on all changed files after a trailing
      blank-line fix in `fill-from-button.tsx`.
- [x] 6.2 Live screenshots: snapshot exit (no dialog), archive toggle
      with count + marked combo, Fill dropdown open (incl. narrow
      viewport), dashed-stripe card; user acceptance before archive.
      SCREENSHOTS TAKEN 2026-06-10 (as boris@, live :3100, gitignored
      `.playwright-mcp/lead-surface-fixes/01-06*.png`): 01 toolbar
      badge "3 archived" + dashed/solid stripes side by side; 02 back
      from snapshot v2 — zero dialogs (DOM-verified); 03 Fill From
      portaled, search icon tokenized, Previous badge accent+white;
      04 combo with "[Archived]" markers (6 options, toggle on);
      05 narrow 420px viewport — panel fully visible; 06 history
      summary: 2/3, avg 2, risks "—", "1 draft not included in
      aggregates." USER ACCEPTANCE PENDING.
