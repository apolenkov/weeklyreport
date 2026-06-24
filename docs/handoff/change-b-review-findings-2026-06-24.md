# Change B adversarial review — confirmed findings (2026-06-24)

Source: background Workflow over HEAD (commit 9f64aea). 13 agents, 9 confirmed.

## [P1] Published search joins LIVE item/risk/decision rows but the viewer content read serves the FROZEN publish snapshot — a viewer's search snippet can reveal content absent from the report they can open

- **file:** apps/api/src/modules/search/search.prisma-repository.ts:107-110 (publishedReportJoin); apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts:146-194 (snapshot read branch); apps/api/src/modules/report-sections/lead-form.service.ts:51-77 (fillFrom, no published guard)
- **why:** The new `published` search scope gates ONLY on `Report.periodStatus='published'` and matches live Item/Risk/Decision rows via `INNER JOIN ReportSection rs`. The viewer content read (`weeklyReport.get`) for a published period does NOT read live rows — it returns `report.publishedSnapshot`, frozen at publish time (weekly-report.prisma-repository.ts:146 `if (snapshot && periodStatus === 'published') ... leadSections = scopedSnapshot.sections`). These two diverge whenever a published report's live items change after the snapshot was taken. `saveDraft` blocks edits on published reports (report-sections.service.ts:127 'Cannot edit sections of a published report'), but `fillFrom` does NOT: it guards only on `target.status === 'submitted'` (lead-form.service.ts:66), so a lead can run Fill-From on a DRAFT section. A published report legitimately contains draft sections (publish requires only >=1 submitted section: weekly-report-page.tsx `canPublishReport = submitted > 0`, hint 'Publish requires at least one submitted section'). The snapshot captures all sections including drafts (reportFullIncludeForSnapshot has no status `where`), so the draft section's items are searchable. Chain: report published -> snapshot freezes draft section S's items -> lead A runs fillFrom on S (passes the not-submitted guard) -> S's live Item/Risk/Decision rows are deleteMany+createMany'd with NO re-snapshot -> viewer published search now matches the NEW live items and renders their text in the snippet, while the viewer opening `/reports/<id>` sees the OLD frozen snapshot. The snippet itself discloses the content, so the leak fires even though the click-through report hides it. Change B introduces this exposure: before B viewers had no search, so no surface read live rows under a published gate. This violates the stated invariant: a viewer must never see content it cannot read in the report.
- **fix:** Make the search snippet source agree with what the viewer can actually open. Preferred: stop searching live Item/Risk/Decision rows for the `published` scope and instead search the frozen snapshot content (e.g. an FTS column derived from `publishedSnapshot`, or persist searchable snapshot rows on publish). If keeping the live-table search, add the same section-level gate the snapshot effectively imposes: only surface rows whose section was part of the published snapshot AND has not diverged — at minimum restrict the publishedReportJoin to submitted sections (`AND rs."status" = 'submitted'`) so the only mutate-after-publish path (fillFrom on a draft section) cannot leak; AND close the root cause by adding a published-report guard to `fillFrom` (reject when `getReportStatus(reportId) === 'published'`, mirroring saveDraft). Add an integration test: publish a report with a draft section, fillFrom that section, assert the published search returns no snippet for content absent from the viewer's snapshot read.
- **verdict:** CONFIRMED real. Every link of the claimed chain verified against the committed HEAD diff, and the two decisive checks (reachability + source provenance) resolve in favor of the finding.

EVIDENCE:

1. Published search joins LIVE rows. search.prisma-repository.ts:108-110 — for scope='published' the only added gate is `INNER JOIN "Report" rpt ON rpt."id" = rs."reportId" AND rpt."periodStatus" = 'published'`. The item/risk/decision chunks then match LIVE Item/Risk/Decision rows (`FROM "Item" i INNER JOIN "ReportSection" rs ...`). The snippet is `ts_headline('russian', i."text", ...)` — the live row's current text.
2. Viewer can reach this scope. search.service.ts:79-84 — scope='published' is aut

