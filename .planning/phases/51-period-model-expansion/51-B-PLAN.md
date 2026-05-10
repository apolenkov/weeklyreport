# Phase 51-B — Admin Periods Tab redesign

**Status:** ready
**Depends on:** 51-A (new fields), 51-C (state-machine for filtering)
**Requirement:** richer Admin → Periods tab with Active/Archive split + per-row actions menu + submission progress badge

## Goal

Replace the flat list in `periods-tab.tsx` with a lifecycle-aware
two-section layout. Each row exposes an action menu appropriate for
its state. Submission progress is visible at a glance.

## Acceptance Criteria

- `apps/web/src/components/admin/periods-tab.tsx` is restructured into:
  - **Active** section: rows with `periodState ∈ {scheduled, open, published-within-reopen-window}`
  - **Archive** section (collapsed by default): `periodState=archived` + published-out-of-window
  - `[show archived ☐]` toggle on the Archive section header
  - `[+ Create period manually]` CTA at the bottom — disabled when
    `autoCreatePeriods=true`, with tooltip explaining
- Each row shows: Period range (DD-DD MMM), Status badge,
  Submitted progress (`3/6` with color: green/amber/red),
  Deadline timestamp, actions menu `⋮`
- Actions menu items vary by state:
  - `scheduled`: Edit deadline · Cancel
  - `open`: Edit deadline · Publish now · Add note · Delete
  - `published` (within reopen window): Reopen · Re-publish PDF · Archive
  - `published` (out of window): Re-publish PDF · Archive
  - `archived`: Unarchive · Permanent delete
- Each action mapped to existing or new tRPC mutation:
  - Edit deadline → `admin.updatePeriodDeadline({ periodId, newDeadline })` (new)
  - Publish now → `weeklyReport.publish({ reportId })` (existing)
  - Reopen → `weeklyReport.reopen({ reportId, reason })` (existing,
    enforces window)
  - Archive → `admin.archivePeriod({ periodId })` (new)
  - Unarchive → `admin.unarchivePeriod({ periodId })` (new)
  - Cancel/Delete → `admin.deletePeriod({ periodId })` (new, only
    allowed when no submissions)
- Submission progress badge: hover shows tooltip listing lead names
  - status (submitted / draft / not-started / late).
- Visual `late` badge inherited from 50-B on submission progress
  hover.

## Steps

1. Read current `periods-tab.tsx` to understand props/state shape.
2. Add new tRPC mutations (under `admin` namespace,
   `adminProcedure`):
   - `admin.updatePeriodDeadline`
   - `admin.archivePeriod`
   - `admin.unarchivePeriod`
   - `admin.deletePeriod` (guarded — refuses if any
     ReportSection.status != 'draft' for this report)
3. Restructure component:
   - Use shadcn/ui `<DropdownMenu>` for the action menu
   - `<Tabs>` may not be ideal since both sections are visible;
     use plain `<section>` blocks with sticky headers
4. Compute `submissionProgress` from existing data (Phase 46-02
   submissionDashboard rows scoped by reporting group — for admin
   role the scope is global)
5. Add tests: render, action menu by state, mutation calls, archive
   toggle visibility
6. Verify lint + tests + Docker

## Commit

`feat(web,api): UFB-052 — Admin Periods tab redesign with lifecycle actions (51-B)`

Co-Authored-By: Claude Opus 4.7 (1M context)
