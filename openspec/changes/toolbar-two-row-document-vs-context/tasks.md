# Tasks

## 1. Glossary + scaffolding

- [ ] 1.1 Add `Document action` and `Context control` glossary entries to
      CONTEXT.md (concept only — no row/colour detail).
- [ ] 1.2 Extend `ReportToolbar` to render two stacked rows (top document-action
      group, bottom context-control group) while keeping the existing single
      shared container contract (report-toolbar-parity).

## 2. Lead toolbar (lead-form.tsx)

- [ ] 2.1 Test-first: lead draft renders top row (Version⏳ · PDF⏳ · Fill-From ·
      Save · Submit Section) and bottom row (period · Show-archived [when
      archived periods exist] · Mine|Everyone · Edit|Slides · Toggle All ·
      Agent review).
- [ ] 2.2 Move controls into the two rows; reserve the inert Version/PDF slots in
      the top row.
- [ ] 2.3 Apply colour hierarchy: Submit Section solid accent; other document
      actions accent-outline.
- [ ] 2.4 Submitted state: hide Save; swap commit to Request Reopen with a
      neutral/outline treatment (no reorder).
- [ ] 2.5 Read-only past period: hide only the real mutating actions
      (Save/Submit/Fill-From); keep the inert Version/PDF Coming-soon stubs
      visible (deferred-feature-pattern); keep the bottom row.
- [ ] 2.6 Show-archived filter renders only when the lead has archived periods
      (lead-report-controls-integrity); omit it otherwise without reordering.

## 3. Head toolbar (weekly-report-page.tsx / head-report-shell.tsx)

- [ ] 3.1 Test-first: head open period renders top row (PDF · Publish & Lock)
      and bottom row (period · Show-archived · Product|Leads · Edit|Slides ·
      Agent review).
- [ ] 3.2 Move headerActions controls into the two rows.
- [ ] 3.3 Apply colour hierarchy: Publish & Lock solid accent; Reopen
      neutral/outline on published periods.
- [ ] 3.4 Published period: place the "Move to archive" lifecycle button in the
      top Document action row (neutral), distinct from the bottom-row
      show-archived filter; add a published-head scenario assertion.
- [ ] 3.5 Empty publish state: open period with zero submitted content keeps
      Publish & Lock in its slot, disabled, with the hint outside the rows.

## 4. Viewer + preview inheritance

- [ ] 4.1 Test-first: viewer top row contains only PDF (no commit); the
      `Back to Archive` nav and `AgentReviewComingSoon` sit in the bottom row;
      submitted badge stays outside both rows.
- [ ] 4.2 Verify lead preview (own outer header) inherits the toolbar with no
      commit control in the top row.

## 5. Copy rename + spec deltas

- [ ] 5.1 Rename the lead commit copy `Submit Report` → `Submit Section`.
- [ ] 5.2 Update tests asserting the old `Submit Report` label.
- [ ] 5.3 Confirm the `report-toolbar-parity` MODIFIED delta is honoured: named
      commit/utility controls keep visible text inside `ReportToolbar`; only
      compact icon-only controls (`Export PDF`) use `ToolbarIconButton`.
- [ ] 5.4 Confirm the `head-toolbar-semantics` MODIFIED delta: scope/view toggles
      keep the accent active-fill visual family in the Context row; the Agent
      review placeholder stays compact + leading-edge + aria-disabled.

## 6. Accessibility + responsive

- [ ] 6.1 Add `aria-label="Document actions"` / `aria-label="Context controls"`
      group names; assert keyboard focus order (top row before bottom row).
- [ ] 6.2 Ensure each row scrolls/wraps so no control is clipped out of reach at
      narrow widths; add a narrow-width test.

## 7. Gate

- [ ] 7.1 `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] 7.2 Live-verify lead (draft/submitted/read-only), head (open/published incl.
      move-to-archive), viewer in the browser; confirm row split, colour
      hierarchy, accessible groups, narrow-width reachability, and that status
      indicators sit outside the rows.