## [P2] Published-scope regression net only covers Item; a dropped join from the Risk or Decision chunk would leak unpublished/reopened content uncaught

- **file:** apps/api/src/modules/search/search.prisma-repository.scope-filter.integration.test.ts:196-243
- **why:** The whole point of change B's published gate is that the INNER JOIN "Report" ... periodStatus='published' is applied to ALL THREE of the item/risk/decision chunks (search.prisma-repository.ts:152, :178, :199). The live code is correct today -- I read all three chunks and each carries ${publishedReportJoin}. But the integration test that pins this security invariant only seeds and asserts ITEM hits (ITEM_PUB_IN_GROUP, ITEM_OPEN_IN_GROUP, ITEM_REOPENED_IN_GROUP, ITEM_PUB_OUT_GROUP); the file header at line 14 even claims to cover 'item/risk/decision' but grep finds zero risk/decision fixtures or assertions. So the exact regression the change exists to prevent -- a future edit removing the join from the risk or decision chunk -- would leak unpublished or reopened risks/decisions to a viewer and NO test would fail. This is a hole in the safety net on the security-critical invariant, not a shipped leak.
- **fix:** Extend the integration test to seed a Risk and a Decision under each of the published, open, and reopened reports (reusing the existing makeReport/makeSection helpers), then assert publishedSearch([GROUP_A_ID]) returns the published risk+decision and excludes the open and reopened ones -- mirroring the existing item assertions at lines 196-227 for all three entity types.
- **verdict:** CONFIRMED. Verified from `git show HEAD:<path>`.

Live code is correct (no shipped leak): in search.prisma-repository.ts the `${publishedReportJoin}` (INNER JOIN "Report" ... periodStatus='published') is interpolated into ALL THREE chunks — item (line 155), risk (line 181), decision (line 202), built once at line 107-109.

The gap is in the regression net. search.prisma-repository.scope-filter.integration.test.ts is the ONLY integration test that exercises this SQL join (search.service.test.ts is a mock-based unit test with zero references to periodStatus/INNER JOIN). The integration file:

- Its header (lines 14-15) explicitly claims to cover "item/risk/decision content."
- But grep for risk

## [P2] Published-gate integration test covers only Item; Risk and Decision chunks have zero teeth

- **file:** apps/api/src/modules/search/search.prisma-repository.scope-filter.integration.test.ts:90-118
- **why:** The publish+group gate is the security invariant (search visibility must equal report-read visibility). The integration suite proves real teeth (reopened-excluded, out-of-group-excluded, exact-parity, scope-specificity) but ONLY for the Item chunk: createItem is the sole fixture, no Risk or Decision row is ever inserted (the two grep hits for 'risk'/'decision' are in the doc comment, not fixtures). The Risk and Decision chunks in search.prisma-repository.ts splice the IDENTICAL ${publishedReportJoin} and ${sectionGroupFilter} against valid rs aliases (both INNER JOIN ReportSection rs), so the code is correct today. But a future dropped splice on either chunk -- e.g. omitting ${publishedReportJoin} on the Risk chunk -- would leak reopened/unpublished risk content to a viewer and ALL tests would still pass. The author's mutation-proof of teeth only validated the Item path.
- **fix:** Add fixtures and assertions mirroring the Item cases for Risk and Decision: insert a risk and a decision in the published-in-group, open, reopened, and out-of-group sections, then assert published-scope search returns exactly the published-in-group risk/decision and excludes the open/reopened/out-of-group ones. The exact-parity test should assert the full expected id set across all three content types.
- **verdict:** CONFIRMED real. Verified directly from `git show HEAD:<path>`.

Evidence in the integration test (search.prisma-repository.scope-filter.integration.test.ts):

