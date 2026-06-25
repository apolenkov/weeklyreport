## Why

A viewer is a **status observer** — they track where this week's report stands. The
shipped model (`2026-06-24-viewer-report-surface-parity`, "change B") scopes the
viewer to **published** reports only, so when a lead submits a section the viewer
still sees nothing until the head publishes the whole report — long after the status
is real. This change lets the viewer observe the current period live. Rationale and
the resolved trade-offs live in `design.md` and ADR 0007.

## What Changes

- Rename the viewer entry "Latest" → "Status", resolving the **Status target**: the
  current editable period if it has a viewer-visible section, else the newest
  viewer-visible `published` report, else an empty state. New
  `reports.latestForViewer` resolver replaces `reports.latestPublished`.
- Replace the viewer's published-only read gate with **published-or-current**: a
  viewer may read a report iff `periodStatus === "published"` OR it is the current
  editable period. A non-current, archived-open, or scheduled-future period stays
  rejected (fail-closed).
- A single `currentEditableId` (newest non-archived `open`/`reopened`, no published
  fallback) anchors both the gate and the resolver.
- On a period it may read, the viewer sees the **same content the head sees**,
  drafts included — a deliberate simplicity-over-privacy MVP call (ADR 0007),
  group-scoped and read-only.
- Narrow the viewer's History (viewer-role-only) to `periodStatus = "published"` so
  a reopened period is not listed as a gate-rejected broken link.
- Remove **Back to Archive** from the viewer toolbar; **keep** Agent review
  (`deferred-feature-pattern` mandates it).

## Non-goals

- No viewer editing/publishing/lifecycle — read-only stays.
- Search stays **published-scoped** (accepted read/search divergence).
- No draft-hiding / submitted-only filtering (privacy follow-up, ADR 0007).
- Period-creation lock is a SEPARATE change.
- The shared lifecycle pill, a generic NOT_FOUND retry policy, and precise nav
  active-state are out of scope (design Decisions 1, 9, 10).
- Head / lead / admin read paths are unchanged.

## Capabilities

### Modified

- `viewer-report-navigation`: Status-target entry + published-or-current read gate
  (drafts included) + viewer History narrowed to openable periods.
- `viewer-published-search`: drops the false read/search parity claim and the
  impossible cross-group audit scenario; search behavior unchanged.
- `report-toolbar-parity`: drops the stale "published-only guarantee" phrase.

### Removed

- `head-report-visibility` → "Viewer visibility stays published-only" (the reversal).

## Impact

- Backend: `getCurrentEditableId()` on `WeeklyReportRepository`/`WeeklyReportService`;
  the viewer gate in `weekly-report.service.ts`; `reports.latestForViewer` in
  `trpc.router.ts`; the viewer-role History filter in `compiledHistory`.
- Frontend: `nav-bar.tsx` rename, `reports/latest/page.tsx`, `viewer-report-shell.tsx`
  (remove Back-to-Archive), one-shot race re-resolution.
- Docs: ADR 0007, CONTEXT.md glossary.
