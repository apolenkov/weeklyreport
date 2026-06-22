# Demo feedback polish (head visibility, toggle, tooltip, summary clip)

## Problem

Five independent issues from the live demo on 2026-06-22, grouped into one
change at the user's request:

1. **Head sees an empty report while drafts exist.** The head Status Report
   shows `Live · 0/3 Submitted`, "No submitted report content yet", and
   "No submissions yet" even though leads have draft content. The head should
   see the current draft content (to review and roll back); only the viewer
   should see nothing until publish. "Submitted" should merely signal that the
   head can review / roll back, not gate visibility. (This also fixes the head
   edit/dashboard mode, which renders the same `WeeklyReportPage` and is empty
   for the same reason.)
2. **View-mode toggle looks stuck.** Switching between Edit and Slides navigates
   correctly, but the active segment is always highlighted as "Edit" so the
   toggle reads as broken. The scope and show-archived selections also reset on
   navigation / refresh because they are not encoded in the URL.
3. **Pipeline `+N more` tooltip rows are not color-coded.** The hidden-stage
   list in the `+N more` popover renders plain text, so a blocked or at-risk
   stage does not stand out.
4. **Summary slide clips a row.** On the lead Summary scope, the bottom row of a
   section (e.g. NEXT FOCUS) is clipped by the panel edge instead of being
   reachable.
5. **Product-grid sections drift between cards.** On the lead PRODUCT scope, the
   four sections (Current / Next / Risks / Decisions) do not line up across
   sibling product cards: a card without risks floats its Decisions up to where
   a neighbour shows Risks, so the eye cannot scan across products. The earlier
   subgrid work aligned a single merged Risks+Decisions band, not each section.

## Solution

1. **Head draft visibility.** Relax the frontend gate (`submitted === 0` empty
   state in `weekly-report-page.tsx`) for the head so draft content renders.
   The API already returns all sections regardless of status; only this client
   gate hides them. "submitted" continues to gate publish (`Publish & Lock`
   stays disabled until ≥1 submitted) and signals rollback/reopen, but NOT
   visibility. The `Live · X/Y Submitted` badge stays; the empty state shows
   only when content is truly empty. The viewer's server-side published-only
   gate is unchanged.
2. **Toggle state.** Pass the real `mode` into `ViewModeToggle` so the active
   segment reflects the current view, and persist scope + show-archived in the
   URL so navigation, refresh, and shared links keep the selection.
3. **Tooltip color.** Color each `+N more` reveal row by its stage status —
   blocked → red, at-risk → amber, on-track → green, unassigned → neutral —
   reusing the existing `STATUS_CONFIG` tokens (no new token). The status data
   is already computed (`hiddenStagesEffectiveStatuses`).
4. **Summary clip.** Make the Summary-scope section panels honor row overflow
   (scroll within the panel) so no row is clipped by the panel edge. The lead
   Summary (own) scope renders `LeadUnifiedSlide` (`lead-slides-client.tsx`,
   `scope === "own"`), which is already governed by `lead-slide-quadrants`
   ("a quadrant overflows its zone → scrollable inside, NOT clipped"). The clip
   is therefore a CONFORMANCE bug against that existing contract, not a new
   requirement — so this fix adds NO new spec capability (avoids duplicating
   `lead-slide-quadrants`). It is carried as a bug-fix task + regression test.
5. **Product-grid section alignment.** Split the merged Risks+Decisions band in
   `LeadProductGrid` into two separate subgrid rows (five total: header,
   Current, Next, Risks, Decisions). Each band always renders — a quiet
   placeholder when empty — so the five shared row tracks line up across every
   card in a grid row. This MODIFIES the `lead-product-grid-alignment` spec
   (4 bands → 5 separate bands).

## Non-goals

- The head slides carousel/fullscreen rework — that is the sibling change
  `head-slides-carousel-fullscreen`.
- Any change to the viewer's visibility or to publish authorization.
- Building Agent-review behavior (Phase 54, deferred).
- Changing the API content query (it already returns drafts) or the Prisma
  schema.

## Source

Live demo feedback, 2026-06-22, grill-with-docs-codex session. Images #1, #3,
#4, #6 (items 1–4); annotated product-grid screenshot, same day (item 5).

## Activation trigger

(Active — user-directed fixes to live surfaces.)
