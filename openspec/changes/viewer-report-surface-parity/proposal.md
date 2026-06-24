## Why

A viewer (reviewer) opens `/reports` and sees only a list of History cards with
no search box and no obvious way into a report — unlike the lead and head
surfaces. The compiled report is in fact already reachable (the History cards
link to `/reports/[reportId]`), but the surface hides it: there is no search, no
direct entry to the current published report, and the cards do not read as
openable. The viewer's job is to **view and present** what the head has
published, read-only. The surface should make that obvious.

## What Changes

- Give the viewer a primary navigation entry to the **latest published report
  that contains content the viewer can see**, via a server-resolved
  `/reports/latest` redirect; empty state when none. History stays.
- Add **search** for the viewer under a new `published` scope: published content
  only, scoped to the viewer's accessible products through the **same group join
  the report path uses** (not the legacy `reportingGroupId` author join), so a
  search hit can never reveal a product the viewer's report would hide. Product
  (`project`) hits are excluded for the viewer in v1 (no product publish state,
  and they route to admin, which the viewer cannot reach). Hits route to
  `/reports/[reportId]`.
- Build a **viewer report shell** (the analogue of `HeadReportShell` minus
  mutations) so the viewer gets the product/lead scope toggle and the slides
  (present) mode; this also fixes the currently-inert `?mode=slides` / `/present`
  deep link, which redirects but renders nothing today. Export-PDF stays. Publish
  & Lock, Reopen, and Move-to-archive never render for a viewer.

Net effect: the viewer surface becomes "head minus the Dashboard and minus any
mutation", read-only.

## Non-goals

- No editing, publishing, or lifecycle action for the viewer — read-only stays.
- No Dashboard for the viewer.
- No exposure of unpublished content: the published-only server gate
  (`head-report-visibility`) stays in force; an unpublished period still 404s.
- The shared report renderer (`WeeklyReportPage`) is reused, not rewritten.
- The head, lead, and admin surfaces are not changed.
- Product/`project` search results for the viewer are out of scope in v1.

## Capabilities

### New Capabilities

- `viewer-published-search`: viewer search restricted to published reports and to
  products the viewer can see through the report group join, with viewer-safe
  result routing and cross-group reads audited consistently with the report path.
- `viewer-report-navigation`: viewer primary entry to the latest published report
  that has viewer-visible content, published-gated, with an empty state and
  History retained.

### Modified Capabilities

- `report-toolbar-parity`: the toolbar container requirement is extended to a new
  viewer report shell, and the viewer toolbar gains the head control set
  (product/lead scope toggle, slides mode, Export-PDF) minus all mutation
  controls.

## Impact

- Frontend: `reports/page.tsx` (search scope), `nav-bar.tsx` (viewer link to
  `/reports/latest`), a new `reports/latest` route, a new viewer report shell
  wrapping `WeeklyReportPage` with URL-backed scope/mode, `search-input.tsx`
  (viewer result routing + `project` exclusion), the `/present` route now resolves
  to working slides.
- Backend: `search.service.ts` + `search.prisma-repository.ts` gain a `published`
  scope (Report-join + publish predicate) and a GroupProduct-consistent group
  filter; a group-content-aware latest-published resolver. New tRPC procedures use
  the canonical role builders (`role-coverage-gate`).
- Shared: `searchQueryInputSchema` scope enum, the `SearchRepository` signature,
  the in-memory search fake, and the `SearchInput` `Scope` type all gain
  `published`.
- Audit: search currently emits only `scopeDenied`; to keep parity with the report
  path this change emits `scopeAccessed` on a viewer cross-group search hit
  (`scope-accessed-audit`).
- Reverses the documented "viewers get no raw search" decision in
  `search.service.ts` intentionally and replaces it with the published scope.
