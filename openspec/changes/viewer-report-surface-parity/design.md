## Context

The viewer surface today is `/reports` (compiled History) plus the reachable but
under-advertised `/reports/[reportId]` read-only report. `reports/page.tsx` sets
`searchScope = null` for a viewer, so no search input renders. `search.service.ts`
forbids `scope="all"` and returns empty for `scope="mine"` for a viewer. The
compiled report renderer (`WeeklyReportPage`) is already shared, with mutation
affordances gated by role. The published-only gate (`head-report-visibility`)
404s a viewer on an unpublished period.

Adversarial review surfaced three load-bearing facts the first draft missed:

- Search scopes groups via the legacy `User.reportingGroupId` author join
  (`search.prisma-repository.ts:91,95`), NOT the GroupProduct gate the report uses
  — so search and report visibility can diverge for the same viewer.
- The scope toggle and slides view-mode controls live only in `HeadReportShell`;
  the viewer route renders `WeeklyReportPage` directly with no shell and no `mode`
  handling, so "enable a flag" is not possible — a viewer shell is required.
- `/present` `permanentRedirect`s to `?mode=slides`, but the viewer page never
  reads `mode`, so viewer slides are currently inert — this change fixes that latent
  bug.

## Goals / Non-Goals

**Goals**: viewer can find published content (search), reach the latest visible
published report directly (navigation), and present it (scope toggle + slides).

**Non-Goals**: no editing/publishing for viewer; no Dashboard; no unpublished
exposure; no rewrite of `WeeklyReportPage`; no change to head/lead/admin surfaces;
no product (`project`) search results for the viewer in v1.

## Decisions

### 1. New `published` search scope with a real Report join

Add `scope="published"` to the shared scope enum and the service. The repository
gains an `INNER JOIN "Report"` on each text chunk with a published predicate
(`periodState`/`periodStatus = 'published'` — confirm the exact column at
implementation against `prisma/schema.prisma`). Chosen over a `publishedOnly` flag
on `all`: a distinct scope name is explicit and enforceable in the authorization
switch, with no default-off leak risk.

### 2. Search group filter MUST match the report group filter (the leak fix — P0)

Today search filters via `authorId/leadId IN (User WHERE reportingGroupId IN …)`.
For the viewer `published` scope, route the group filter through the **same
GroupProduct-based access the report path uses**, so search visibility equals
report visibility product-for-product. A regression test MUST assert that a product
hidden from the viewer's report is also absent from search.

### 3. Exclude `project` hits for the viewer (v1)

A `Project` has no publish state and its result destination is `/admin?tab=products`
(`search-input.tsx:66`), which the viewer cannot reach. Add `"project"` to the
viewer's `excludeTypes` (mirroring the existing lead exclusion in
`search.service.ts`). Defining product publication + a viewer-safe product
destination is deferred.

### 4. Viewer search-result routing

`search-input.tsx` builds targets to `/lead/report/<id>` and `/admin…`. For a
viewer, rewrite every (non-excluded) result target to `/reports/[reportId]` for the
report containing the match, driven off the session role already in the component.
Section/product anchoring is a later refinement, not a correctness gate.

### 5. Procedure boundaries (role-coverage-gate)

The search procedure authorizes `published` for viewer (a safe subset for
head/admin). The latest-published resolver and any new query use a canonical
builder that includes viewer (`leadershipProcedure` = head/admin/viewer or
`viewerProcedure`) — verified to exist — never a widened or ad-hoc chain.

### 6. Group-content-aware latest-published via `/reports/latest`

`NAV_LINKS` is a static `href` array and does no data fetching. Add a thin
`/reports/latest` route that server-resolves the latest published report **with at
least one viewer-visible product** (the period-published check alone is
insufficient — a department-wide Report can have zero viewer-visible products) and
307-redirects to `/reports/[reportId]`, or renders the empty state when none. The
viewer nav link points at the static `/reports/latest`. This solves both nav
resolution and the group-content gap in one place.

### 7. Viewer report shell (toolbar parity + slides fix)

Build a viewer report shell — the read-only analogue of `HeadReportShell` — that
composes `ReportToolbar` through the page `toolbar` slot, carries URL-backed scope
(`ScopeToggle`) and view-mode (`ViewModeToggle`, `?mode=slides` → `…SlidesClient`),
and keeps Export-PDF. `canMutatePeriod` (head/admin only) keeps Publish & Lock /
Reopen / Move-to-archive off the viewer. This also makes the existing `/present`
redirect render real slides.

### 8. Audit parity for search

`scopeAccessed` is currently emitted only from `weeklyReport.get`; search emits
only `scopeDenied`. To keep the cross-group read invariant, emit `scopeAccessed`
from the search path on a viewer cross-group hit. (Alternative: state search is
unaudited — rejected, it would silently weaken `scope-accessed-audit`.)

## Risks / Trade-offs

- [Published/group filter leaks unpublished or out-of-group rows] → both the Report
  publish predicate and the GroupProduct group filter applied server-side; tests for
  unpublished-excluded, out-of-group-excluded, and search==report visibility.
- [Latest-published opens a report with no viewer content] → resolver is
  group-content-aware, not merely period-published; empty state when none.
- [Viewer shell drifts from head shell] → reuse the same `report-shell` primitives
  (`ReportToolbar`, `ScopeToggle`, `ViewModeToggle`), not new ones.
- [Scope type change ripples widely] → enumerated in task 1.1 (shared enum, repo
  signature, in-memory fake, component prop).

## Migration Plan

Additive: a new scope value, a new route, a viewer shell, a viewer nav link. No
schema change, no data migration. Rollback = revert the change set; the prior
viewer surface is restored with no residual state.

## Open Questions

- Exact published column/state on `Report` (`periodState` vs `periodStatus`) —
  confirm against the schema at implementation.
- Whether the viewer shell is a distinct component or a parameterization of the
  head shell with mutations disabled (prefer a distinct read-only shell to avoid
  accidental mutation-control exposure).
