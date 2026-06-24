## 1. Backend — published search scope

- [x] 1.1 Add `published` to the scope enum across all sites: `searchQueryInputSchema` in `@customreport/shared`, the `SearchRepository.search` signature (service interface + Prisma impl), and the in-memory search fake. (Web `Scope` type → task 4.1/4.2)
- [x] 1.2 Add an `INNER JOIN "Report"` (via `rs."reportId"`) with predicate `Report."periodStatus" = 'published'::"PeriodStatus"` to the item/risk/decision chunks in `search.prisma-repository.ts` for the `published` scope (RESOLVED: `periodStatus`, matching the viewer read gate — NOT `status`, NOT `periodState`)
- [x] 1.3 KEEP the existing `sectionGroupFilter` (author `reportingGroupId`) unchanged — it already matches the viewer's content read visibility. Did NOT switch to GroupProduct (would diverge — design Decision 2)
- [x] 1.4 Authorize `published` for every role in the scope authorization switch (it can only surface published, group-scoped content); kept `all` head/admin-only — no new guard needed since the gate only blocks `all`
- [x] 1.5 Exclude `"project"` hits for the viewer (extended the existing lead `excludeTypes` logic to `lead || viewer`)
- [x] 1.6 RESOLVED no-op (design Decision 8): `scopeAccessed` is defined over cross-group **products** via the `GroupProduct` join; search uses neither (author-group filter + project excluded for viewer), so a viewer search can never produce a cross-group access — there is no triggering condition. `scopeDenied` on a forbidden scope remains.
- [x] 1.7 Tests: service-layer (`search.service.test.ts`) — published forwarded for viewer, project excluded for viewer, empty-access viewer; SQL-layer integration (`search.prisma-repository.scope-filter.integration.test.ts`) — published+in-group returned, unpublished excluded, **reopened excluded (proves periodStatus not status)**, out-of-group excluded, exact read-parity, both-groups, and `all` still surfaces unpublished (gate is scope-specific). Teeth verified by mutation (neutralizing the join → 4 red).

## 2. Backend — group-content-aware latest published

- [x] 2.1 Added `reports.latestPublished` (`anyRoleProcedure`) — gates on `periodStatus='published'` (the openable column, NOT list `status`) + `sections.some(sectionScope)` reusing `compiledHistory`'s group filter; `orderBy periodStart desc`; returns `{ reportId }` or `{ reportId: null }`. Shared `latestPublishedReportSchema`.
- [x] 2.2 Tests (`reports-latest-published.test.ts`, stub-prisma + createCaller): correct where (periodStatus + group section filter) ordered newest-first; null empty-state; no-access viewer → zero-row filter; lead → own authored sections; admin → no group filter. (SQL group-visibility itself covered by the group-1 integration test.)

## 3. Frontend — `/reports/latest` route + nav entry

- [x] 3.1 Added `reports/latest/page.tsx`. DEVIATION (recorded, advisor-confirmed): a CLIENT component with `router.replace`, not a server `redirect()` — the web app has NO server-side data path (every read is browser-cookie tRPC; nothing uses `next/headers`). The "307 not 308" requirement encodes "re-resolve every visit, never permanent-cache", which `router.replace` satisfies; `replace` (not `push`) also avoids the Back-button redirect loop. Renders the empty state on null; reachable by any /reports role.
- [x] 3.2 Added a viewer-only `/reports/latest` NAV_LINK ("Latest") before the viewer History link + a `NavIcon` case; `isActiveLink` default `startsWith` covers it (no branch needed). Tests: viewer sees Latest, non-viewers don't.

## 4. Frontend — viewer search

- [x] 4.1 `reports/page.tsx`: viewer `searchScope` now `published` (was `null` → SearchInput renders); viewer placeholder "Search published reports…"
- [x] 4.2 `search-input.tsx`: threaded `useSession`; `targetUrlFor(hit, isViewer)` routes viewer item/risk/decision to `/reports/[reportId]` (never `/lead/report` or `/admin`); viewer project hits filtered client-side (defensive) + dead-ended. Web `Scope` type widened to include `published` (the 5th lockstep site from 1.1). Tests: viewer→/reports routing, project suppressed, published forwarded.
- [x] 4.3 Empty viewer access → empty results: enforced server-side (groupIds `[]` → early empty, `search.service.ts`) and covered by the existing service test; no client leak path.

## 5. Frontend — viewer report shell (toolbar parity + slides)

- [x] 5.1 Built `components/viewer/viewer-report-shell.tsx` (read-only analogue of `HeadReportShell`) composing `ReportToolbar` via WeeklyReportPage's `contextControls` slot, URL-backed scope (`?scope=lead`) + view-mode (`?mode=slides`). `/reports/[reportId]/page.tsx` now a server component rendering it.
- [x] 5.2 Wired `ScopeToggle` (product/lead) + `ViewModeToggle` (URLs → `/reports/...`, slides → `HeadSlidesClient` with `enableActivity={false}` since `activity.live` is head-only); Export-PDF kept (real export for viewer).
- [x] 5.3 No mutation affordance: omitted `HeadPublishLockAction`; `WeeklyReportPage` already gates Publish/Reopen/Move-to-archive on `canMutatePeriod` (head/admin). Test asserts no publish/lock/reopen button in form OR slides.
- [x] 5.4 `?mode=slides` now resolved by the shell → real slides; the existing `/present` `permanentRedirect` to `?mode=slides` therefore renders the deck (was inert). DEVIATION: reused `HeadSlidesClient` (parameterized) rather than a net-new `ViewerSlidesClient` — avoids duplicating ~120 lines of slide-building.
- [x] 5.5 Control set stable across edit/slides (same `contextControls` row in both; one shared `ReportToolbar`). Covered by `viewer-report-shell.test.tsx` (6 tests).

## 6. Verification

- [x] 6.1 Live-verify as a viewer (dev role switch): search returns published-only, group-scoped hits matching report visibility; `/reports/latest` opens the latest visible published report; slides present; unpublished period still 404s — VERIFIED 2026-06-25 (read-only Playwright pass against the running dev app + existing seed): viewer search returned 12 published item hits routing to `/reports/[id]`; `/reports/latest` redirected to the newest published report; `?mode=slides` rendered the deck with NO forbidden `activity.live` query and no mutation control; the open period 404'd ("Report not found"); the ViewModeToggle showed "Report" not "Edit". Nav avatar derived "ВД" from the structured parts; admin Users tab showed the Position column + short-form names + the Last/First/Middle/Position edit form (change A 11.3).
- [x] 6.2 Gates green: `pnpm typecheck` (5/5), `pnpm lint` (clean), `pnpm test` (shared 300 / api 959 / web 1279), `pnpm build` (5/5). Search published-gate integration test 7/7 (teeth proven by mutation). `_test` DB `migrate reset` applied for change A's columns.
- [x] 6.3 `openspec validate "viewer-report-surface-parity" --strict` → valid
