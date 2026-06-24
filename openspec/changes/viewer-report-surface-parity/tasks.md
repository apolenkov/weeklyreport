## 1. Backend — published search scope

- [ ] 1.1 Add `published` to the scope enum across all sites: `searchQueryInputSchema` in `@customreport/shared`, the `SearchRepository.search` signature, the in-memory search fake, and the `SearchInput` `Scope` type
- [ ] 1.2 Add an `INNER JOIN "Report"` with a published predicate (confirm `periodState`/`periodStatus` column) to each text chunk in `search.prisma-repository.ts` for the `published` scope
- [ ] 1.3 Route the viewer `published` group filter through the same GroupProduct-based access the report path uses — NOT `User.reportingGroupId` (the leak fix)
- [ ] 1.4 Authorize `published` for viewer (safe subset for head/admin) in the scope authorization switch; keep `all` head/admin-only
- [ ] 1.5 Exclude `"project"` hits for the viewer (extend the existing `excludeTypes` logic)
- [ ] 1.6 Emit `scopeAccessed` from the search path on a viewer cross-group hit, consistent with `weeklyReport.get`
- [ ] 1.7 Tests: viewer published match returned; unpublished excluded; out-of-group excluded; search visibility == report visibility for a product; no-access viewer empty; `project` excluded; `all` still forbidden for viewer

## 2. Backend — group-content-aware latest published

- [ ] 2.1 Add a resolver (canonical viewer-inclusive builder per `role-coverage-gate`) returning the latest published report that has at least one viewer-visible product, or none
- [ ] 2.2 Tests: returns latest report with viewer-visible content; skips a published report with no viewer-visible product; returns none when no qualifying report; never returns an unpublished period

## 3. Frontend — `/reports/latest` route + nav entry

- [ ] 3.1 Add a `reports/latest` route that calls the resolver and `307`-redirects (`redirect()`, not `permanentRedirect()` — target is dynamic) to `/reports/[reportId]`, or renders the empty state when none. The route is reachable by any `/reports`-eligible role (lead/head/admin/viewer); it resolves the same published, group-scoped content for all of them (a lead hitting it is harmless)
- [ ] 3.2 Add a viewer nav link in `nav-bar.tsx` to the static `/reports/latest`, alongside the existing viewer "History" link; do not point at `/head/report`

## 4. Frontend — viewer search

- [ ] 4.1 In `reports/page.tsx`, set the viewer `searchScope` to `published` and render `SearchInput` for the viewer
- [ ] 4.2 In `search-input.tsx`, rewrite non-excluded result targets to `/reports/[reportId]` when the role is viewer (never `/lead/report/...` or `/admin...`); suppress `project` results for the viewer
- [ ] 4.3 Empty viewer access → empty results surface (no other-group leakage)

## 5. Frontend — viewer report shell (toolbar parity + slides)

- [ ] 5.1 Build a viewer report shell (read-only analogue of `HeadReportShell`) composing `ReportToolbar` through the page `toolbar` slot, with URL-backed scope and view-mode
- [ ] 5.2 Wire the product/lead `ScopeToggle` and the `ViewModeToggle` (`?mode=slides` → `…SlidesClient`) for the viewer; keep Export-PDF
- [ ] 5.3 Confirm Publish & Lock / Reopen / Move-to-archive never render for the viewer (driven by `canMutatePeriod`)
- [ ] 5.4 Verify the `/present` redirect and `?mode=slides` render real slides for the viewer (fixes the current inert deep link)
- [ ] 5.5 Verify the viewer control set is stable across edit/slides modes and uses the shared toolbar container

## 6. Verification

- [ ] 6.1 Live-verify as a viewer (dev role switch): search returns published-only, group-scoped hits matching report visibility; `/reports/latest` opens the latest visible published report; slides present; unpublished period still 404s
- [ ] 6.2 Gates green: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- [ ] 6.3 `openspec validate "viewer-report-surface-parity" --strict` clean
