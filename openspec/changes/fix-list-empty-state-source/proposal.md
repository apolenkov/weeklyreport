## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

Two admin/head list surfaces derive their header count and/or empty-state
branch from the wrong source of rows, so the header and the empty-state text
can contradict the list actually rendered:

- `apps/web/src/features/review/ui/reopen-tab.tsx` gates its empty-state on
  the pre-search `requests.length` (line 132) while the list below it maps
  `filteredRequests` (line 141) and the header count also reads
  `requests.length` (line 90). A search that matches nothing renders a blank
  panel under a header still claiming "N requests" and no empty-state message
  at all.
- `apps/web/src/features/admin/ui/action-log-tab.tsx` already gates its
  empty-state on the filtered `visibleRows` (line 111) and already
  distinguishes "no data" from "no search match" (lines 113-115), but the
  message chooser (line 113) and the header count badge (line 82) both read
  unfiltered `rows.length`, which still includes internal proof rows hidden
  from `visibleRows`. A page containing only hidden proof rows shows "No
  actions match the search." with no search typed, and the "N loaded" badge
  counts rows the user never sees.

Both surfaces are internal admin/head tooling with no data or authorization
impact — this is misleading list UX, not a correctness or security defect.

## What Changes

- `apps/web/src/features/review/ui/reopen-tab.tsx`: derive the empty-state
  branch and its message from `filteredRequests`, not `requests`, and
  distinguish "no requests at all" (`requests.length === 0`) from "no
  requests match the search" (`requests.length > 0 && filteredRequests.length
=== 0`). Keep the header count on `filteredRequests.length` so the number
  next to "requests" always matches the rendered list.
- `apps/web/src/features/admin/ui/action-log-tab.tsx`: switch the header
  count badge (line 82) and the empty-state message chooser (line 113) from
  `rows.length` to `visibleRows.length`, so both track the same
  proof-row-and-search-filtered set the table renders. The existing
  loading/error branches and the `visibleRows.length === 0` empty-state gate
  are unchanged.
