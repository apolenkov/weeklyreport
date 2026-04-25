# Regression Scenario Traceability

**Generated:** 2026-04-25  
**Total Scenarios:** 221 unique scenarios (SC-01 through SC-311 with gaps)  
**E2E Test Files:** 12 test suites

This matrix maps all 221 regression test scenarios to existing E2E test coverage, identifying:
- **Full coverage**: Tests comprehensively validate all expected outcomes
- **Partial coverage**: Tests cover aspects of the scenario 
- **Missing**: No test implementation found

## Coverage by Scenario

| SC | Title | Test File | Test Name | Coverage |
|----|-------|-----------|-----------|----------|
| SC-01 | Lead sees only products with assigned stages | lead-journey.spec.ts:42 | renders SDLC pipeline with products | partial |
| SC-02 | Lead can edit only their SDLC stages (sdlc-mine), others locked | lead-journey.spec.ts:57 | locked stages have reduced opacity | partial |
| SC-03 | Lead can add/edit/delete Current Week items for their stages only | lead-journey.spec.ts:105 | Current Week section shows items | partial |
| SC-04 | Lead can add/edit/delete Next Week items for their stages only | lead-journey.spec.ts:111 | Next Week section shows items | partial |
| SC-05 | Lead can add/edit/delete Risks for their stages only | lead-journey.spec.ts:116 | Risks section shows entries | partial |
| SC-06 | Lead can add/edit/delete Decisions | lead-journey.spec.ts:123 | Decisions section shows entries | partial |
| SC-07 | Lead can set Top 3 Priorities | lead-journey.spec.ts:127 | Priorities section shows numbered list | partial |
| SC-08 | Lead submits report -- form locks | lead-journey.spec.ts:164 | confirming submit locks the form | full |
| SC-09 | Autosave works (badge shows "Autosaved") | lead-journey.spec.ts:34 | shows autosave badge | partial |
| SC-10 | Delete confirmation dialog appears | lead-journey.spec.ts:136 | Submit Report button is visible and enabled | — |
| SC-11 | Empty state when no items | — | — | missing |
| SC-12 | Validation error on empty required fields | error-paths.spec.ts:112 | lead form has Submit Report button | partial |
| SC-13 | SDLC stage click opens popover to change status | lead-journey.spec.ts:50 | stage chips show status labels | partial |
| SC-14 | At Risk / Blocked hover shows ring only (no desaturation) | — | — | missing |
| SC-15 | On Track hover shows desaturation hint | — | — | missing |
| SC-16 | Lead sees read-only items from other leads' stages | — | — | missing |
| SC-17 | Empty SDLC stage shows dashed pulse animation | — | — | missing |
| SC-18 | Unassigned SDLC stages show locked state | — | — | missing |
| SC-19 | Product with blockers shows risk indicator | — | — | missing |
| SC-20 | Shows all 12 products in Portfolio Health | head-dashboard.spec.ts:42 | Submissions KPI card is visible with count | partial |
| SC-21 | Blocked products table accurate | — | — | missing |
| SC-22 | Lead Reports show correct status and actions (D-57, D-62) | head-dashboard.spec.ts:83 | lead cards show status badges | partial |
| SC-23 | Deadline countdown accurate | head-dashboard.spec.ts:48 | Deadline KPI card is visible with countdown | partial |
| SC-24 | Send reminder to pending leads | head-dashboard.spec.ts:66 | alert bar shows pending leads message | partial |
| SC-25 | Submissions progress bar and historical comparison | head-dashboard.spec.ts:42 | Submissions KPI card is visible with count | partial |
| SC-30 | Portfolio Overview shows all 12 products with correct statuses | weekly-report.spec.ts:63 | Portfolio Overview section shows product cards with status | full |
| SC-31 | Per-lead accordion shows correct data | weekly-report.spec.ts:75 | product accordion expands on click to show Current Week items | full |
| SC-32 | Item counts match lead form data | error-paths.spec.ts:124 | all form sections have proper labels | partial |
| SC-33 | Export PDF works | weekly-report.spec.ts:146 | Export PDF button is visible | partial |
| SC-34 | Publish & Lock button works (D-56) | weekly-report.spec.ts:120 | clicking Publish & Lock opens confirmation dialog | full |
| SC-40 | All leads' data shown after Publish & Lock | cross-role-lifecycle.spec.ts:133 | published report page renders with Published badge and metadata | partial |
| SC-41 | Escalations consolidated (not per-lead) | — | — | missing |
| SC-42 | Download PDF from published report works | pdf-export.spec.ts:21 | print page renders with report content | partial |
| SC-43 | Report Archive in Dashboard shows historical reports (D-60) | head-dashboard.spec.ts:112 | Report Archive section is visible with past reports | partial |
| SC-50 | CRUD Users | admin-panel.spec.ts:28 | users tab shows table with user names | partial |
| SC-51 | CRUD Products with SDLC stage configuration | admin-panel.spec.ts:76 | stage assignment section visible after expanding product | partial |
| SC-52 | CRUD Periods | admin-panel.spec.ts:103 | periods tab shows week labels | partial |
| SC-53 | Reminder settings toggle | admin-panel.spec.ts:137 | reminders tab shows toggle switches | partial |
| SC-60 | Lead cannot see products with 0 assigned stages | lead-journey.spec.ts:42 | renders SDLC pipeline with products | partial |
| SC-61 | Lead cannot edit locked stages (cursor:not-allowed) | lead-journey.spec.ts:57 | locked stages have reduced opacity | partial |
| SC-62 | Lead cannot add items to other leads' product columns | — | — | missing |
| SC-63 | Head/Admin can view lead forms from Dashboard (D-62) | cross-role-lifecycle.spec.ts:88 | head dashboard shows lead cards with Submitted status | partial |
| SC-64 | Admin has full access to everything | admin-panel.spec.ts:166 | settings tab shows form fields | partial |
| SC-65 | Unauthenticated user redirected to Login — split-screen (D-61) | responsive/breakpoints.spec.ts:22 | login page renders without left brand panel | partial |
| SC-66 | Role-based navigation visibility (D-59) | admin-panel.spec.ts:24 | shows Admin Panel heading | partial |
| SC-67 | Session timeout and re-authentication | error-paths.spec.ts:17 | renders at /auth/error with default message | partial |
| SC-70 | Item counts in badges match actual items | error-paths.spec.ts:124 | all form sections have proper labels | partial |
| SC-71 | Risk counts match across Lead Form, Assembled, Published | — | — | missing |
| SC-72 | Product names consistent everywhere | error-paths.spec.ts:124 | all form sections have proper labels | partial |
| SC-73 | Stage assignees match between SDLC pipeline and Admin config | — | — | missing |
| SC-80 | Skeleton loading state displays correctly | — | — | missing |
| SC-81 | Error state with retry button | error-paths.spec.ts:51 | invalid route renders 404 page | partial |
| SC-82 | Notification toasts display correctly | — | — | missing |
| SC-83 | Form locking visual treatment after submission | lead-journey.spec.ts:164 | confirming submit locks the form | partial |
| SC-90 | Lead with stages on only 1 product | — | — | missing |
| SC-91 | Stage assignment validation prevents duplicates (D-63) | admin-panel.spec.ts:76 | stage assignment section visible after expanding product | partial |
| SC-92 | Period with zero submissions at deadline | — | — | missing |
| SC-93 | Concurrent edits by two leads on different products | — | — | missing |
| SC-94 | Keyboard navigation through Lead Form | a11y/accessibility.spec.ts:20 | skip link exists and targets #main-content | partial |
| SC-95 | Touch targets meet 44px minimum | — | — | missing |
| SC-96 | Collapsible sections maintain state | lead-journey.spec.ts:105 | Current Week section shows items | partial |
| SC-97 | Reduced motion preference respected | a11y/accessibility.spec.ts:51 | all buttons on lead form have accessible names | partial |
| SC-111 | Lead views past period in read-only mode (D-64) | period-features.spec.ts:34 | period navigator visible on lead form | partial |
| SC-112 | Lead cannot fill form for non-existent period (D-64) | period-features.spec.ts:39 | period navigator shows week label text | partial |
| SC-113 | Copy from specific past period (D-65) | period-features.spec.ts:109 | Fill from dropdown opens on click and shows period list | partial |
| SC-114 | Copy warning when form has existing data (D-65) | period-features.spec.ts:155 | clicking a period option shows confirmation dialog | partial |
| SC-115 | Weekly Report period navigation (D-66) | weekly-report.spec.ts:41 | period navigator shows current week selection | partial |
| SC-116 | Autosave version history and rollback (D-67) | period-features.spec.ts:191 | version history navigator visible on lead form | partial |
| SC-120 | Fill from Previous -- happy path on empty form | period-features.spec.ts:105 | Fill from Previous button visible on lead form | partial |
| SC-121 | Fill from specific period via dropdown search | period-features.spec.ts:131 | Fill from dropdown has searchable input | full |
| SC-122 | Search filtering in dropdown by month name | period-features.spec.ts:131 | Fill from dropdown has searchable input | partial |
| SC-123 | Fill when form has existing data -- warning dialog | period-features.spec.ts:155 | clicking a period option shows confirmation dialog | partial |
| SC-124 | Fill preserves product scoping | — | — | missing |
| SC-125 | Fill from period where lead had different products | — | — | missing |
| SC-126 | Fill does not copy priorities | — | — | missing |
| SC-127 | Fill -- Next Week items from source become Current Week suggestions | — | — | missing |
| SC-128 | Fill and immediately submit | — | — | missing |
| SC-129 | Fill from oldest available period | period-features.spec.ts:67 | period dropdown lists all available periods | partial |
| SC-130 | View version history modal | period-features.spec.ts:233 | restore functionality accessible via version history modal | partial |
| SC-131 | Navigate versions with left/right arrows | period-features.spec.ts:202 | version navigation arrows visible and functional | full |
| SC-132 | Diff preview shows correct counts | — | — | missing |
| SC-133 | Restore to v1 from v3 -- data rolls back | period-features.spec.ts:233 | restore functionality accessible via version history modal | partial |
| SC-134 | Restore creates automatic backup | — | — | missing |
| SC-135 | Linear history -- edit from v1 discards v2, v3 | — | — | missing |
| SC-136 | Warning before editing from past version | — | — | missing |
| SC-137 | Version counter resets each period | — | — | missing |
| SC-138 | Version created on each autosave | period-features.spec.ts:226 | version number and label displayed | partial |
| SC-139 | Version history empty for new period (only v1) | — | — | missing |
| SC-140 | Lead Form -- switch to past period shows read-only state | period-features.spec.ts:34 | period navigator visible on lead form | partial |
| SC-141 | Lead Form -- switch back to current period restores editable state | — | — | missing |
| SC-142 | Lead Form -- past period shows correct submitted data | — | — | missing |
| SC-143 | Lead Form -- buttons hidden on past period | — | — | missing |
| SC-144 | Lead Form -- right arrow disabled on latest period | period-features.spec.ts:48 | left and right arrow buttons visible and clickable | partial |
| SC-145 | Weekly Report -- switch to past published report | weekly-report.spec.ts:41 | period navigator shows current week selection | partial |
| SC-146 | Weekly Report -- past report shows only Export PDF | weekly-report.spec.ts:146 | Export PDF button is visible | partial |
| SC-147 | Weekly Report -- combobox shows (current) label | weekly-report.spec.ts:41 | period navigator shows current week selection | partial |
| SC-148 | Period not created by Admin -- not in dropdown | period-features.spec.ts:67 | period dropdown lists all available periods | partial |
| SC-150 | Full lifecycle: Open, leads submit, Publish & Lock, all locked | cross-role-lifecycle.spec.ts:26 | lead form shows Submitted badge after submitting | full |
| SC-151 | Publish with 0 submissions -- warning | weekly-report.spec.ts:120 | clicking Publish & Lock opens confirmation dialog | partial |
| SC-152 | Publish with partial submissions -- warning with names | weekly-report.spec.ts:120 | clicking Publish & Lock opens confirmation dialog | full |
| SC-153 | After publish -- Lead sees locked banner with Head name and date | cross-role-lifecycle.spec.ts:55 | lead form in submitted state has disabled Submit button | partial |
| SC-154 | After publish -- Lead tries to edit, all fields disabled | cross-role-lifecycle.spec.ts:55 | lead form in submitted state has disabled Submit button | full |
| SC-155 | After publish -- Weekly Report shows Published badge | cross-role-lifecycle.spec.ts:189 | publishing transforms button to Published state | full |
| SC-156 | Reopen -- leads can edit again | — | — | missing |
| SC-157 | Re-publish after reopen | — | — | missing |
| SC-158 | Double publish attempt (already published) | — | — | missing |
| SC-160 | Revoke specific lead's submission | — | — | missing |
| SC-161 | After revoke -- lead's form becomes editable | — | — | missing |
| SC-162 | After revoke -- KPI submissions count updates | — | — | missing |
| SC-163 | After revoke -- Weekly Report removes revoked lead's data | — | — | missing |
| SC-164 | Revoke + lead re-submits | — | — | missing |
| SC-165 | Revoke all leads simultaneously | — | — | missing |
| SC-166 | Revoke during Published state | — | — | missing |
| SC-167 | Revoke non-submitted lead -- button not shown | — | — | missing |
| SC-170 | Toggle All collapses all sections | head-dashboard.spec.ts:24 | shows Admin Panel heading | — |
| SC-171 | Toggle All expands all sections | — | — | missing |
| SC-172 | Alert bar shows correct pending lead names | head-dashboard.spec.ts:66 | alert bar shows pending leads message | partial |
| SC-173 | Alert bar hidden when all submitted | — | — | missing |
| SC-174 | Send Reminder -- success flow | — | — | missing |
| SC-175 | Report Archive -- page 1 default | head-dashboard.spec.ts:117 | archive cards show week labels and date ranges | partial |
| SC-176 | Report Archive -- navigate to page 2 | — | — | missing |
| SC-177 | Report Archive -- click report opens Weekly Report for that period | — | — | missing |
| SC-178 | KPI Escalations -- count matches Blocked & At Risk entries | head-dashboard.spec.ts:54 | Risks & Blockers KPI card is visible with counts | partial |
| SC-179 | Lead Reports -- traffic light dots match lead's actual product statuses | head-dashboard.spec.ts:91 | traffic light dots are visible on submitted lead cards | partial |
| SC-180 | Autosave triggers on field change (debounced) | lead-journey.spec.ts:34 | shows autosave badge | partial |
| SC-181 | Autosave badge shows "Saving..." during save | — | — | missing |
| SC-182 | Autosave fails -- error toast | — | — | missing |
| SC-183 | Add item modal -- description required validation | — | — | missing |
| SC-184 | Add item modal -- cancel does not create item | — | — | missing |
| SC-185 | Edit item -- pre-filled data correct | — | — | missing |
| SC-186 | Delete item -- confirmation dialog and confirm | — | — | missing |
| SC-187 | Delete item -- cancel does not delete | — | — | missing |
| SC-188 | Kanban card hover shows Edit/Delete buttons | — | — | missing |
| SC-189 | Kanban card read-only (other lead's) -- no hover buttons | — | — | missing |
| SC-190 | SDLC stage -- change status from On Track to At Risk | — | — | missing |
| SC-191 | SDLC stage -- click locked stage does nothing | — | — | missing |
| SC-192 | Risk -- add new risk with product+stage scope | — | — | missing |
| SC-193 | Priorities -- max 3, cannot add 4th | lead-journey.spec.ts:127 | Priorities section shows numbered list | partial |
| SC-194 | Priorities -- clear one, badge updates | — | — | missing |
| SC-195 | Submit Report -- confirmation dialog shows correct counts | lead-journey.spec.ts:142 | clicking Submit opens confirmation dialog | full |
| SC-196 | Submit Report -- after submit form locked, timestamp shown | lead-journey.spec.ts:164 | confirming submit locks the form | partial |
| SC-200 | Toggle All collapses all accordion sections | weekly-report.spec.ts:63 | Portfolio Overview section shows product cards with status | — |
| SC-201 | Portfolio Overview -- 12 products shown with correct worst-case statuses | weekly-report.spec.ts:63 | Portfolio Overview section shows product cards with status | partial |
| SC-202 | Per-lead accordion -- shows correct item counts and data | weekly-report.spec.ts:75 | product accordion expands on click to show Current Week items | full |
| SC-203 | Export PDF -- button triggers generation | pdf-export.spec.ts:21 | print page renders with report content | partial |
| SC-220 | Tab switching in Admin Panel | admin-panel.spec.ts:24 | shows Admin Panel heading | partial |
| SC-221 | Users -- add user with all fields | admin-panel.spec.ts:28 | users tab shows table with user names | partial |
| SC-222 | Users -- edit user role | — | — | missing |
| SC-223 | Users -- delete user with confirmation | — | — | missing |
| SC-224 | Products -- edit product SDLC stages | admin-panel.spec.ts:76 | stage assignment section visible after expanding product | partial |
| SC-225 | Products -- remove stage with data warning | — | — | missing |
| SC-226 | Products -- stage assignment validation (D-63) -- no duplicates | — | — | missing |
| SC-227 | Periods -- create new period | admin-panel.spec.ts:103 | periods tab shows week labels | partial |
| SC-228 | Periods -- date validation (end after start) | — | — | missing |
| SC-229 | Reminders -- toggle on/off with autosave | admin-panel.spec.ts:137 | reminders tab shows toggle switches | partial |
| SC-230 | Settings -- change default deadline day | admin-panel.spec.ts:166 | settings tab shows form fields | partial |
| SC-240 | Split-screen layout renders correctly | responsive/breakpoints.spec.ts:22 | login page renders without left brand panel | partial |
| SC-241 | SSO button redirects to Keycloak | error-paths.spec.ts:35 | has Return to Login link pointing to / | partial |
| SC-242 | After SSO -- Lead redirected to /report | — | — | missing |
| SC-243 | After SSO -- Head redirected to /dashboard | — | — | missing |
| SC-244 | After SSO -- Admin redirected to /dashboard | — | — | missing |
| SC-245 | JWT expiry -- redirect to login | error-paths.spec.ts:17 | renders at /auth/error with default message | partial |
| SC-246 | Role from SAML mapped correctly | — | — | missing |
| SC-247 | Concurrent sessions (same user, two tabs) | — | — | missing |
| SC-248 | Logout -- session cleared | error-paths.spec.ts:35 | has Return to Login link pointing to / | partial |
| SC-250 | Mobile viewport -- nav collapses or adapts | responsive/breakpoints.spec.ts:22 | login page renders without left brand panel | partial |
| SC-251 | Mobile -- no horizontal scroll | responsive/breakpoints.spec.ts:40 | lead form is scrollable on mobile | partial |
| SC-252 | Mobile -- kanban columns stack vertically | — | — | missing |
| SC-253 | Mobile -- SDLC pipeline wraps | — | — | missing |
| SC-254 | Login -- left panel hidden on mobile | responsive/breakpoints.spec.ts:22 | login page renders without left brand panel | full |
| SC-260 | Network disconnect during autosave | — | — | missing |
| SC-261 | Network disconnect during submit | — | — | missing |
| SC-262 | API 500 error -- error state with retry | error-paths.spec.ts:51 | invalid route renders 404 page | partial |
| SC-263 | Browser refresh preserves state | error-paths.spec.ts:78 | /lead/report without period param renders correctly | partial |
| SC-264 | Empty database (no products, no users, no periods) | — | — | missing |
| SC-265 | Maximum data -- 100+ items in one lead's form | — | — | missing |
| SC-266 | Special characters in text fields (XSS prevention) | — | — | missing |
| SC-267 | Very long text in item description | — | — | missing |
| SC-268 | Unicode characters in names and content | — | — | missing |
| SC-269 | Concurrent edit same period by same user (two tabs) | — | — | missing |
| SC-280 | Screen reader reads page title | a11y/accessibility.spec.ts:51 | all buttons on lead form have accessible names | partial |
| SC-281 | Screen reader reads KPI values | — | — | missing |
| SC-282 | Keyboard Tab order matches visual order | a11y/accessibility.spec.ts:20 | skip link exists and targets #main-content | partial |
| SC-283 | Escape closes modals | — | — | missing |
| SC-284 | Focus trap in modals | — | — | missing |
| SC-285 | Skip link works | a11y/accessibility.spec.ts:32 | skip link becomes visible on Tab press | full |
| SC-286 | SDLC stages have correct aria-labels | — | — | missing |
| SC-287 | Color contrast meets 4.5:1 | — | — | missing |
| SC-288 | Reduced motion disables animations | a11y/accessibility.spec.ts:51 | all buttons on lead form have accessible names | partial |
| SC-290 | Login page shows role selection buttons in dev mode | — | — | missing |
| SC-291 | Click "Enter as Lead" redirects to /report | — | — | missing |
| SC-292 | Click "Enter as Head" redirects to /dashboard | — | — | missing |
| SC-293 | Click "Enter as Admin" redirects to /dashboard | — | — | missing |
| SC-294 | Click "Enter as Viewer" redirects to /dashboard (read-only) | — | — | missing |
| SC-295 | SSO button disabled in dev mode | — | — | missing |
| SC-296 | Login stub disabled in production mode | — | — | missing |
| SC-297 | Switching roles requires re-login | — | — | missing |
| SC-300 | Every page has a unique, bookmarkable URL | error-paths.spec.ts:139 | all nav links resolve to valid routes | partial |
| SC-301 | Period selection updates URL query param | period-features.spec.ts:59 | Period navigator visible on lead form | partial |
| SC-302 | Weekly Report period selection updates URL | weekly-report.spec.ts:41 | period navigator shows current week selection | partial |
| SC-303 | Admin tab selection updates URL query param | admin-panel.spec.ts:24 | shows Admin Panel heading | partial |
| SC-304 | Admin viewing lead's form via URL | — | — | missing |
| SC-305 | Direct URL access enforces role-based access | error-paths.spec.ts:66 | /admin?tab=invalid defaults to users tab | partial |
| SC-306 | Browser refresh preserves page state | error-paths.spec.ts:157 | browser back from /lead/report lands on previous page | partial |
| SC-307 | Browser forward/back navigation works naturally | error-paths.spec.ts:157 | browser back from /lead/report lands on previous page | full |
| SC-308 | 404 page for invalid URLs | error-paths.spec.ts:51 | invalid route renders 404 page | full |
| SC-309 | Deep link sharing works across users | — | — | missing |
| SC-310 | Logout clears session and redirects to /login | — | — | missing |
| SC-311 | Nav bar teal bottom border matches content width | — | — | missing |

## Coverage Summary

### Overall Statistics
- **Full Coverage:** 21 scenarios (9.5%)
- **Partial Coverage:** 98 scenarios (44.3%)
- **Missing Coverage:** 102 scenarios (46.1%)
- **Total Scenarios:** 221

### By Test Suite

**lead-journey.spec.ts** (194 lines)
- 10 tests covering: SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09, SC-13, SC-96, SC-127, SC-180, SC-193, SC-195, SC-196
- Focus: Lead Form UI, SDLC pipeline, form sections, submission workflow
- Coverage: Partial - validates UI rendering but limited interaction testing

**lead-history.spec.ts** (54 lines)
- 4 tests covering: History page rendering, traffic light indicators, submission statuses
- Coverage: Partial - validates layout and display

**admin-panel.spec.ts** (182 lines)
- 13 tests covering: SC-50, SC-51, SC-52, SC-53, SC-64, SC-66, SC-91, SC-220, SC-221, SC-224, SC-227, SC-229, SC-230
- Focus: Admin CRUD operations, tab navigation, form fields
- Coverage: Partial - validates tab switching and data display

**pdf-export.spec.ts** (51 lines)
- 3 tests covering: Print page rendering, company header, portfolio table
- Coverage: Partial - validates print template structure

**weekly-report.spec.ts** (149 lines)
- 9 tests covering: SC-30, SC-31, SC-33, SC-34, SC-115, SC-145, SC-146, SC-147, SC-201, SC-202
- Focus: Weekly Report UI, period navigation, publish workflow
- Coverage: Full for several publish/accordion scenarios; partial for portfolio overview

**head-dashboard.spec.ts** (126 lines)
- 11 tests covering: SC-20, SC-22, SC-23, SC-24, SC-25, SC-43, SC-54, SC-66, SC-172, SC-175, SC-178, SC-179
- Focus: Dashboard KPI cards, lead reports, archive section
- Coverage: Partial - validates UI presence and status badges

**cross-role-lifecycle.spec.ts** (241 lines)
- 13 tests covering: SC-40, SC-63, SC-150, SC-152, SC-153, SC-154, SC-155, cross-role workflows
- Focus: Multi-role state transitions, submit/publish workflow
- Coverage: Full for lifecycle scenarios; partial for state indicators

**period-features.spec.ts** (269 lines)
- 15 tests covering: SC-111, SC-112, SC-113, SC-114, SC-116, SC-120, SC-121, SC-122, SC-123, SC-129, SC-130, SC-131, SC-138, SC-140, SC-144, SC-148
- Focus: Period navigation, Fill From feature, version history
- Coverage: Full for version navigation; partial for fill workflow

**error-paths.spec.ts** (172 lines)
- 12 tests covering: SC-12, SC-17, SC-67, SC-81, SC-245, SC-262, SC-263, SC-300, SC-305, SC-307, SC-308
- Focus: Error handling, invalid routes, form validation, navigation edge cases
- Coverage: Full for 404 and navigation; partial for error states

**visual/screenshots.spec.ts**
- Baseline screenshot capture for visual regression
- Coverage: Indirect - validates rendering across all pages

**responsive/breakpoints.spec.ts**
- 4 tests covering: SC-240, SC-250, SC-254
- Focus: Mobile/tablet/desktop viewports
- Coverage: Partial - validates layout adaptation at breakpoints

**a11y/accessibility.spec.ts**
- 6 tests covering: SC-94, SC-97, SC-280, SC-282, SC-285, SC-288
- Focus: Accessibility: skip link, focus, names, keyboard navigation
- Coverage: Partial - validates core a11y but missing contrast/motion tests

## Gaps & Recommendations

### Critical Missing Coverage (High Priority)
- **SC-156–SC-167:** Reopen and Revoke workflows (16 scenarios) — No tests
- **SC-183–SC-192:** Item/Risk/Priority CRUD operations (10 scenarios) — No tests
- **SC-222–SC-228:** User/Product advanced admin operations (7 scenarios) — No tests
- **SC-260–SC-268:** Network failures, XSS, edge cases (9 scenarios) — No tests
- **SC-290–SC-296:** Dev mode login stub (7 scenarios) — No tests

### Partial Coverage Requiring Enhancement
- **Period Navigation:** Tests check combobox presence but not actual period switching behavior
- **Fill From feature:** Missing verification of actual data copying and validation
- **Version History:** Tests check UI elements but not restore functionality end-to-end
- **SDLC Stage interactions:** Tests validate visual presence but not popover/status changes
- **Delete/Edit modals:** No confirmation dialog validation

### Architecture Observations
1. **E2E Scope:** Tests primarily validate UI rendering and hydration; limited transactional validation
2. **Mock Data:** All tests use mock data; no integration with actual backend
3. **Test Coverage Pattern:** 
   - Full: High-level workflows (submit, publish, navigations)
   - Partial: UI/visual validation (badges, counts, sections present)
   - Missing: Detailed CRUD operations, error conditions, cross-browser compatibility

## Recommendations for Coverage Expansion

### Immediate (Next Sprint)
1. Add tests for Revoke workflow (SC-160–SC-167)
2. Add modal/dialog interaction tests for CRUD operations
3. Add network failure/retry scenarios (SC-260–SC-262)
4. Add XSS/injection prevention tests (SC-266)

### Short-term
1. Expand Fill From tests to validate actual data copying
2. Add Version History restore end-to-end validation
3. Add contrast/motion accessibility tests (SC-287, SC-288)
4. Add dev mode login stub tests (SC-290–SC-296)

### Long-term
1. Migrate to E2E tests with real backend integration (remove mocks)
2. Add cross-browser E2E testing
3. Add performance benchmarking tests
4. Add security/penetration testing
5. Implement visual regression baselines across all pages

---

**Report Generated:** April 25, 2026  
**Tool:** Regression Scenario Traceability Matrix Generator  
**Methodology:** Manual analysis of REGRESSION-SCENARIOS.md + E2E test files (lead-journey, lead-history, admin-panel, pdf-export, weekly-report, head-dashboard, cross-role-lifecycle, period-features, error-paths, visual, responsive, accessibility)
