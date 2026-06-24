## Context

The viewer surface today is `/reports` (compiled History) plus the reachable but
under-advertised `/reports/[reportId]` read-only report. `reports/page.tsx` sets
`searchScope = null` for a viewer, so no search input renders. `search.service.ts`
forbids `scope="all"` and returns empty for `scope="mine"` for a viewer. The
compiled report renderer (`WeeklyReportPage`) is already shared, with mutation
affordances gated by role. The published-only gate (`head-report-visibility`)
404s a viewer on an unpublished period.

Adversarial review surfaced three load-bearing facts the first draft missed:

- Search has NO published-report predicate today, so a viewer `published` scope
  would otherwise match content in unpublished/reopened periods it cannot read.
  This — not the group join — is the real divergence to fix (see Decision 2, which
  phase-0 verification reversed: the existing author-group join already matches the
  viewer's content visibility).
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
gains an `INNER JOIN "Report"` (via `rs."reportId"` on the item/risk/decision
chunks) with the published predicate **`Report."periodStatus" = 'published'`**
— RESOLVED 2026-06-24. `periodStatus` is the exact column the viewer content-read
gate uses (`weekly-report.service.ts:130` throws NOT_FOUND when
`periodStatus !== 'published'`; the snapshot is also selected on
`periodStatus === 'published'`). `Report.status` is the report-LIST column
(`compiledHistory`) and can stay `'published'` while a reopened period's
`periodStatus = 'reopened'` makes the content unreadable — so `status` would leak;
`periodState` is the separate archive lifecycle, not a publish gate. Chosen over a
`publishedOnly` flag on `all`: a distinct scope name is explicit and enforceable in
the authorization switch, with no default-off leak risk.

### 2. KEEP the author-group filter — it already matches report visibility (RESOLVED 2026-06-24, reverses the first draft)

Phase-0 verification against current code reverses this decision. The viewer's
searchable hits are `item`/`risk`/`decision` only (the `project` chunk is excluded
— Decision 3). All three are gated in `search.prisma-repository.ts` (lines
142/167/187) by `sectionGroupFilter` = `rs."authorId" IN (User WHERE
reportingGroupId IN …)` — the **section author's** group. The report read path
gates the SAME content the SAME way: `getWeeklyReport` filters `sections` by
`author.reportingGroupId` (`weekly-report.prisma-repository.ts:94`), and
item/risk/decision render inside those sections. The GroupProduct join the report
path uses applies ONLY to the **product portfolio** axis
(`useExplicitGroupProducts`, repo:86-88) — and product hits are excluded for the
viewer. So the existing author-group join in search ALREADY equals the viewer's
content visibility; switching it to GroupProduct would make search DIVERGE from the
read (hiding items the viewer can see in the report). **KEEP `sectionGroupFilter`
unchanged.** The leak the first draft conflated with the group axis is the missing
publish gate (Decision 1). A regression test MUST assert: a viewer match in an
unpublished/reopened period is excluded, and a match authored outside the viewer's
group(s) is excluded.

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

### 8. Audit parity for search — RESOLVED 2026-06-24: no emission (vacuous for search)

The first draft proposed emitting `scopeAccessed` from the search path on a
viewer cross-group hit. Phase-0 verification + the Decision 2 reversal make this
**vacuous**, so search emits nothing:

- `scope-accessed-audit` defines a cross-group access narrowly: a **product**
  whose owner group is outside the caller's groups that surfaces **via the
  explicit `GroupProduct` join** (`scope-accessed-audit/spec.md`; the
  `crossGroup` signal in `weekly-report.scope-filter.integration.test.ts`).
- Search does NOT use `GroupProduct` at all — it gates item/risk/decision on the
  section author's `reportingGroupId` (Decision 2). With that filter, a viewer's
  search can never return a row authored outside their groups, so there is no
  cross-group access to audit.
- The viewer's only product-axis hit (`project`) is excluded entirely
  (Decision 3), so no product surfaces through search to a viewer.

Therefore the `scopeAccessed` event — defined over cross-group _products_ via
`GroupProduct` — has no triggering condition in the search path. Emitting a
synthetic/reduced event would be a false audit entry (no cross-group access
occurred) and the typed payload (`productIds`/`groupIds`) has no value to carry.
`scopeDenied` on a forbidden scope remains. This is consistent with Decision 2:
search and the report read legitimately differ on the product/audit axis because
search exposes no products to the viewer. (Alternative — widen the repository
return shape to fabricate a cross-group signal — rejected as misleading.)

## Risks / Trade-offs

- [Published/group filter leaks unpublished or out-of-group rows] → the Report
  `periodStatus='published'` predicate plus the existing author-group filter applied
  server-side; tests for unpublished/reopened-excluded, out-of-group-excluded, and
  search==report content visibility (author-group basis, per Decision 2).
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

- ~~Exact published column/state on `Report`~~ — RESOLVED 2026-06-24:
  `periodStatus = 'published'` (Decision 1). Not `status` (list-only), not
  `periodState` (archive lifecycle).
- ~~Whether to route search groups through GroupProduct~~ — RESOLVED 2026-06-24:
  KEEP the author-group join (Decision 2); GroupProduct would diverge from the
  viewer's content read path.
- Whether the viewer shell is a distinct component or a parameterization of the
  head shell with mutations disabled (prefer a distinct read-only shell to avoid
  accidental mutation-control exposure).
- Pre-existing (out of scope, flag only): on reopen, `compiledHistory` (filters
  `status`) and the content-read gate (`periodStatus`) can disagree — a viewer may
  see a reopened report in `/reports` yet get NOT_FOUND opening it.