- The only fixture creator is `createItem` (line 85, `prisma.item.create`). Items are inserted at lines 173-176.
- No `prisma.risk.create` or `prisma.decision.create` exists anywhere in the file. The only `risk`/`decision` mentions are in the doc comment (lines 14-15), exactly as the finding claims.
- Every teeth-bearing assertion constrains only the Item chunk: reopened-excluded (`not.toContain(ITEM_REOPENED_IN_GROUP)`), out-of-group-excluded (`not.toContain(ITEM_PUB_OUT_GROUP)`), the publish gate, and the exact-parity `toEqual([ITEM_P

## [P3] latestPublished lead branch (authorId) is narrower than what a lead can actually open — minor UX gap, intended-by-design, NOT a leak

- **file:** apps/api/src/infrastructure/trpc/trpc.router.ts:561-566
- **why:** For role==='lead', latestPublished uses sectionScope={authorId: ctx.session.userId}, so it only finds the latest published report in which the lead PERSONALLY authored a section. The destination weeklyReport.get, however, scopes a lead via groupScopeFilter (scopeWhere in weekly-report.prisma-repository.ts:65 -> {author:{reportingGroupId:{in:[lead group]}}}), i.e. the lead can open the WHOLE group's published report. Consequence: if the lead's group has a newer published report in which the lead authored no section, latestPublished returns null (or an older report) for that lead even though they are permitted to open the newer one. This is a usability mismatch only. It is NOT a security leak: the filter is strictly narrower than the lead's permission (no over-broad match), and any report it does return contains the lead's own section, which weeklyReport.get's group filter always includes. It is also locked as intended by the resolver comment ('a lead resolves their own latest published section') and the test 'a lead resolves their own authored sections, not a group filter' (reports-latest-published.test.ts:108). Leads also receive no '/reports/latest' nav link (nav-bar.tsx link is roles:['viewer'] only), so the surface is barely reachable for leads. Reported only for completeness.
- **fix:** No change required for security. If lead/latest parity is ever wanted, switch the lead branch to reuse groupScopeFilter(ctx.session,'reportSection') like compiledHistory, matching weeklyReport.get's lead visibility. Otherwise leave as-is and keep the comment/test that mark it intended.
- **verdict:** CONFIRMED — the finding accurately reads the committed code and correctly classifies this as a minor UX gap, NOT a leak. Setting isReal=true per the task's own binary: isReal=false is reserved for a MISREAD of the code; this is not a misread. The intentionality is already priced into the P3 severity.

All six load-bearing claims verified against `git show HEAD:<path>`:

1. latestPublished lead branch uses the narrower `{ authorId: ctx.session.userId }` — apps/api/src/infrastructure/trpc/trpc.router.ts:561-563 (the ternary: role==='lead' ? {authorId} : groupScopeFilter(...,'reportSection')).

2. weeklyReport.get's lead scope = groupScopeFilter(session,'reportSection') = `{ author: { reporting

## [P3] ViewModeToggle shows an 'Edit'/Pencil segment on the read-only viewer report surface

- **file:** apps/web/src/components/viewer/viewer-report-shell.tsx:182-186 (ViewModeToggle with editHref, mode mapping); apps/web/src/components/report-shell/view-mode-toggle.tsx:30-37
- **why:** ViewerReportShell reuses the shared `ViewModeToggle`, whose non-slides segment is labeled 'Edit' with a Pencil icon (aria-label 'Edit', title 'Edit', sr-only 'Edit'). The viewer surface is strictly read-only — there is no editing. The control toggles between form (read) and slides views, so the 'Edit'/Pencil affordance is misleading copy for a viewer and an inaccurate accessible name for screen-reader users.
- **fix:** Parameterize ViewModeToggle's first-segment label/icon/aria (e.g. a `formLabel`/`readLabel` prop, default 'Edit' for the head) and pass a neutral 'Report'/'Document' label with a non-pencil icon from ViewerReportShell. Keep the head surface unchanged. No functional change, copy/a11y only.
- **verdict:** Confirmed from the committed diff (HEAD 9f64aea).

The shared ViewModeToggle (apps/web/src/components/report-shell/view-mode-toggle.tsx:30-37) hardcodes the non-slides segment as an "Edit" affordance: title="Edit", a Pencil icon (aria-hidden), and <span className="sr-only">Edit</span>. There is no prop to relabel it; mode/editHref/slidesHref are the only inputs.

ViewerReportShell reuses it as-is (apps/web/src/components/viewer/viewer-report-shell.tsx:175-178) with mode={mode === "slides" ? "slides" : "edit"}. Its editHref (line 134) is `/reports/{reportId}` with mode:null — the read-only document view, NOT an editor. The non-slides branch (lines 211-221) renders WeeklyReportPage, a read-onl

## [P3] viewer-report-shell 'NO mutation control' assertion is partly vacuous and partly out-of-scope

- **file:** apps/web/src/components/viewer/viewer-report-shell.test.tsx:166-176
- **why:** The test claims to prove the viewer shell renders no mutation affordance, but its teeth are weak on both halves. (a) queryByTestId('head-publish-lock-action-stub') tests a testid that never exists in this render tree: ViewerReportShell does not import or render HeadPublishLockAction, and the test mocks no such component, so the stub id could never appear -- the assertion is a tautology that would pass even if a real publish control were added. (b) The queryByRole('button', {name:/publish|lock|reopen/i}) assertion only covers the shell's OWN markup, because WeeklyReportPage is fully stubbed (renders just a header + toolbar with the passed-in slots). The actual 'a viewer cannot mutate' guarantee rides on WeeklyReportPage's canMutatePeriod head/admin gate, whose coverage lives outside this diff. So a regression where the viewer shell passes a prop that flips WeeklyReportPage into a mutating mode would not be caught here.
- **fix:** Replace the vacuous testid check with an assertion grounded in something real (e.g. assert ViewerReportShell never passes a canMutate/role prop that would enable mutation, or assert the absence of the actual HeadPublishLockAction import path). Add a test that renders ViewerReportShell with the REAL WeeklyReportPage (or a faithful stub that honors canMutatePeriod) to prove the viewer role yields no Publish/Reopen/Move-to-archive control end to end.
- **verdict:** PARTIALLY CONFIRMED, but downgraded P2 to P3 — the finding's factual core (one vacuous assertion) is real, yet its load-bearing consequence and proposed fix are wrong.

Half (a) is TRUE and verifiable. apps/web/src/components/viewer/viewer-report-shell.test.tsx:173-175 asserts `queryByTestId('head-publish-lock-action-stub')` is absent. That testid is defined ONLY inside head-report-shell.test.tsx:30-32, where THAT test does `vi.mock('../weekly-report/head-publish-lock-action', ...)`. The viewer test does NOT mock that module, and ViewerReportShell (viewer-report-shell.tsx) never imports HeadPublishLockAction (confirmed via git grep: it appears only in head-report-shell.tsx:24,272 and the she

## [P3] HeadSlidesClient enableActivity gating has no direct test; only the prop pass-through is asserted

- **file:** apps/web/src/components/viewer/viewer-report-shell.test.tsx:178-190
- **why:** The viewer-shell test stubs HeadSlidesClient entirely and only asserts data-enable-activity='false' is passed. The actual gating logic added in head-slides-client.tsx -- enabled: enableActivity on the activity.live query, the `if (!enableActivity) return []` slide memo, and the enableActivity-guarded isLoading/isError branches -- is never exercised by any test. activity.live is a head-only (FORBIDDEN-for-viewer) procedure; a regression that re-enables it for the viewer (e.g. dropping the `enabled` flag) would fire a forbidden query and not be caught.
- **fix:** Add a unit test on HeadSlidesClient itself: render with enableActivity={false}, assert the activity.live query is created with enabled:false (or not fired) and that no activity-derived slides/fallback render; render with the default to confirm head behavior is unchanged.
- **verdict:** Confirmed against the committed code. The gating logic exists exactly as described in apps/web/src/components/slides/head-slides-client.tsx (the file is under slides/, not head/, but the diff is the same): line 70 `enabled: enableActivity` on the activity.live query, line 92 `if (!enableActivity) return []` in the slides memo, and lines 103/107 the `enableActivity && activityQ.isLoading`/`isError` guards. The viewer test at apps/web/src/components/viewer/viewer-report-shell.test.tsx fully mocks HeadSlidesClient (lines 16-23) with a stub that only echoes `data-enable-activity`, and the sole related assertion (line 201) checks `data-enable-activity === "false"` — pure prop pass-through. I conf

## [P3] reports.latestPublished gate is pinned only against stub-prisma; the SQL is never exercised

- **file:** apps/api/src/infrastructure/trpc/reports-latest-published.test.ts:53-148
- **why:** The test asserts the findFirst where-clause shape correctly (periodStatus:'published' not status, sections.some group/author/admin filter, orderBy periodStart desc, select id) -- those assertions are real and would fail if the column or filter were wrong. But prisma.report.findFirst is a vi.fn returning a canned object, so the actual Prisma relation path is never run against Postgres. A typo in the relation path (e.g. author vs authorId, or a wrong relation name) that still type-checks would pass this test yet fail or mis-scope at runtime. Note the asymmetry: the parallel search publish gate HAS an integration test; this equally security-relevant redirect gate does not.
- **fix:** Add an integration test (using the same prisma-test-helper as the search suite) that seeds published/open/reopened reports with in-group and out-of-group sections and asserts latestPublished resolves the newest published in-group report id and null when none qualify -- proving the relation path executes correctly on Postgres.
- **verdict:** VERDICT: Real but overstated; the defensible kernel is a P3 test-coverage gap, not the typo-escape the finding leads with.

Verified against the committed diff:

1. The mock is real. reports-latest-published.test.ts:53 uses `vi.fn(() => Promise.resolve({ id: REPORT_ID }))` and buildCaller injects `{ prisma: { report: { findFirst } } }` (lines 25-39). No Postgres is touched. The asymmetry is also real: the same commit adds search.prisma-repository.scope-filter.integration.test.ts (246 lines, real DB) but no integration test for latestPublished.

2. The finding's HEADLINE reasoning is largely WRONG. It claims a relation-path typo (author vs authorId / wrong relation name) "that still type-chec

## [P3] Viewer redirect page, [reportId] server page, and reports/page viewer scope wiring have zero tests

- **file:** apps/web/src/app/(app)/reports/latest/page.tsx:23-37
- **why:** Three new viewer behaviors ship with no coverage. (1) /reports/latest: the useEffect router.replace(`/reports/${reportId}`) resolve, the isResolving status, and the error/empty-state branches are untested -- a regression that drops the replace or mishandles the null reportId would not be caught. (2) The [reportId] server page that now maps modeParam==='slides' and renders ViewerReportShell is untested. (3) reports/page.tsx wiring role==='viewer' -> scope='published' and the 'Search published reports...' placeholder has no test asserting the viewer gets the search input at all (previously null meant no input).
- **fix:** Add a focused test for the redirect page (mock latestPublished returning an id -> assert router.replace called with /reports/<id>; returning null -> assert the empty-state copy; isError -> assert the error copy). Add a small test asserting reports/page renders SearchInput with scope='published' for a viewer session. The server [reportId] page mode mapping can be covered by a thin render/prop assertion.
- **verdict:** Confirmed against the committed diff (git show HEAD:<path>). All three sub-claims hold:

(1) /reports/latest — `git ls-tree HEAD .../reports/latest/` shows only `page.tsx`, no test. The client redirect page (latest/page.tsx:23-63) has untested branches: the useEffect router.replace(`/reports/${reportId}`), `const isResolving = latestQ.isLoading || reportId !== null`, and the error/empty-state copy ("Could not load…" vs "No published report…"). A grep for `reports/latest|latestPublished|ReportsLatestPage|router.replace` across web \*.test.tsx returns nav-bar/head-report-shell/lead-form tests only — none exercise this page.

(2) [reportId] server page — page.tsx:28 maps `const mode = modeParam
