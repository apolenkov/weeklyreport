# CustomReport — Regression Test Scenarios

**Generated:** 2026-04-12
**Scope:** Every page, component, API endpoint, business rule, and edge case
**Total scenarios:** 1050+

---

## Legend

- **P0** — Critical (blocks user flow)
- **P1** — High (wrong behavior, data loss)
- **P2** — Medium (visual, UX, edge case)
- **P3** — Low (cosmetic, nice-to-have)

---

## 1. AUTHENTICATION & SESSION (AUTH-001..AUTH-060)

### 1.1 SAML Login Flow

| #        | Scenario                                                     | Priority | Expected                                                                      |
| -------- | ------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| AUTH-001 | Click "Sign In" on landing page                              | P0       | Redirects to `/auth/saml/login` → Keycloak SSO                                |
| AUTH-002 | Successful SAML callback with valid assertion                | P0       | User created/updated in DB, JWT cookie set, redirect to frontend              |
| AUTH-003 | SAML callback with existing user (by samlId)                 | P0       | User record updated (name, email), session cookie issued                      |
| AUTH-004 | SAML callback with existing user (by email, no samlId)       | P0       | User found by email fallback, samlId written, cookie issued                   |
| AUTH-005 | SAML callback with new user (neither samlId nor email match) | P0       | New user created with role from SAML profile                                  |
| AUTH-006 | SAML callback with invalid assertion                         | P0       | Redirect to `/auth/error?reason=invalid_assertion`                            |
| AUTH-007 | SAML callback with missing profile                           | P1       | Redirect to `/auth/error?reason=invalid_assertion`                            |
| AUTH-008 | SAML callback when Keycloak unreachable                      | P1       | Passport strategy throws, Express error handler catches                       |
| AUTH-009 | SAML assertion with clock skew < 5000ms                      | P2       | Accepted (within tolerance)                                                   |
| AUTH-010 | SAML assertion with clock skew > 5000ms                      | P2       | Rejected, redirect to error                                                   |
| AUTH-011 | SAML profile with role "lead"                                | P0       | User.role = lead in DB                                                        |
| AUTH-012 | SAML profile with role "head"                                | P0       | User.role = head in DB                                                        |
| AUTH-013 | SAML profile with role "viewer"                              | P0       | User.role = viewer in DB                                                      |
| AUTH-014 | SAML profile with unknown role (e.g., "admin")               | P1       | Stored as-is in DB (no validation)                                            |
| AUTH-015 | Session cookie `customreport_session` set as HttpOnly        | P0       | Cookie not accessible from JavaScript                                         |
| AUTH-016 | Session cookie has SameSite=Lax                              | P1       | Cross-site protection                                                         |
| AUTH-017 | JWT token expires after 1 hour                               | P1       | Subsequent requests fail with UNAUTHORIZED                                    |
| AUTH-018 | Active report section included in JWT                        | P0       | `activeReportId` and `activeReportSectionId` populated if draft report exists |
| AUTH-019 | User with no draft report sections                           | P1       | `activeReportId: null`, `activeReportSectionId: null` in JWT                  |

### 1.2 Dev Login

| #        | Scenario                                            | Priority | Expected                                   |
| -------- | --------------------------------------------------- | -------- | ------------------------------------------ |
| AUTH-020 | GET /auth/dev-login (no params)                     | P0       | Login as head, redirect to frontend        |
| AUTH-021 | GET /auth/dev-login?role=lead                       | P0       | Login as lead1@customreport.local          |
| AUTH-022 | GET /auth/dev-login?role=head                       | P0       | Login as head@customreport.local           |
| AUTH-023 | GET /auth/dev-login?role=viewer                     | P0       | Login as viewer@customreport.local         |
| AUTH-024 | GET /auth/dev-login?role=invalid                    | P1       | 400 with error message listing valid roles |
| AUTH-025 | GET /auth/dev-login?role=lead&email=custom@test.com | P2       | Login with custom email                    |
| AUTH-026 | Dev-login when AUTH_DEV_MODE=false                  | P0       | 404 (route not mounted)                    |
| AUTH-027 | Dev-login creates user if not exists                | P0       | New user record in DB                      |
| AUTH-028 | Dev-login updates user if exists (by email+samlId)  | P0       | Existing user found, no duplicate          |
| AUTH-029 | Dev-login with duplicate email (different samlId)   | P1       | findFirst OR handles this gracefully       |

### 1.3 Logout

| #        | Scenario                                               | Priority | Expected                                       |
| -------- | ------------------------------------------------------ | -------- | ---------------------------------------------- |
| AUTH-030 | POST /auth/logout                                      | P0       | Cookie cleared (Max-Age=0), redirect to /      |
| AUTH-031 | Logout does not invalidate existing tokens server-side | P2       | Existing JWT valid until 1h expiry (stateless) |
| AUTH-032 | After logout, tRPC calls return UNAUTHORIZED           | P0       | Cookie gone, no session in context             |

### 1.4 tRPC Auth Context

| #        | Scenario                                          | Priority | Expected                                               |
| -------- | ------------------------------------------------- | -------- | ------------------------------------------------------ |
| AUTH-033 | Valid JWT cookie → session populated              | P0       | tRPC context has full UserSession                      |
| AUTH-034 | Expired JWT cookie → session null                 | P0       | Falls through to dev mode or null                      |
| AUTH-035 | Invalid JWT cookie (bad signature) → session null | P0       | Token verification fails, caught                       |
| AUTH-036 | No cookie + AUTH_DEV_MODE=true → DEV_SESSION      | P0       | Fallback to hardcoded head session                     |
| AUTH-037 | No cookie + AUTH_DEV_MODE=false → null            | P0       | session: null, protected procedures throw UNAUTHORIZED |
| AUTH-038 | protectedProcedure with null session              | P0       | Throws UNAUTHORIZED                                    |
| AUTH-039 | headProcedure with lead session                   | P0       | Throws FORBIDDEN                                       |
| AUTH-040 | headProcedure with viewer session                 | P0       | Throws FORBIDDEN                                       |
| AUTH-041 | headProcedure with head session                   | P0       | Passes, proceeds to handler                            |

### 1.5 Auth Error Page

| #        | Scenario                                         | Priority | Expected                                                |
| -------- | ------------------------------------------------ | -------- | ------------------------------------------------------- |
| AUTH-042 | /auth/error?reason=idp_unavailable               | P1       | Title "Service Unavailable", correct message            |
| AUTH-043 | /auth/error?reason=invalid_assertion             | P1       | Title "Verification Failed", correct message            |
| AUTH-044 | /auth/error?reason=session_expired               | P1       | Title "Session Expired", correct message                |
| AUTH-045 | /auth/error with unknown reason                  | P1       | Title "Sign-in Error", generic message                  |
| AUTH-046 | /auth/error with no reason param                 | P1       | Title "Sign-in Error", generic message                  |
| AUTH-047 | "Try signing in again" button → /auth/saml/login | P1       | Correct href                                            |
| AUTH-048 | "Return to home" button → /                      | P2       | Correct href                                            |
| AUTH-049 | Suspense fallback renders skeleton               | P2       | h-6 title + h-20 content + h-9 button skeletons visible |
| AUTH-050 | Alert uses destructive variant                   | P3       | Red/destructive styling                                 |

### 1.6 Session Edge Cases

| #        | Scenario                                         | Priority | Expected                                                                     |
| -------- | ------------------------------------------------ | -------- | ---------------------------------------------------------------------------- |
| AUTH-051 | Concurrent sessions from same user               | P2       | Both JWTs valid independently                                                |
| AUTH-052 | User role changed in DB after JWT issued         | P1       | Old JWT retains old role until expiry                                        |
| AUTH-053 | User deleted from DB after JWT issued            | P1       | tRPC calls may succeed with stale session data                               |
| AUTH-054 | Cookie with future expiry date                   | P3       | Accepted normally                                                            |
| AUTH-055 | Request with both cookie and x-request-id header | P2       | CorrelationId middleware reads x-request-id; auth reads cookie independently |
| AUTH-056 | CORS preflight from non-allowed origin           | P1       | Rejected by CORS config                                                      |
| AUTH-057 | CORS request from FRONTEND_URL origin            | P0       | Allowed with credentials                                                     |
| AUTH-058 | Helmet headers present on all responses          | P2       | CSP, X-Frame-Options, HSTS set                                               |
| AUTH-059 | Cookie SameSite prevents CSRF                    | P1       | POST /auth/logout rejects cross-origin requests                              |
| AUTH-060 | x-request-id generated when not provided         | P3       | UUID in response header                                                      |

---

## 2. LANDING PAGE (LAND-001..LAND-010)

| #        | Scenario                                   | Priority | Expected                                   |
| -------- | ------------------------------------------ | -------- | ------------------------------------------ |
| LAND-001 | Landing page renders without auth          | P0       | Card with logo, subtitle, Sign In button   |
| LAND-002 | "Sign In" links to API_URL/auth/saml/login | P0       | Correct href construction                  |
| LAND-003 | Card centered vertically and horizontally  | P2       | flex min-h-svh items-center justify-center |
| LAND-004 | Card max-width is sm (max-w-sm)            | P3       | Does not stretch on wide screens           |
| LAND-005 | Button is full-width inside card           | P3       | w-full class                               |
| LAND-006 | Page has no sidebar/navigation             | P2       | No AppShell wrapper                        |
| LAND-007 | Responsive on mobile (320px)               | P2       | Card fits with p-8 padding                 |
| LAND-008 | Subtitle text matches expected copy        | P3       | "Weekly Status Reporting" or similar       |
| LAND-009 | No console errors on load                  | P3       | Clean console                              |
| LAND-010 | Page loads under 1.5s (LCP target)         | P3       | Performance target met                     |

---

## 3. LEAD REPORT FORM (LEAD-001..LEAD-120)

### 3.1 Page States

| #        | Scenario                                            | Priority | Expected                                                |
| -------- | --------------------------------------------------- | -------- | ------------------------------------------------------- |
| LEAD-001 | Loading state shows AppShell + LeadReportSkeleton   | P1       | PageTitleSkeleton + 3× CardSkeleton                     |
| LEAD-002 | Error state shows QueryError with Retry button      | P0       | Alert destructive, retry works                          |
| LEAD-003 | No active section shows Alert "No active report"    | P0       | Friendly message, no crash                              |
| LEAD-004 | Draft section renders full editable form            | P0       | All editors visible and interactive                     |
| LEAD-005 | Submitted section renders read-only form            | P0       | All inputs disabled, opacity-50                         |
| LEAD-006 | AppShell role="lead", currentPath="/lead/report"    | P2       | Correct nav highlighting                                |
| LEAD-007 | activeReportId passed to AppShell from section data | P2       | Nav item "Published Report" visible if published exists |

### 3.2 Autosave

| #        | Scenario                                               | Priority | Expected                                       |
| -------- | ------------------------------------------------------ | -------- | ---------------------------------------------- |
| LEAD-010 | Modify text → autosave fires after 300ms debounce      | P0       | saveDraft mutation called                      |
| LEAD-011 | AutosaveIndicator shows "Saving..." during mutation    | P1       | Spinning Loader2 + "Saving..." badge           |
| LEAD-012 | AutosaveIndicator shows "Saved" after success          | P1       | Check icon + "Saved" badge                     |
| LEAD-013 | AutosaveIndicator hidden when idle                     | P2       | Returns null                                   |
| LEAD-014 | Autosave skipped when section is read-only (submitted) | P0       | No mutation fired                              |
| LEAD-015 | Autosave skipped when no changes detected              | P2       | Snapshot comparison prevents unnecessary saves |
| LEAD-016 | Rapid edits coalesce into single save (debounce)       | P1       | Only last state saved                          |
| LEAD-017 | Autosave failure does not crash the page               | P1       | Error caught, user can retry manually          |
| LEAD-018 | aria-live="polite" on autosave indicator               | P3       | Screen readers announce state changes          |

### 3.3 Project Status Grid (Traffic Lights)

| #        | Scenario                                           | Priority | Expected                             |
| -------- | -------------------------------------------------- | -------- | ------------------------------------ |
| LEAD-020 | All projects from section displayed                | P0       | One card per project                 |
| LEAD-021 | Select "green" for a project                       | P0       | Green radio selected, ring-2 visible |
| LEAD-022 | Select "yellow" for a project                      | P0       | Yellow radio selected                |
| LEAD-023 | Select "red" for a project                         | P0       | Red radio selected                   |
| LEAD-024 | Select "unset" (clear) for a project               | P1       | No status selected                   |
| LEAD-025 | Only one status selected at a time per project     | P0       | Radio group behavior                 |
| LEAD-026 | Grid: 1 column on mobile, 2 on md+                 | P2       | Responsive grid                      |
| LEAD-027 | Disabled state: opacity-50 pointer-events-none     | P1       | Submitted section                    |
| LEAD-028 | aria-checked on selected radio                     | P3       | Accessibility                        |
| LEAD-029 | aria-label on each radio: "Set {name} to {status}" | P3       | Accessibility                        |
| LEAD-030 | role="radiogroup" with aria-label on container     | P3       | Accessibility                        |
| LEAD-031 | Changing traffic light triggers autosave           | P0       | Draft saved with new status          |
| LEAD-032 | 6 projects displayed (seed data)                   | P2       | All seed projects visible            |

### 3.4 Items Editor

| #        | Scenario                                               | Priority | Expected                          |
| -------- | ------------------------------------------------------ | -------- | --------------------------------- |
| LEAD-040 | "Current Week" section header visible                  | P1       | Separator + heading               |
| LEAD-041 | "Next Week" section header visible                     | P1       | Separator + heading               |
| LEAD-042 | Items split by type: current vs next                   | P0       | Correct grouping                  |
| LEAD-043 | Item text editable via Input                           | P0       | Typing changes value              |
| LEAD-044 | Carried-over item shows "Carried Over" badge           | P0       | Badge visible on carriedOver=true |
| LEAD-045 | Carried-over item shows "Completed" checkbox           | P0       | Checkbox below input              |
| LEAD-046 | Non-carried-over item has no badge or checkbox         | P0       | Clean display                     |
| LEAD-047 | Checking "Completed" on carried-over item              | P0       | completed=true saved              |
| LEAD-048 | Unchecking "Completed" on carried-over item            | P1       | completed=false saved             |
| LEAD-049 | Text change triggers autosave                          | P0       | saveDraft called                  |
| LEAD-050 | Disabled state: opacity-50 pointer-events-none         | P1       | Submitted section                 |
| LEAD-051 | aria-label "Current item {n}" on inputs                | P3       | Accessibility                     |
| LEAD-052 | aria-label "Next item {n}" on inputs                   | P3       | Accessibility                     |
| LEAD-053 | aria-label "Carry-over item {n} completed" on checkbox | P3       | Accessibility                     |
| LEAD-054 | Empty items list for current week                      | P2       | No items rendered in section      |
| LEAD-055 | Empty items list for next week                         | P2       | No items rendered in section      |

### 3.5 Risks Editor (Read-Only Display)

| #        | Scenario                                        | Priority | Expected                              |
| -------- | ----------------------------------------------- | -------- | ------------------------------------- |
| LEAD-060 | Risks with data: card list displayed            | P0       | Risk text + impact badge + mitigation |
| LEAD-061 | risks.length === 0: "No risks added" paragraph  | P1       | Centered text                         |
| LEAD-062 | Risk with impact truthy: Badge with impact text | P1       | Badge visible                         |
| LEAD-063 | Risk with impact falsy: No badge                | P2       | Clean display                         |
| LEAD-064 | Disabled state: opacity-50                      | P2       | Submitted section                     |
| LEAD-065 | Risk field name is `risk.risk` not `risk.text`  | P0       | Correct schema field (bug was fixed)  |

### 3.6 Decisions Editor (Read-Only Display)

| #        | Scenario                                            | Priority | Expected                       |
| -------- | --------------------------------------------------- | -------- | ------------------------------ |
| LEAD-070 | Decisions with data: card list displayed            | P0       | Decision text + resolved badge |
| LEAD-071 | decisions.length === 0: "No decisions added"        | P1       | Centered text                  |
| LEAD-072 | Resolved decision: green badge "Resolved"           | P0       | resolvedAt truthy              |
| LEAD-073 | Unresolved decision: destructive badge "Unresolved" | P0       | resolvedAt falsy               |
| LEAD-074 | Disabled state: opacity-50                          | P2       | Submitted section              |

### 3.7 Priorities Editor

| #        | Scenario                                       | Priority | Expected                  |
| -------- | ---------------------------------------------- | -------- | ------------------------- |
| LEAD-080 | 3 priority rows displayed (rank 1, 2, 3)       | P0       | Numbered circles + inputs |
| LEAD-081 | Priority text editable                         | P0       | Input accepts text        |
| LEAD-082 | Priority change triggers autosave              | P0       | saveDraft called          |
| LEAD-083 | Disabled state: opacity-50 pointer-events-none | P1       | Submitted section         |
| LEAD-084 | aria-label "Priority {rank}" on each input     | P3       | Accessibility             |
| LEAD-085 | Label htmlFor matches input id                 | P3       | label/input association   |

### 3.8 Submit Flow

| #        | Scenario                                         | Priority | Expected                          |
| -------- | ------------------------------------------------ | -------- | --------------------------------- |
| LEAD-090 | "Submit Section" button visible when draft       | P0       | Button rendered                   |
| LEAD-091 | "Submit Section" button hidden when submitted    | P0       | Badge "Section submitted" instead |
| LEAD-092 | Click "Submit" opens ConfirmDialog               | P0       | Dialog with title + description   |
| LEAD-093 | Confirm dialog: "Submit Section" title           | P2       | Correct text                      |
| LEAD-094 | Cancel in dialog: form stays editable            | P0       | No mutation called                |
| LEAD-095 | Confirm in dialog: submit mutation called        | P0       | reports.submit fires              |
| LEAD-096 | Successful submit: toast "Section submitted"     | P0       | Success toast appears             |
| LEAD-097 | After submit: form becomes read-only             | P0       | All inputs disabled               |
| LEAD-098 | Submit validation: missing traffic light → error | P0       | Error alert with project name     |
| LEAD-099 | Submit validation: missing current item → error  | P0       | Error alert with project name     |
| LEAD-100 | Submit validation: < 3 priorities → error        | P0       | Error alert about priorities      |
| LEAD-101 | Submit validation: empty priority text → error   | P0       | Non-empty check                   |
| LEAD-102 | Multiple validation errors: all shown in alert   | P1       | errors[] rendered as <ul>         |
| LEAD-103 | Submit already submitted section: BAD_REQUEST    | P0       | SECTION_ALREADY_SUBMITTED         |
| LEAD-104 | `confirmed: true` literal required by Zod        | P1       | confirmed: false fails parse      |
| LEAD-105 | Submit with empty projectStatuses array          | P0       | Zod requires min(1)               |

### 3.9 tRPC API — Lead

| #        | Scenario                                          | Priority | Expected                                   |
| -------- | ------------------------------------------------- | -------- | ------------------------------------------ |
| LEAD-110 | reports.getActive with valid session              | P0       | Returns full section read model            |
| LEAD-111 | reports.getActive with null activeReportSectionId | P0       | INTERNAL_SERVER_ERROR                      |
| LEAD-112 | reports.saveDraft with valid payload              | P0       | Section updated, returned                  |
| LEAD-113 | reports.saveDraft on submitted section            | P0       | BAD_REQUEST SECTION_ALREADY_SUBMITTED      |
| LEAD-114 | reports.saveDraft with empty items array          | P1       | Accepted (items replaced with [])          |
| LEAD-115 | Item text validation: min(1) max(500)             | P1       | Empty string rejected, >500 chars rejected |
| LEAD-116 | Risk text validation: min(1) max(500)             | P1       | Validation enforced                        |
| LEAD-117 | Decision owner validation: min(1) max(200)        | P1       | Validation enforced                        |
| LEAD-118 | Priority rank validation: min(1) max(3)           | P1       | rank=0 or rank=4 rejected                  |
| LEAD-119 | saveDraft replaces all items (not merge)          | P0       | Old items deleted, new saved               |
| LEAD-120 | saveDraft replaces all priorities                 | P0       | Full array replacement                     |

---

## 4. HEAD DASHBOARD (DASH-001..DASH-040)

### 4.1 Page States

| #        | Scenario                                                 | Priority | Expected                          |
| -------- | -------------------------------------------------------- | -------- | --------------------------------- |
| DASH-001 | Loading state: skeleton                                  | P1       | PageTitleSkeleton + TableSkeleton |
| DASH-002 | Error state: QueryError                                  | P0       | Alert with retry                  |
| DASH-003 | Loaded: heading + "Open assembled report" button + table | P0       | All elements visible              |
| DASH-004 | "Open assembled report" links to /head/report            | P0       | Correct href                      |

### 4.2 Submission Dashboard Table

| #        | Scenario                                          | Priority | Expected                    |
| -------- | ------------------------------------------------- | -------- | --------------------------- |
| DASH-010 | All 6 leads displayed (seed data)                 | P0       | 6 rows in table             |
| DASH-011 | Lead Name column sortable                         | P1       | Click header toggles sort   |
| DASH-012 | Status column sortable                            | P1       | Click header toggles sort   |
| DASH-013 | Submitted At column sortable                      | P1       | Click header toggles sort   |
| DASH-014 | Submitted lead: green badge "Submitted"           | P0       | bg-green-100 text-green-800 |
| DASH-015 | Draft lead: outline badge "Draft"                 | P0       | variant="outline"           |
| DASH-016 | Submitted lead: datetime displayed (ru-RU)        | P1       | Formatted date              |
| DASH-017 | Draft lead: "—" in Submitted column               | P1       | Em-dash for null            |
| DASH-018 | Projects column: comma-separated names            | P1       | "Project 1, Project 2"      |
| DASH-019 | Sort order: draft first, then by name (ru locale) | P0       | Business rule               |
| DASH-020 | Progress bar shows correct ratio                  | P0       | submittedCount/total        |
| DASH-021 | Progress label: "{n} of {m} leads submitted"      | P1       | Correct text                |
| DASH-022 | All leads submitted: 100% progress                | P1       | Full bar                    |
| DASH-023 | No leads submitted: 0% progress                   | P1       | Empty bar                   |
| DASH-024 | Zero total leads: percentage = 0                  | P2       | Edge case                   |

### 4.3 tRPC API — Dashboard

| #        | Scenario                                        | Priority | Expected                                        |
| -------- | ----------------------------------------------- | -------- | ----------------------------------------------- |
| DASH-030 | review.dashboard with valid head session        | P0       | Array of rows returned                          |
| DASH-031 | review.dashboard with null activeReportId       | P0       | INTERNAL_SERVER_ERROR                           |
| DASH-032 | review.dashboard as lead                        | P1       | Allowed (protectedProcedure, not headProcedure) |
| DASH-033 | review.dashboard as viewer                      | P1       | Allowed                                         |
| DASH-034 | Dashboard with no sections (empty report)       | P2       | Empty array returned                            |
| DASH-035 | Dashboard row sorting: Russian locale collation | P2       | "Авдеев" before "Борисов"                       |

---

## 5. ASSEMBLED REPORT REVIEW (REV-001..REV-060)

### 5.1 Page States

| #       | Scenario                                       | Priority | Expected                            |
| ------- | ---------------------------------------------- | -------- | ----------------------------------- |
| REV-001 | Loading: skeleton                              | P1       | PageTitleSkeleton + 3× CardSkeleton |
| REV-002 | Error: QueryError with retry                   | P0       | Alert                               |
| REV-003 | No data: Alert "No assembled report available" | P0       | Friendly message                    |
| REV-004 | Draft report: editable assembled view          | P0       | Inputs/buttons active               |
| REV-005 | Published report: read-only view               | P0       | Everything disabled                 |

### 5.2 Report Header

| #       | Scenario                                | Priority | Expected                |
| ------- | --------------------------------------- | -------- | ----------------------- |
| REV-010 | Title "Assembled Report" displayed      | P1       | Heading                 |
| REV-011 | Portfolio status badge (outline)        | P0       | Color matches status    |
| REV-012 | Published badge when status='published' | P1       | Green badge "Published" |
| REV-013 | No published badge when draft           | P2       | Not rendered            |

### 5.3 Section Cards

| #       | Scenario                                        | Priority | Expected                                     |
| ------- | ----------------------------------------------- | -------- | -------------------------------------------- |
| REV-020 | One card per lead section                       | P0       | 6 cards for seed data                        |
| REV-021 | Card title = section.authorName                 | P0       | Lead name displayed                          |
| REV-022 | Separator between sections (index > 0)          | P2       | Visual separation                            |
| REV-023 | First project traffic light radiogroup          | P1       | Head can change lights                       |
| REV-024 | Head edits traffic light on draft report        | P0       | updateSectionForReview mutation              |
| REV-025 | Head edits traffic light on published report    | P0       | Disabled, cursor-not-allowed                 |
| REV-026 | First item text editable on draft               | P1       | Input enabled                                |
| REV-027 | First item text disabled on published           | P1       | Input disabled                               |
| REV-028 | Traffic light radiogroup aria-label             | P3       | "{authorName} / {projectName} traffic light" |
| REV-029 | Section with no projects: no traffic light area | P2       | firstProject undefined                       |
| REV-030 | Section with no items: no item input            | P2       | firstItem undefined                          |

### 5.4 Publish Flow

| #       | Scenario                                     | Priority | Expected                                |
| ------- | -------------------------------------------- | -------- | --------------------------------------- |
| REV-040 | "Publish Report" button visible on draft     | P0       | Button rendered                         |
| REV-041 | "Publish Report" button hidden on published  | P0       | Not rendered                            |
| REV-042 | Click "Publish" opens ConfirmDialog          | P0       | Title + description                     |
| REV-043 | Dialog description warns about immutability  | P1       | "Published reports cannot be edited"    |
| REV-044 | Cancel: no mutation                          | P0       | Report stays draft                      |
| REV-045 | Confirm: review.publish called               | P0       | Mutation fires                          |
| REV-046 | Publish loading: spinner in button           | P1       | Loader2 animation                       |
| REV-047 | Successful publish: toast "Report published" | P0       | "The report is now visible to viewers." |
| REV-048 | After publish: form becomes read-only        | P0       | All inputs disabled                     |
| REV-049 | Publish already published: CONFLICT error    | P0       | Server rejects                          |
| REV-050 | Publish as lead: FORBIDDEN                   | P0       | headProcedure blocks                    |

### 5.5 Portfolio Overview Calculation

| #       | Scenario                                      | Priority | Expected                      |
| ------- | --------------------------------------------- | -------- | ----------------------------- |
| REV-055 | All green → portfolio green                   | P0       | totals.red=0, totals.yellow=0 |
| REV-056 | Any yellow, no red → portfolio yellow         | P0       | totals.red=0                  |
| REV-057 | Any red → portfolio red                       | P0       | red > 0 takes priority        |
| REV-058 | Mixed red+yellow+green → portfolio red        | P0       | Red dominates                 |
| REV-059 | All unset (no traffic lights) → green default | P2       | Edge case                     |
| REV-060 | Sections sorted by authorName (ru locale)     | P1       | Alphabetical in Russian       |

---

## 6. ARCHIVE & HISTORY (ARC-001..ARC-050)

### 6.1 History Page

| #       | Scenario                                  | Priority | Expected                          |
| ------- | ----------------------------------------- | -------- | --------------------------------- |
| ARC-001 | Loading: skeleton                         | P1       | PageTitleSkeleton + TableSkeleton |
| ARC-002 | Error: QueryError with retry              | P0       | Alert                             |
| ARC-003 | Empty list: DataTable empty state         | P1       | "No data yet" + subtitle          |
| ARC-004 | Published reports listed                  | P0       | All published reports in table    |
| ARC-005 | Sorted by publishedAt descending          | P0       | Newest first                      |
| ARC-006 | Period column: "{start} – {end}" in ru-RU | P1       | Formatted dates                   |
| ARC-007 | Portfolio Status: TrafficLightBadge       | P0       | Color dot + label                 |
| ARC-008 | Published column: formatted date          | P1       | ru-RU format                      |
| ARC-009 | "Open" button links to /reports/{id}      | P0       | Correct href                      |
| ARC-010 | Row click navigates to /reports/{id}      | P1       | Cursor pointer, router.push       |
| ARC-011 | Period column sortable                    | P1       | Sort toggling                     |
| ARC-012 | Portfolio column sortable                 | P2       | Sort toggling                     |
| ARC-013 | Published column sortable                 | P1       | Sort toggling                     |
| ARC-014 | Accessible as head                        | P0       | protectedProcedure                |
| ARC-015 | Accessible as viewer                      | P0       | protectedProcedure                |

### 6.2 Published Report Detail Page

| #       | Scenario                                        | Priority | Expected                            |
| ------- | ----------------------------------------------- | -------- | ----------------------------------- |
| ARC-020 | Loading: skeleton                               | P1       | PageTitleSkeleton + 4× CardSkeleton |
| ARC-021 | Error: QueryError with retry                    | P0       | Alert                               |
| ARC-022 | Report not found: destructive Alert             | P0       | "Published report not found"        |
| ARC-023 | Report loaded: full PublishedReport component   | P0       | All sections rendered               |
| ARC-024 | Portfolio overview card with TrafficLightBadge  | P0       | Color matches status                |
| ARC-025 | Section cards with author name                  | P0       | Lead names                          |
| ARC-026 | Projects block: TrafficLightBadge per project   | P0       | If projects.length > 0              |
| ARC-027 | Projects block hidden if empty                  | P1       | Conditional render                  |
| ARC-028 | Items block: <ul> with items                    | P0       | If items.length > 0                 |
| ARC-029 | Items block hidden if empty                     | P1       | Conditional render                  |
| ARC-030 | Item with tag: Badge visible                    | P1       | tag text in Badge                   |
| ARC-031 | Item without tag: no Badge                      | P2       | Clean display                       |
| ARC-032 | Risks block: risk + impact + mitigation         | P0       | If risks.length > 0                 |
| ARC-033 | Risks block hidden if empty                     | P1       | Conditional                         |
| ARC-034 | Decisions block: resolved/unresolved badge      | P0       | If decisions.length > 0             |
| ARC-035 | Decisions block hidden if empty                 | P1       | Conditional                         |
| ARC-036 | Resolved decision: "Resolved" default badge     | P0       | variant="default"                   |
| ARC-037 | Unresolved decision: "Unresolved" outline badge | P0       | variant="outline"                   |
| ARC-038 | Priorities block: <ol> sorted by rank           | P0       | If priorities.length > 0            |
| ARC-039 | Priorities block hidden if empty                | P1       | Conditional                         |
| ARC-040 | publishedByName shown if available              | P1       | "Published ... by {name}"           |
| ARC-041 | publishedByName null: no "by" suffix            | P2       | Just "Published {date}"             |
| ARC-042 | Separator between sections (index > 0)          | P2       | Visual                              |

### 6.3 PDF Export from Detail Page

| #       | Scenario                                              | Priority | Expected                   |
| ------- | ----------------------------------------------------- | -------- | -------------------------- |
| ARC-043 | "Export PDF" button visible (no active job)           | P0       | Outline button             |
| ARC-044 | Click "Export PDF" → toast "PDF export started"       | P0       | pdfExport.request mutation |
| ARC-045 | Job queued: disabled button "Exporting..." + spinner  | P0       | Polling starts             |
| ARC-046 | Job processing: still showing spinner                 | P1       | Poll interval 2000ms       |
| ARC-047 | Job completed with artifactUrl: "Download PDF" button | P0       | <a download>               |
| ARC-048 | Job failed: status badge shows "failed"               | P1       | Error state                |
| ARC-049 | Polling stops on completed                            | P1       | refetchInterval disabled   |
| ARC-050 | Polling stops on failed                               | P1       | refetchInterval disabled   |

### 6.4 tRPC API — Archive

| #       | Scenario                                             | Priority | Expected              |
| ------- | ---------------------------------------------------- | -------- | --------------------- |
| ARC-051 | archive.list returns sorted by publishedAt desc      | P0       | Newest first          |
| ARC-052 | archive.list returns empty when no published reports | P1       | []                    |
| ARC-053 | archive.detail with valid reportId                   | P0       | Full assembled report |
| ARC-054 | archive.detail with non-existent reportId            | P0       | NOT_FOUND             |
| ARC-055 | archive.detail accessible by viewer                  | P0       | No role restriction   |

---

## 7. PRINT PAGE (PRINT-001..PRINT-050)

| #         | Scenario                                         | Priority | Expected                         |
| --------- | ------------------------------------------------ | -------- | -------------------------------- |
| PRINT-001 | Loading: "Loading report for print..." paragraph | P1       | Plain text                       |
| PRINT-002 | Error: "Error loading report." paragraph         | P1       | Plain text                       |
| PRINT-003 | Not found: "Report not found." paragraph         | P1       | Plain text                       |
| PRINT-004 | No AppShell wrapper (no nav)                     | P0       | Clean print layout               |
| PRINT-005 | Max width 1100px, centered                       | P2       | Layout constraint                |
| PRINT-006 | print:p-0 print:bg-white on main                 | P0       | Print CSS                        |
| PRINT-007 | Report title "Weekly Status Report"              | P0       | h1 element                       |
| PRINT-008 | Date range formatted (en-US long)                | P1       | "April 6, 2026 — April 12, 2026" |
| PRINT-009 | publishedAt shown if available                   | P1       | "Published {date}"               |
| PRINT-010 | publishedByName appended if available            | P2       | "Published {date} by {name}"     |
| PRINT-011 | publishedAt null: no publication line            | P2       | Omitted                          |
| PRINT-012 | Portfolio overview card                          | P0       | TrafficLightBadge                |
| PRINT-013 | Cards: print:shadow-none print:border            | P1       | Print styling                    |
| PRINT-014 | Section cards: break-inside-avoid                | P0       | No page break in middle          |
| PRINT-015 | Sections after first: break-before-page          | P0       | Each lead starts new page        |
| PRINT-016 | Projects block rendered if projects > 0          | P0       | Conditional                      |
| PRINT-017 | Projects block hidden if empty                   | P1       | Conditional                      |
| PRINT-018 | Items block rendered if items > 0                | P0       | Conditional                      |
| PRINT-019 | Items block hidden if empty                      | P1       | Conditional                      |
| PRINT-020 | Item with tag: Badge variant="outline"           | P1       | Tag shown                        |
| PRINT-021 | Item without tag: no Badge                       | P2       | Clean                            |
| PRINT-022 | Risks rendered if risks > 0                      | P0       | Risk/impact/mitigation           |
| PRINT-023 | Risks hidden if empty                            | P1       | Conditional                      |
| PRINT-024 | Decisions rendered if decisions > 0              | P0       | Text + resolved badge            |
| PRINT-025 | Decisions hidden if empty                        | P1       | Conditional                      |
| PRINT-026 | Resolved: "Resolved" default badge               | P0       | Correct variant                  |
| PRINT-027 | Unresolved: "Unresolved" outline badge           | P0       | Correct variant                  |
| PRINT-028 | Priorities rendered if priorities > 0            | P0       | <ol> sorted by rank              |
| PRINT-029 | Priorities hidden if empty                       | P1       | Conditional                      |
| PRINT-030 | Priorities sorted ascending by rank              | P0       | .sort((a,b) => a.rank - b.rank)  |
| PRINT-031 | OKLCH colors have hex fallbacks for print        | P0       | @media print CSS                 |
| PRINT-032 | Traffic light green hex fallback                 | P1       | #22c55e or similar               |
| PRINT-033 | Traffic light yellow hex fallback                | P1       | Hex value                        |
| PRINT-034 | Traffic light red hex fallback                   | P1       | Hex value                        |
| PRINT-035 | Background colors print correctly                | P1       | -webkit-print-color-adjust       |
| PRINT-036 | Font is Inter with Cyrillic support              | P2       | Russian text renders             |
| PRINT-037 | Date format function handles string input        | P2       | typeof check                     |
| PRINT-038 | Date format function handles Date input          | P2       | typeof check                     |
| PRINT-039 | isTrafficLightStatus validates "green"           | P2       | Returns true                     |
| PRINT-040 | isTrafficLightStatus validates "yellow"          | P2       | Returns true                     |
| PRINT-041 | isTrafficLightStatus validates "red"             | P2       | Returns true                     |
| PRINT-042 | isTrafficLightStatus rejects null                | P2       | Returns false                    |
| PRINT-043 | isTrafficLightStatus rejects unknown string      | P2       | Returns false                    |
| PRINT-044 | toTrafficLightStatus defaults to 'unset'         | P2       | Fallback                         |
| PRINT-045 | Browser print dialog: Ctrl+P / Cmd+P             | P0       | Page formats correctly           |
| PRINT-046 | PDF via Playwright page.pdf()                    | P0       | Generates valid PDF              |
| PRINT-047 | Multi-section report: page breaks work           | P0       | Each section on new page         |
| PRINT-048 | Single-section report: no break-before-page      | P2       | Index 0 excluded                 |
| PRINT-049 | Long item list doesn't overflow card             | P1       | break-inside-avoid               |
| PRINT-050 | Report with tRPC archive.detail query            | P0       | Data loads correctly             |

---

## 8. ADMIN PANEL (ADM-001..ADM-180)

### 8.1 Page States

| #       | Scenario                          | Priority | Expected                          |
| ------- | --------------------------------- | -------- | --------------------------------- |
| ADM-001 | Loading: skeleton                 | P1       | PageTitleSkeleton + TableSkeleton |
| ADM-002 | Error: QueryError with retry      | P0       | Alert                             |
| ADM-003 | No snapshot data: Alert "No data" | P1       | "No admin data available..."      |
| ADM-004 | Loaded: AdminPanel with 4 tabs    | P0       | Tabs visible                      |
| ADM-005 | Lead access: FORBIDDEN            | P0       | headProcedure blocks              |
| ADM-006 | Viewer access: FORBIDDEN          | P0       | headProcedure blocks              |

### 8.2 Users Tab

| #       | Scenario                                                    | Priority | Expected                                   |
| ------- | ----------------------------------------------------------- | -------- | ------------------------------------------ |
| ADM-010 | Users table displays all seeded users                       | P0       | 8+ rows                                    |
| ADM-011 | Name column sortable                                        | P1       | Sort toggle                                |
| ADM-012 | Email displayed                                             | P1       | Correct emails                             |
| ADM-013 | Role badge: "default" for head, "secondary" for lead/viewer | P1       | Correct styling                            |
| ADM-014 | "Remove" button hidden for head users                       | P0       | Cannot delete self                         |
| ADM-015 | "Remove" button visible for lead/viewer users               | P0       | Action available                           |
| ADM-016 | Click "Add User" opens CrudSheet                            | P0       | Sheet slides in                            |
| ADM-017 | Add User form: Name, Email, Role fields                     | P0       | All 3 fields                               |
| ADM-018 | Role select defaults to "lead"                              | P2       | Default selection                          |
| ADM-019 | Submit Add User: saveUser mutation                          | P0       | admin.saveUser called                      |
| ADM-020 | Success toast: "User added" + description                   | P0       | "{name} has been added as {role}"          |
| ADM-021 | Sheet closes after success                                  | P1       | onOpenChange(false)                        |
| ADM-022 | Click "Remove": ConfirmDialog opens                         | P0       | "Remove User" title                        |
| ADM-023 | Dialog shows user name in description                       | P1       | "This will remove {name}..."               |
| ADM-024 | Confirm delete: deleteUser mutation                         | P0       | admin.deleteUser called                    |
| ADM-025 | Success toast: "Deleted" + description                      | P0       | "{name} has been removed"                  |
| ADM-026 | Delete non-existent userId                                  | P2       | Silently succeeds (filter removes nothing) |
| ADM-027 | Delete user with existing report sections                   | P1       | Prisma throws (onDelete: Restrict)         |
| ADM-028 | Delete own userId as head                                   | P1       | No server-side block (edge case!)          |
| ADM-029 | Loading spinner during save                                 | P1       | Loader2 in button                          |
| ADM-030 | Loading spinner during delete                               | P1       | Loader2 in button                          |
| ADM-031 | Both buttons disabled during loading                        | P1       | Prevents double-click                      |
| ADM-032 | Email uniqueness at DB level                                | P1       | Prisma unique constraint error             |

### 8.3 Projects Tab

| #       | Scenario                                            | Priority | Expected                 |
| ------- | --------------------------------------------------- | -------- | ------------------------ |
| ADM-040 | Projects table displays all projects                | P0       | 6 rows (seed)            |
| ADM-041 | Name column sortable                                | P1       | Sort toggle              |
| ADM-042 | Lead name displayed                                 | P1       | Assigned lead            |
| ADM-043 | Active project: badge "Active" secondary            | P1       | archived=false           |
| ADM-044 | Archived project: badge "Archived" outline          | P1       | archived=true            |
| ADM-045 | Click "Add Project": CrudSheet opens                | P0       | "Add Project" title      |
| ADM-046 | Submit: saveProject mutation                        | P0       | admin.saveProject called |
| ADM-047 | Success toast: "Project created"                    | P0       | Toast appears            |
| ADM-048 | leadId referential integrity not checked at service | P2       | Edge case                |
| ADM-049 | Project with archived=true still in snapshot        | P1       | Soft delete behavior     |
| ADM-050 | Projects sorted by name (ru locale) after save      | P1       | Business rule            |

### 8.4 Periods Tab

| #       | Scenario                                         | Priority | Expected                                |
| ------- | ------------------------------------------------ | -------- | --------------------------------------- |
| ADM-060 | Periods table displays all report periods        | P0       | 1+ rows (seed)                          |
| ADM-061 | Period column: "{start} – {end}" formatted       | P1       | Date formatting                         |
| ADM-062 | Deadline column: formatted date                  | P1       | Date formatting                         |
| ADM-063 | Status badge ("draft" / "published")             | P1       | Correct text                            |
| ADM-064 | Click "Add Period": CrudSheet opens              | P0       | "Add Period" title                      |
| ADM-065 | Submit: savePeriod mutation                      | P0       | admin.savePeriod called                 |
| ADM-066 | Success toast: "Period created"                  | P0       | Toast                                   |
| ADM-067 | periodEnd before periodStart (no Zod validation) | P2       | Accepted by API                         |
| ADM-068 | Overlapping periods (no validation)              | P2       | Accepted by API                         |
| ADM-069 | "Run Carry-Over" button visible                  | P0       | In periods tab                          |
| ADM-070 | Click "Run Carry-Over": ConfirmDialog            | P0       | Title + description                     |
| ADM-071 | Carry-over with < 2 periods: toast error         | P0       | "Not enough periods to run carry-over." |
| ADM-072 | Carry-over success: toast + snapshot refresh     | P0       | "Pending items have been copied..."     |
| ADM-073 | Carry-over uses last 2 periods as source/target  | P0       | periods[-2] → periods[-1]               |
| ADM-074 | Carry-over loading spinner                       | P1       | Loader2                                 |

### 8.5 Reminders Tab

| #       | Scenario                                              | Priority | Expected                                     |
| ------- | ----------------------------------------------------- | -------- | -------------------------------------------- |
| ADM-080 | Reminders table displays all rules                    | P0       | Rows                                         |
| ADM-081 | Kind column sortable                                  | P1       | Sort toggle                                  |
| ADM-082 | Fire At: formatted datetime                           | P1       | Date formatting                              |
| ADM-083 | Status badge: "secondary" if active, "outline" if not | P1       | Styling                                      |
| ADM-084 | Last Execution column: email + status or "---"        | P1       | Conditional                                  |
| ADM-085 | "Run" button per rule                                 | P0       | Ghost button                                 |
| ADM-086 | Click "Run": ConfirmDialog                            | P0       | "Run Reminder" title                         |
| ADM-087 | Confirm: reminders.execute mutation                   | P0       | Called                                       |
| ADM-088 | Success toast: "Reminder sent" + email                | P0       | "Reminder sent to {email}"                   |
| ADM-089 | Execute paused rule: BAD_REQUEST                      | P0       | "Reminder execution requires an active rule" |
| ADM-090 | Execute non-existent rule: BAD_REQUEST                | P1       | "Reminder rule ... was not found"            |
| ADM-091 | Deduplication: same rule+email returns existing       | P1       | No duplicate queue job                       |
| ADM-092 | Click "Add Rule": CrudSheet opens                     | P0       | "Add Reminder Rule" title                    |
| ADM-093 | Submit: saveReminderRule mutation                     | P0       | admin.saveReminderRule called                |
| ADM-094 | Success toast: "Reminder rule created"                | P0       | Toast                                        |
| ADM-095 | Loading spinner during run                            | P1       | Loader2                                      |

### 8.6 tRPC API — Admin

| #       | Scenario                                             | Priority | Expected                            |
| ------- | ---------------------------------------------------- | -------- | ----------------------------------- |
| ADM-100 | admin.snapshot returns full data                     | P0       | users + projects + periods + rules  |
| ADM-101 | admin.saveUser upsert (new user)                     | P0       | User created                        |
| ADM-102 | admin.saveUser upsert (existing user)                | P0       | User updated                        |
| ADM-103 | admin.deleteUser removes from snapshot               | P0       | Hard delete                         |
| ADM-104 | admin.deleteProject sets archived=true               | P0       | Soft delete                         |
| ADM-105 | admin.deleteReminderRule removes from snapshot       | P0       | Hard delete                         |
| ADM-106 | admin.savePeriod upsert                              | P0       | Period created/updated              |
| ADM-107 | admin.saveReminderRule upsert                        | P0       | Rule created/updated                |
| ADM-108 | All admin mutations return full snapshot             | P1       | Complete data for optimistic update |
| ADM-109 | Admin snapshot is single write unit (race condition) | P2       | Concurrent mutations may conflict   |
| ADM-110 | Users sorted by name (ru locale) after save          | P1       | Consistent ordering                 |

### 8.7 Carry-Over Business Logic

| #       | Scenario                                              | Priority | Expected                         |
| ------- | ----------------------------------------------------- | -------- | -------------------------------- |
| ADM-120 | Items type='next' + carriedOver=false → cloned        | P0       | Core carry-over rule             |
| ADM-121 | Items type='current' → not carried                    | P0       | Skipped                          |
| ADM-122 | Items already carriedOver=true → not carried          | P0       | Skipped                          |
| ADM-123 | Carried item: type forced to 'current'                | P0       | Type changed                     |
| ADM-124 | Carried item: carriedOver=true                        | P0       | Flag set                         |
| ADM-125 | Carried item: completed=null                          | P0       | Reset                            |
| ADM-126 | Carried item: new UUID generated                      | P0       | Not same as source               |
| ADM-127 | Unresolved decisions → cloned                         | P0       | resolvedAt=null decisions        |
| ADM-128 | Resolved decisions → not carried                      | P0       | Skipped                          |
| ADM-129 | Carried decision: new UUID                            | P0       | Not same as source               |
| ADM-130 | Carried decision: resolvedAt=null                     | P0       | Reset                            |
| ADM-131 | Deduplication: second call same source/target         | P0       | Returns existing, no duplicates  |
| ADM-132 | sourceReportId === targetReportId                     | P0       | BAD_REQUEST                      |
| ADM-133 | Source section not found                              | P0       | BAD_REQUEST                      |
| ADM-134 | Target section not found                              | P0       | BAD_REQUEST                      |
| ADM-135 | Empty source (no next items, no unresolved decisions) | P1       | Execution created with 0 records |

---

## 9. PDF EXPORT API (PDF-001..PDF-030)

| #       | Scenario                                                | Priority | Expected                      |
| ------- | ------------------------------------------------------- | -------- | ----------------------------- |
| PDF-001 | pdfExport.request on published report                   | P0       | Job created, status=queued    |
| PDF-002 | pdfExport.request on draft report                       | P0       | NOT_FOUND error               |
| PDF-003 | pdfExport.request on non-existent report                | P0       | NOT_FOUND error               |
| PDF-004 | pdfExport.request as lead                               | P0       | FORBIDDEN                     |
| PDF-005 | pdfExport.request as viewer                             | P0       | FORBIDDEN                     |
| PDF-006 | Multiple jobs for same reportId allowed                 | P2       | No deduplication              |
| PDF-007 | templateVersion = 'phase-2-pdf-v1'                      | P3       | Hardcoded                     |
| PDF-008 | BullMQ disabled: job created but not enqueued           | P1       | Status stays 'queued' forever |
| PDF-009 | pdfExport.status with valid jobId                       | P0       | Returns job status            |
| PDF-010 | pdfExport.status with non-existent jobId                | P0       | NOT_FOUND                     |
| PDF-011 | pdfExport.status accessible by any auth user            | P2       | No ownership check            |
| PDF-012 | Job status transitions: queued → processing → completed | P1       | State machine                 |
| PDF-013 | Job status: queued → processing → failed                | P1       | Error path                    |
| PDF-014 | Completed job has artifactUrl                           | P0       | Download link                 |
| PDF-015 | Completed job has checksum                              | P2       | File integrity                |
| PDF-016 | Failed job has null artifactUrl                         | P1       | No download                   |

---

## 10. REMINDERS API (REM-001..REM-020)

| #       | Scenario                                          | Priority | Expected                         |
| ------- | ------------------------------------------------- | -------- | -------------------------------- |
| REM-001 | reminders.execute with active rule                | P0       | Execution created, status=queued |
| REM-002 | reminders.execute with paused rule                | P0       | BAD_REQUEST                      |
| REM-003 | reminders.execute with non-existent rule          | P0       | BAD_REQUEST                      |
| REM-004 | reminders.execute as lead                         | P0       | FORBIDDEN                        |
| REM-005 | Deduplication by ruleId:fireAt:recipientEmail     | P0       | Second call returns existing     |
| REM-006 | BullMQ disabled: execution created, no email sent | P1       | Status stays 'queued'            |
| REM-007 | recipientEmail not validated as existing user     | P2       | Any email accepted               |
| REM-008 | reminders.listExecutions with valid ruleId        | P0       | Array returned                   |
| REM-009 | reminders.listExecutions with no executions       | P1       | Empty array                      |
| REM-010 | reminders.listExecutions as lead                  | P0       | FORBIDDEN                        |

---

## 11. NAVIGATION & APP SHELL (NAV-001..NAV-060)

### 11.1 Sidebar

| #       | Scenario                                    | Priority | Expected                             |
| ------- | ------------------------------------------- | -------- | ------------------------------------ |
| NAV-001 | Sidebar renders on desktop                  | P0       | Visible on lg+                       |
| NAV-002 | Sidebar collapsible to icon mode            | P1       | Click trigger collapses              |
| NAV-003 | Header "CustomReport" hidden when collapsed | P2       | group-data-[collapsible=icon]:hidden |
| NAV-004 | Sidebar trigger button works                | P1       | Toggles collapse                     |

### 11.2 Role-Based Nav Items

| #       | Scenario                                                     | Priority | Expected                    |
| ------- | ------------------------------------------------------------ | -------- | --------------------------- |
| NAV-010 | Lead sees: "My Report" only                                  | P0       | Single item                 |
| NAV-011 | Head sees: Dashboard, Assembled, Published\*, History, Admin | P0       | 5 items (4 if no published) |
| NAV-012 | Viewer sees: Published\*, History                            | P0       | 2 items (1 if no published) |
| NAV-013 | "Published Report" hidden when activeReportId=null           | P0       | Conditional render          |
| NAV-014 | "Published Report" visible when activeReportId set           | P0       | Link to /reports/{id}       |
| NAV-015 | Current path highlighted (isActive)                          | P1       | Active styling              |
| NAV-016 | No visible items → returns null                              | P2       | Empty nav area              |

### 11.3 Mobile Nav

| #       | Scenario                                     | Priority | Expected                           |
| ------- | -------------------------------------------- | -------- | ---------------------------------- |
| NAV-020 | Mobile nav hidden on desktop (lg:hidden)     | P1       | Not visible on lg+                 |
| NAV-021 | Hamburger button visible on mobile           | P0       | Menu icon                          |
| NAV-022 | Click hamburger opens Sheet from left        | P0       | Sheet slides in                    |
| NAV-023 | Sheet width 280px                            | P2       | Consistent                         |
| NAV-024 | Sheet header "CustomReport"                  | P2       | Brand                              |
| NAV-025 | All role-filtered nav items shown            | P0       | Same as sidebar                    |
| NAV-026 | Active item highlighted                      | P1       | bg-primary text-primary-foreground |
| NAV-027 | Click nav item closes sheet                  | P0       | setOpen(false)                     |
| NAV-028 | Min touch target height 44px                 | P2       | Accessibility                      |
| NAV-029 | aria-label="Open navigation menu" on trigger | P3       | Accessibility                      |
| NAV-030 | aria-label="Mobile navigation" on nav        | P3       | Accessibility                      |
| NAV-031 | aria-current="page" on active item           | P3       | Accessibility                      |

### 11.4 NavUser

| #       | Scenario                               | Priority | Expected               |
| ------- | -------------------------------------- | -------- | ---------------------- |
| NAV-040 | Dropdown trigger: Avatar with initials | P1       | First letters          |
| NAV-041 | Single-word name: one initial          | P2       | "Admin" → "A"          |
| NAV-042 | Two-word name: two initials            | P2       | "John Doe" → "JD"      |
| NAV-043 | Empty name: empty initials             | P3       | Edge case              |
| NAV-044 | User name hidden on mobile             | P2       | hidden lg:inline-block |
| NAV-045 | Dropdown: name + role badge            | P1       | Label area             |
| NAV-046 | Role badge: Lead/Head/Viewer           | P1       | Correct label          |
| NAV-047 | "Log out" item links to /auth/logout   | P0       | Correct href           |
| NAV-048 | Separator between label and menu items | P3       | Visual                 |

### 11.5 QueryError Component

| #       | Scenario                                                | Priority | Expected           |
| ------- | ------------------------------------------------------- | -------- | ------------------ |
| NAV-050 | UNAUTHORIZED error → auto-redirect to login             | P0       | useEffect redirect |
| NAV-051 | Network error (contains "fetch") → "Connection error"   | P0       | Heading            |
| NAV-052 | Network error (contains "network") → "Connection error" | P0       | Case-insensitive   |
| NAV-053 | FORBIDDEN error → "Something went wrong" + permissions  | P0       | Specific body      |
| NAV-054 | Generic error → "Something went wrong" + generic body   | P0       | Fallback           |
| NAV-055 | onRetry provided → Retry button visible                 | P1       | Button rendered    |
| NAV-056 | onRetry absent → Retry button hidden                    | P1       | Not rendered       |
| NAV-057 | Click retry triggers onRetry callback                   | P0       | Refetch fires      |

---

## 12. DESIGN SYSTEM COMPONENTS (DS-001..DS-060)

### 12.1 DataTable

| #      | Scenario                                  | Priority | Expected          |
| ------ | ----------------------------------------- | -------- | ----------------- |
| DS-001 | Empty data: "No data yet" + subtitle      | P0       | Full-colspan row  |
| DS-002 | Data rows rendered                        | P0       | One row per item  |
| DS-003 | Sortable column: click toggles asc        | P0       | ChevronUp icon    |
| DS-004 | Sortable column: click again toggles desc | P0       | ChevronDown icon  |
| DS-005 | Sortable column: third click resets       | P0       | No icon           |
| DS-006 | aria-sort="ascending" on asc column       | P3       | Accessibility     |
| DS-007 | aria-sort="descending" on desc column     | P3       | Accessibility     |
| DS-008 | onRowClick: cursor-pointer on rows        | P1       | Clickable styling |
| DS-009 | No onRowClick: default cursor             | P2       | Not clickable     |

### 12.2 ConfirmDialog

| #      | Scenario                                     | Priority | Expected            |
| ------ | -------------------------------------------- | -------- | ------------------- |
| DS-010 | Open renders dialog with title + description | P0       | Elements visible    |
| DS-011 | Cancel button closes dialog                  | P0       | onOpenChange(false) |
| DS-012 | Confirm button fires onConfirm               | P0       | Callback called     |
| DS-013 | loading=true: spinner in confirm button      | P0       | Loader2 visible     |
| DS-014 | loading=true: both buttons disabled          | P0       | No double-click     |
| DS-015 | variant="destructive": red confirm button    | P1       | Destructive styling |
| DS-016 | variant="default": default confirm button    | P1       | Normal styling      |

### 12.3 CrudSheet

| #      | Scenario                                    | Priority | Expected         |
| ------ | ------------------------------------------- | -------- | ---------------- |
| DS-020 | Open renders sheet with title               | P0       | Sheet visible    |
| DS-021 | Description rendered if provided            | P1       | SheetDescription |
| DS-022 | Description omitted if not provided         | P2       | Not rendered     |
| DS-023 | Submit button rendered if onSubmit provided | P1       | Button visible   |
| DS-024 | Submit button omitted if no onSubmit        | P2       | Not rendered     |
| DS-025 | loading=true: spinner in submit button      | P0       | Loader2          |
| DS-026 | loading=true: submit button disabled        | P0       | Prevents double  |
| DS-027 | Default submitLabel: "Save Changes"         | P2       | Default text     |

### 12.4 TrafficLightBadge

| #      | Scenario                                            | Priority | Expected      |
| ------ | --------------------------------------------------- | -------- | ------------- |
| DS-030 | status="green": green styling + "Green" label       | P0       | Correct color |
| DS-031 | status="yellow": yellow styling + "Yellow" label    | P0       | Correct color |
| DS-032 | status="red": red styling + "Red" label             | P0       | Correct color |
| DS-033 | status="unset": neutral styling + "No Status" label | P0       | Default       |
| DS-034 | Custom label overrides default                      | P1       | label prop    |
| DS-035 | Colored dot is aria-hidden                          | P3       | Accessibility |

### 12.5 Skeletons

| #      | Scenario                                    | Priority | Expected           |
| ------ | ------------------------------------------- | -------- | ------------------ |
| DS-040 | PageTitleSkeleton: h-7 w-60                 | P3       | Correct dimensions |
| DS-041 | TableSkeleton: header + 5 rows              | P2       | Loading pattern    |
| DS-042 | CardSkeleton: h-40 w-full rounded-lg        | P3       | Correct dimensions |
| DS-043 | BadgeSkeleton: h-6 w-16 rounded-full        | P3       | Correct dimensions |
| DS-044 | AvatarSkeleton: size-8 rounded-full         | P3       | Correct dimensions |
| DS-045 | FormFieldSkeleton: label + input skeletons  | P3       | Correct pattern    |
| DS-046 | ParagraphSkeleton: 3 lines (100%, 90%, 60%) | P3       | Correct widths     |
| DS-047 | ButtonSkeleton: h-9 w-30 rounded-md         | P3       | Correct dimensions |

### 12.6 Toast Notifications (All Locations)

| #      | Scenario                                 | Priority | Expected                         |
| ------ | ---------------------------------------- | -------- | -------------------------------- |
| DS-050 | Toast position: bottom-right             | P2       | Correct positioning              |
| DS-051 | Rich colors enabled                      | P2       | Green for success, red for error |
| DS-052 | Close button on each toast               | P2       | Dismissible                      |
| DS-053 | "Section submitted" toast on lead submit | P0       | Success variant                  |
| DS-054 | "Report published" toast on head publish | P0       | Success variant                  |
| DS-055 | "User added" toast with name + role      | P0       | Descriptive                      |
| DS-056 | "Deleted" toast with name                | P0       | Descriptive                      |
| DS-057 | "Project created" toast                  | P0       | Success                          |
| DS-058 | "Period created" toast                   | P0       | Success                          |
| DS-059 | "Reminder rule created" toast            | P0       | Success                          |
| DS-060 | "Reminder sent" toast with email         | P0       | Descriptive                      |
| DS-061 | "Carry-over completed" toast             | P0       | Success                          |
| DS-062 | "Carry-over skipped" toast (error)       | P0       | Error variant                    |
| DS-063 | "PDF export started" toast (neutral)     | P0       | Neutral variant                  |

---

## 13. RESPONSIVE & MOBILE (RESP-001..RESP-030)

| #        | Scenario                                     | Priority | Expected                |
| -------- | -------------------------------------------- | -------- | ----------------------- |
| RESP-001 | Sidebar hidden on mobile (<lg)               | P0       | lg:hidden               |
| RESP-002 | MobileNav visible on mobile                  | P0       | Hamburger menu          |
| RESP-003 | Main content: p-4 on mobile, p-8 on desktop  | P1       | Padding change          |
| RESP-004 | Max content width 1200px                     | P2       | No overflow             |
| RESP-005 | ProjectStatusGrid: 1 col mobile, 2 col md+   | P1       | Responsive grid         |
| RESP-006 | CrudSheet width 400px on sm+                 | P2       | Fixed width             |
| RESP-007 | NavUser name hidden on mobile                | P2       | Only avatar             |
| RESP-008 | DataTable scrollable on small screens        | P2       | Horizontal scroll       |
| RESP-009 | Cards full-width on mobile                   | P2       | No side overflow        |
| RESP-010 | Header h-14 sticky                           | P2       | Stays visible on scroll |
| RESP-011 | 320px viewport: no horizontal scroll         | P1       | Content fits            |
| RESP-012 | 768px viewport: transition to desktop layout | P2       | Breakpoint              |
| RESP-013 | 1024px viewport: sidebar visible             | P2       | lg breakpoint           |
| RESP-014 | Touch targets min 44px on mobile nav         | P2       | min-h-[44px]            |
| RESP-015 | Print page: no responsive concerns           | P3       | Fixed 1100px            |

---

## 14. INFRASTRUCTURE & HEALTH (INFRA-001..INFRA-030)

| #         | Scenario                                         | Priority | Expected                      |
| --------- | ------------------------------------------------ | -------- | ----------------------------- |
| INFRA-001 | GET /health/live: 200 when heap < 200MB          | P0       | {status: "ok"}                |
| INFRA-002 | GET /health/live: 503 when heap > 200MB          | P1       | Service degraded              |
| INFRA-003 | GET /health/ready: 200 when DB + Redis + heap ok | P0       | All checks pass               |
| INFRA-004 | GET /health/ready: 503 when DB unreachable       | P0       | Prisma SELECT 1 fails         |
| INFRA-005 | GET /health/ready: 503 when Redis unreachable    | P0       | Ping fails                    |
| INFRA-006 | GET /metrics: Prometheus format                  | P1       | Node.js default metrics       |
| INFRA-007 | /metrics has no auth guard                       | P2       | Security concern (documented) |
| INFRA-008 | CorrelationId in response headers                | P2       | x-request-id set              |
| INFRA-009 | CorrelationId preserved from request             | P2       | Pass-through                  |
| INFRA-010 | CorrelationId generated if absent                | P2       | UUID generated                |
| INFRA-011 | Helmet headers present                           | P1       | CSP, X-Frame-Options          |
| INFRA-012 | CORS allows FRONTEND_URL                         | P0       | credentials: true             |
| INFRA-013 | CORS blocks other origins                        | P1       | Rejected                      |
| INFRA-014 | Cookie parser middleware active                  | P0       | req.cookies populated         |
| INFRA-015 | tRPC endpoint mounted at /trpc                   | P0       | Routes work                   |

---

## 15. DATA VALIDATION — ZOD SCHEMAS (ZOD-001..ZOD-080)

### 15.1 Item Validation

| #       | Scenario                          | Priority | Expected            |
| ------- | --------------------------------- | -------- | ------------------- |
| ZOD-001 | Item text empty string            | P0       | Rejected (min 1)    |
| ZOD-002 | Item text 500 chars               | P1       | Accepted (max 500)  |
| ZOD-003 | Item text 501 chars               | P1       | Rejected            |
| ZOD-004 | Item tag empty string             | P0       | Rejected (min 1)    |
| ZOD-005 | Item tag 50 chars                 | P1       | Accepted            |
| ZOD-006 | Item tag 51 chars                 | P1       | Rejected            |
| ZOD-007 | Item type "current"               | P0       | Valid enum          |
| ZOD-008 | Item type "next"                  | P0       | Valid enum          |
| ZOD-009 | Item type "invalid"               | P0       | Rejected            |
| ZOD-010 | Item workflowStatus "done"        | P0       | Valid               |
| ZOD-011 | Item workflowStatus "in_progress" | P0       | Valid               |
| ZOD-012 | Item workflowStatus "blocked"     | P0       | Valid               |
| ZOD-013 | Item workflowStatus "unknown"     | P0       | Rejected            |
| ZOD-014 | Item carriedOver boolean          | P1       | Accepted            |
| ZOD-015 | Item completed null               | P1       | Accepted (nullable) |
| ZOD-016 | Item completed true               | P1       | Accepted            |
| ZOD-017 | Item completed false              | P1       | Accepted            |
| ZOD-018 | Item id optional (new item)       | P1       | Accepted without id |
| ZOD-019 | Item id valid UUID                | P1       | Accepted            |
| ZOD-020 | Item id invalid string            | P1       | Rejected            |

### 15.2 Risk Validation

| #       | Scenario                  | Priority | Expected         |
| ------- | ------------------------- | -------- | ---------------- |
| ZOD-021 | Risk risk empty           | P0       | Rejected (min 1) |
| ZOD-022 | Risk risk 500 chars       | P1       | Accepted         |
| ZOD-023 | Risk risk 501 chars       | P1       | Rejected         |
| ZOD-024 | Risk impact empty         | P0       | Rejected         |
| ZOD-025 | Risk impact 500 chars     | P1       | Accepted         |
| ZOD-026 | Risk mitigation empty     | P0       | Rejected         |
| ZOD-027 | Risk mitigation 500 chars | P1       | Accepted         |
| ZOD-028 | Risk projectId valid UUID | P0       | Accepted         |
| ZOD-029 | Risk projectId invalid    | P0       | Rejected         |

### 15.3 Decision Validation

| #       | Scenario                       | Priority | Expected            |
| ------- | ------------------------------ | -------- | ------------------- |
| ZOD-030 | Decision text empty            | P0       | Rejected (min 1)    |
| ZOD-031 | Decision text 500 chars        | P1       | Accepted            |
| ZOD-032 | Decision owner empty           | P0       | Rejected (min 1)    |
| ZOD-033 | Decision owner 200 chars       | P1       | Accepted            |
| ZOD-034 | Decision owner 201 chars       | P1       | Rejected            |
| ZOD-035 | Decision deadline null         | P1       | Accepted (nullable) |
| ZOD-036 | Decision deadline valid date   | P1       | Coerced             |
| ZOD-037 | Decision impact empty          | P0       | Rejected            |
| ZOD-038 | Decision resolvedAt null       | P1       | Unresolved          |
| ZOD-039 | Decision resolvedAt valid date | P1       | Resolved            |

### 15.4 Priority Validation

| #       | Scenario                | Priority | Expected         |
| ------- | ----------------------- | -------- | ---------------- |
| ZOD-040 | Priority rank 0         | P0       | Rejected (min 1) |
| ZOD-041 | Priority rank 1         | P0       | Accepted         |
| ZOD-042 | Priority rank 3         | P0       | Accepted         |
| ZOD-043 | Priority rank 4         | P0       | Rejected (max 3) |
| ZOD-044 | Priority text empty     | P0       | Rejected (min 1) |
| ZOD-045 | Priority text 200 chars | P1       | Accepted         |
| ZOD-046 | Priority text 201 chars | P1       | Rejected         |

### 15.5 Submit Schema (Strict)

| #       | Scenario                             | Priority | Expected                             |
| ------- | ------------------------------------ | -------- | ------------------------------------ |
| ZOD-050 | confirmed: true                      | P0       | Accepted                             |
| ZOD-051 | confirmed: false                     | P0       | Rejected (literal true)              |
| ZOD-052 | confirmed: missing                   | P0       | Rejected                             |
| ZOD-053 | projectStatuses empty array          | P0       | Rejected (min 1)                     |
| ZOD-054 | projectStatuses with optional status | P0       | Rejected (status required on submit) |
| ZOD-055 | priorities length 2                  | P0       | Rejected (length 3)                  |
| ZOD-056 | priorities length 3                  | P0       | Accepted                             |
| ZOD-057 | priorities length 4                  | P0       | Rejected                             |

### 15.6 Auth Schemas

| #       | Scenario                         | Priority | Expected         |
| ------- | -------------------------------- | -------- | ---------------- |
| ZOD-060 | Role "lead"                      | P0       | Valid enum       |
| ZOD-061 | Role "head"                      | P0       | Valid            |
| ZOD-062 | Role "viewer"                    | P0       | Valid            |
| ZOD-063 | Role "admin"                     | P0       | Rejected         |
| ZOD-064 | UserSession all fields present   | P0       | Valid            |
| ZOD-065 | UserSession activeReportId null  | P1       | Valid (nullable) |
| ZOD-066 | UserSession userId invalid UUID  | P0       | Rejected         |
| ZOD-067 | UserSession email invalid format | P0       | Rejected         |

### 15.7 Admin Schemas

| #       | Scenario                      | Priority | Expected                |
| ------- | ----------------------------- | -------- | ----------------------- |
| ZOD-070 | AdminUser name empty          | P0       | Rejected (min 1)        |
| ZOD-071 | AdminUser email invalid       | P0       | Rejected (email format) |
| ZOD-072 | AdminProject name empty       | P0       | Rejected (min 1)        |
| ZOD-073 | ReminderRule timezone empty   | P0       | Rejected (min 1)        |
| ZOD-074 | ReminderRule version 0        | P0       | Rejected (min 1)        |
| ZOD-075 | ReminderRule kind "deadline"  | P0       | Valid                   |
| ZOD-076 | ReminderRule kind "follow_up" | P0       | Valid                   |
| ZOD-077 | ReminderRule kind "unknown"   | P0       | Rejected                |
| ZOD-078 | ReminderRule status "active"  | P0       | Valid                   |
| ZOD-079 | ReminderRule status "paused"  | P0       | Valid                   |
| ZOD-080 | ReminderRule status "unknown" | P0       | Rejected                |

---

## 16. DATABASE CONSTRAINTS (DB-001..DB-040)

| #      | Scenario                                               | Priority | Expected                             |
| ------ | ------------------------------------------------------ | -------- | ------------------------------------ |
| DB-001 | User email unique constraint                           | P0       | Duplicate rejected                   |
| DB-002 | User samlId unique constraint                          | P0       | Duplicate rejected                   |
| DB-003 | ReportSection unique [reportId, authorId]              | P0       | One section per lead per report      |
| DB-004 | ProjectStatus unique [reportSectionId, projectId]      | P0       | One status per project per section   |
| DB-005 | Priority unique [reportSectionId, rank]                | P0       | One priority per rank                |
| DB-006 | ReminderExecution dedupeKey unique                     | P0       | Idempotent                           |
| DB-007 | CarryOverExecution dedupeKey unique                    | P0       | Idempotent                           |
| DB-008 | User onDelete: Restrict from ReportSection             | P0       | Cannot delete user with sections     |
| DB-009 | Project onDelete: Restrict from ProjectStatus          | P0       | Cannot delete project with statuses  |
| DB-010 | Report onDelete: Cascade to ReportSection              | P0       | Sections deleted with report         |
| DB-011 | ReportSection onDelete: Cascade to Items               | P0       | Items deleted with section           |
| DB-012 | ReportSection onDelete: Cascade to Risks               | P0       | Risks deleted                        |
| DB-013 | ReportSection onDelete: Cascade to Decisions           | P0       | Decisions deleted                    |
| DB-014 | ReportSection onDelete: Cascade to Priorities          | P0       | Priorities deleted                   |
| DB-015 | ReportSection onDelete: Cascade to ProjectStatuses     | P0       | Statuses deleted                     |
| DB-016 | Report.publishedById onDelete: SetNull                 | P1       | Null if publisher deleted            |
| DB-017 | CarryOverExecution sourceReportId onDelete: Restrict   | P1       | Cannot delete report with carry-over |
| DB-018 | UUID format v4 (Zod strict)                            | P0       | v0 UUIDs rejected                    |
| DB-019 | Seed data: 8 users created                             | P1       | Correct count                        |
| DB-020 | Seed data: 6 projects linked to correct leads          | P1       | FK integrity                         |
| DB-021 | Seed data: 1 report period                             | P1       | Draft status                         |
| DB-022 | Seed data: 6 report sections (1 submitted, 5 draft)    | P1       | Correct statuses                     |
| DB-023 | Seed data: 6 project statuses (1 green, 5 yellow)      | P1       | Correct values                       |
| DB-024 | Seed data: 6 items (all current, feature, in_progress) | P1       | Correct values                       |
| DB-025 | Seed data: 18 priorities (3 per section)               | P1       | Ranks 1-3                            |

---

## 17. E2E JOURNEY SCENARIOS (E2E-001..E2E-060)

### 17.1 Lead Journey

| #       | Scenario                                 | Priority | Expected                            |
| ------- | ---------------------------------------- | -------- | ----------------------------------- |
| E2E-001 | Lead logs in via dev-login               | P0       | Redirected to frontend with session |
| E2E-002 | Lead sees "My Report" nav item           | P0       | Navigation works                    |
| E2E-003 | Lead form loads with active section data | P0       | Pre-filled from DB                  |
| E2E-004 | Lead changes traffic light → autosave    | P0       | Data persisted                      |
| E2E-005 | Lead edits item text → autosave          | P0       | Data persisted                      |
| E2E-006 | Lead edits priority text → autosave      | P0       | Data persisted                      |
| E2E-007 | Lead submits section → read-only         | P0       | Full submit flow                    |
| E2E-008 | Lead revisits → sees submitted read-only | P0       | Status persisted                    |
| E2E-009 | Lead cannot access /head/\* routes       | P0       | FORBIDDEN or redirect               |
| E2E-010 | Lead cannot access /admin                | P0       | FORBIDDEN or redirect               |

### 17.2 Head Journey

| #       | Scenario                               | Priority | Expected                    |
| ------- | -------------------------------------- | -------- | --------------------------- |
| E2E-011 | Head logs in via dev-login             | P0       | Session as head             |
| E2E-012 | Head sees dashboard with lead statuses | P0       | All leads listed            |
| E2E-013 | Head navigates to assembled report     | P0       | Report loads                |
| E2E-014 | Head edits a section traffic light     | P0       | Changes saved               |
| E2E-015 | Head publishes report                  | P0       | Status changes, toast shown |
| E2E-016 | Head sees published badge              | P0       | UI updates                  |
| E2E-017 | Head navigates to admin                | P0       | Admin panel loads           |
| E2E-018 | Head adds a user                       | P0       | User appears in table       |
| E2E-019 | Head removes a user                    | P0       | User disappears             |
| E2E-020 | Head creates a project                 | P0       | Project in table            |

### 17.3 Viewer Journey

| #       | Scenario                        | Priority | Expected          |
| ------- | ------------------------------- | -------- | ----------------- |
| E2E-021 | Viewer logs in                  | P0       | Session as viewer |
| E2E-022 | Viewer sees history list        | P0       | Published reports |
| E2E-023 | Viewer opens a published report | P0       | Full detail       |
| E2E-024 | Viewer cannot access /head/\*   | P0       | Blocked           |
| E2E-025 | Viewer cannot access /admin     | P0       | Blocked           |
| E2E-026 | Viewer cannot access /lead/\*   | P0       | Blocked           |

### 17.4 PDF Export Journey

| #       | Scenario                             | Priority | Expected         |
| ------- | ------------------------------------ | -------- | ---------------- |
| E2E-030 | Head publishes report                | P0       | Prerequisite     |
| E2E-031 | Head requests PDF export             | P0       | Job created      |
| E2E-032 | Poll for status (queued → completed) | P0       | Status updates   |
| E2E-033 | Download PDF                         | P0       | Valid file       |
| E2E-034 | PDF contains all sections            | P0       | Content complete |
| E2E-035 | PDF has correct page breaks          | P1       | Section per page |

### 17.5 Carry-Over Journey

| #       | Scenario                              | Priority | Expected               |
| ------- | ------------------------------------- | -------- | ---------------------- |
| E2E-040 | Head creates second period            | P0       | Period added           |
| E2E-041 | Head runs carry-over                  | P0       | Items carried          |
| E2E-042 | Lead sees carried items in new period | P0       | carriedOver=true badge |
| E2E-043 | Lead marks carried item as completed  | P0       | completed=true         |
| E2E-044 | Unresolved decisions carried over     | P0       | In new section         |
| E2E-045 | Resolved decisions not carried        | P0       | Excluded               |

### 17.6 Error Recovery

| #       | Scenario                               | Priority | Expected         |
| ------- | -------------------------------------- | -------- | ---------------- |
| E2E-050 | API down: error page with retry        | P0       | QueryError shown |
| E2E-051 | Retry after API restart                | P0       | Data loads       |
| E2E-052 | Session expired: redirect to login     | P0       | Auto-redirect    |
| E2E-053 | Network disconnect: "Connection error" | P0       | Friendly message |
| E2E-054 | Invalid route: 404 page                | P1       | Next.js default  |

---

## 18. ACCESSIBILITY (A11Y-001..A11Y-040)

| #        | Scenario                                           | Priority | Expected                  |
| -------- | -------------------------------------------------- | -------- | ------------------------- |
| A11Y-001 | All form inputs have labels (htmlFor/id)           | P1       | Label association         |
| A11Y-002 | Radio groups have role="radiogroup"                | P1       | ARIA                      |
| A11Y-003 | Radio buttons have role="radio"                    | P1       | ARIA                      |
| A11Y-004 | aria-checked on selected radio                     | P1       | State communication       |
| A11Y-005 | aria-label on radio buttons                        | P2       | Screen reader context     |
| A11Y-006 | aria-live="polite" on autosave indicator           | P2       | State change announcement |
| A11Y-007 | aria-current="page" on active nav item             | P2       | Navigation context        |
| A11Y-008 | aria-label on mobile nav trigger                   | P2       | "Open navigation menu"    |
| A11Y-009 | Focus trap in modal dialogs                        | P1       | ConfirmDialog             |
| A11Y-010 | Focus trap in sheets                               | P1       | CrudSheet                 |
| A11Y-011 | Escape key closes dialogs                          | P1       | Keyboard navigation       |
| A11Y-012 | Escape key closes sheets                           | P1       | Keyboard navigation       |
| A11Y-013 | Tab order logical on forms                         | P1       | Natural flow              |
| A11Y-014 | Color contrast meets WCAG AA                       | P2       | 4.5:1 ratio               |
| A11Y-015 | Traffic light colors distinguishable without color | P2       | Labels present            |
| A11Y-016 | Skip to content link                               | P3       | Navigation bypass         |
| A11Y-017 | Page titles reflect current route                  | P2       | <title> element           |
| A11Y-018 | Error messages associated with inputs              | P2       | aria-describedby          |
| A11Y-019 | Loading states announced                           | P2       | aria-busy or live region  |
| A11Y-020 | Alert role on error messages                       | P1       | role="alert"              |

---

## 19. SECURITY (SEC-001..SEC-030)

| #       | Scenario                                       | Priority | Expected                      |
| ------- | ---------------------------------------------- | -------- | ----------------------------- |
| SEC-001 | JWT signed with HS256 + secret                 | P0       | Tampered token rejected       |
| SEC-002 | JWT expiry enforced (1h)                       | P0       | Expired token → UNAUTHORIZED  |
| SEC-003 | Cookie HttpOnly prevents XSS access            | P0       | Not in document.cookie        |
| SEC-004 | Cookie SameSite=Lax prevents CSRF              | P0       | Cross-site rejected           |
| SEC-005 | Helmet CSP headers set                         | P1       | Content-Security-Policy       |
| SEC-006 | Helmet X-Frame-Options: DENY                   | P1       | Clickjacking prevention       |
| SEC-007 | Helmet X-Content-Type-Options: nosniff         | P2       | MIME sniffing prevention      |
| SEC-008 | CORS origin restricted to FRONTEND_URL         | P0       | Other origins rejected        |
| SEC-009 | No SQL injection via tRPC inputs               | P0       | Prisma parameterized queries  |
| SEC-010 | No XSS via user-provided text                  | P0       | React escapes by default      |
| SEC-011 | Role checks on every head-only procedure       | P0       | FORBIDDEN for non-head        |
| SEC-012 | Auth check on every protected procedure        | P0       | UNAUTHORIZED for null session |
| SEC-013 | /metrics endpoint exposed without auth         | P2       | Known issue (documented)      |
| SEC-014 | SAML assertion signature validation            | P0       | wantAssertionsSigned: true    |
| SEC-015 | Dev-login only in AUTH_DEV_MODE=true           | P0       | Not accessible in production  |
| SEC-016 | No sensitive data in error responses           | P1       | Stack traces not exposed      |
| SEC-017 | UUID format validation prevents path traversal | P1       | Zod uuid() check              |
| SEC-018 | Input length limits prevent DoS                | P1       | max(500) on text fields       |
| SEC-019 | No admin operations accessible to lead/viewer  | P0       | headProcedure guard           |
| SEC-020 | HTTPS enforcement in production                | P1       | HSTS header via Helmet        |

---

## 20. PERFORMANCE (PERF-001..PERF-020)

| #        | Scenario                                    | Priority | Expected              |
| -------- | ------------------------------------------- | -------- | --------------------- |
| PERF-001 | Frontend LCP < 1.5s on initial load         | P2       | Target                |
| PERF-002 | tRPC API response p50 < 50ms                | P2       | Target                |
| PERF-003 | Admin snapshot query performance            | P2       | Full snapshot < 100ms |
| PERF-004 | Dashboard query with 6 leads                | P2       | < 50ms                |
| PERF-005 | Assembled report query performance          | P2       | < 100ms               |
| PERF-006 | Archive list query performance              | P2       | < 50ms                |
| PERF-007 | Autosave debounce prevents excessive writes | P1       | 300ms debounce        |
| PERF-008 | PDF poll interval 2000ms (not flooding)     | P2       | Reasonable            |
| PERF-009 | No N+1 queries in assembled report          | P1       | Includes/joins        |
| PERF-010 | Prisma query logging in dev                 | P3       | Debug tool            |

---

## SUMMARY

| Category                 | Scenario Count |
| ------------------------ | -------------- |
| Authentication & Session | 60             |
| Landing Page             | 10             |
| Lead Report Form         | 120            |
| Head Dashboard           | 35             |
| Assembled Report Review  | 60             |
| Archive & History        | 55             |
| Print Page               | 50             |
| Admin Panel              | 135            |
| PDF Export API           | 16             |
| Reminders API            | 10             |
| Navigation & Shell       | 57             |
| Design System Components | 63             |
| Responsive & Mobile      | 15             |
| Infrastructure & Health  | 15             |
| Zod Schema Validation    | 80             |
| Database Constraints     | 25             |
| E2E Journey              | 54             |
| Accessibility            | 20             |
| Security                 | 20             |
| Performance              | 10             |
| **TOTAL (Part 1)**       | **~1050**      |

---

---

# PART 2: DEEP EDGE CASES, STATE MACHINES, CONCURRENCY, VISUAL/CSS

**Added:** 2026-04-12 (expansion pass)
**New scenarios:** ~350
**Grand total:** ~1400

---

## 21. STATE MACHINE TRANSITIONS (EDGE-SM-001..EDGE-SM-029)

### 21.1 Report Lifecycle

| #           | Scenario                                             | Priority | Expected                                                                                                      |
| ----------- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| EDGE-SM-001 | publishReport when activeReportId is null in session | P0       | INTERNAL_SERVER_ERROR (plain Error, not PublicationAccessError)                                               |
| EDGE-SM-002 | publishReport on already-published report            | P0       | CONFLICT "Report has already been published."                                                                 |
| EDGE-SM-003 | updateSectionForReview after report published        | P0       | CONFLICT "Published reports are immutable." — **BUT: this method is NOT wired into tRPC router (design gap)** |
| EDGE-SM-004 | getAssembledReport when activeReportId is null       | P0       | INTERNAL_SERVER_ERROR (not NOT_FOUND)                                                                         |
| EDGE-SM-005 | getSubmissionDashboard when activeReportId is null   | P0       | INTERNAL_SERVER_ERROR "Dashboard requires an active report."                                                  |
| EDGE-SM-006 | getActiveSection when activeReportSectionId is null  | P0       | Empty string → Prisma returns null → INTERNAL_SERVER_ERROR with double-space in message                       |

### 21.2 Section Lifecycle

| #           | Scenario                                                      | Priority | Expected                                                                                                   |
| ----------- | ------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| EDGE-SM-007 | saveDraft on submitted section (autosave race after submit)   | P0       | BAD_REQUEST SECTION_ALREADY_SUBMITTED — frontend must handle gracefully                                    |
| EDGE-SM-008 | submitSection with confirmed: false                           | P0       | Zod literal(true) rejects → BAD_REQUEST                                                                    |
| EDGE-SM-009 | Submit with fewer projectStatuses than section.projects       | P0       | MISSING_TRAFFIC_LIGHT for missing project                                                                  |
| EDGE-SM-010 | Submit with whitespace-only priority text (" ")               | P0       | Passes Zod (min 1 char) but fails validateSubmitInput (trim check) → MISSING_PRIORITIES                    |
| EDGE-SM-011 | Submit with duplicate priority ranks (rank:1, rank:1, rank:1) | P0       | **BUG**: Passes Zod + validateSubmitInput, but DB @@unique constraint throws P2002 → INTERNAL_SERVER_ERROR |
| EDGE-SM-012 | No un-submit or revert-to-draft operation exists              | P1       | Submitted sections are permanently locked — no state reversion path                                        |

### 21.3 PDF Job Lifecycle

| #           | Scenario                                                 | Priority | Expected                                                                                                              |
| ----------- | -------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| EDGE-SM-013 | requestPdfExport when BullMQ disabled (pdfQueue is null) | P0       | Job created in DB status=queued, never enqueued. **Stays queued forever** — no stuck-job cleanup                      |
| EDGE-SM-014 | PDF processor fails after 3 retries                      | P0       | **BUG**: onFailed only logs to stderr. No markExportFailed method exists → DB job stays queued/processing permanently |
| EDGE-SM-015 | requestPdfExport for non-existent reportId               | P0       | NOT_FOUND                                                                                                             |
| EDGE-SM-016 | requestPdfExport for draft (unpublished) report          | P0       | NOT_FOUND (getPublishedReport returns null)                                                                           |
| EDGE-SM-017 | getPdfExportStatus for non-existent jobId                | P0       | NOT_FOUND                                                                                                             |
| EDGE-SM-018 | Multiple requestPdfExport for same reportId              | P1       | No dedup — each creates new job. Multiple processors run simultaneously                                               |
| EDGE-SM-019 | DB status "pending" mapped to domain "queued"            | P2       | Round-trip correct. Unknown DB status defaults silently to "queued"                                                   |

### 21.4 Carry-Over Lifecycle

| #           | Scenario                                                 | Priority | Expected                                                                                                     |
| ----------- | -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| EDGE-SM-020 | Carry-over with multi-section report (6 leads)           | P0       | **BUG**: findFirst returns only ONE section — 5 leads' data silently ignored                                 |
| EDGE-SM-021 | Carry-over idempotency (second call, same source/target) | P0       | **BUG**: Prisma repo always calls create() even for existing execution → unique constraint P2002 → 500 error |
| EDGE-SM-022 | Carry-over where sourceReportId === targetReportId       | P0       | BAD_REQUEST correct                                                                                          |
| EDGE-SM-023 | Carry-over with all source items already carriedOver     | P1       | Valid: execution created with 0 records                                                                      |
| EDGE-SM-024 | cloneCarriedItem when item.id is undefined               | P1       | sourceItemId=null → CarryOverRecord classified as 'decision' incorrectly                                     |

### 21.5 Reminder Lifecycle

| #           | Scenario                                         | Priority | Expected                                                                           |
| ----------- | ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------- |
| EDGE-SM-025 | Execute reminder for paused rule                 | P0       | BAD_REQUEST                                                                        |
| EDGE-SM-026 | Execute reminder for non-existent ruleId         | P0       | BAD_REQUEST                                                                        |
| EDGE-SM-027 | Email send fails → BullMQ retries 3x             | P0       | **Duplicate emails**: processor sends email THEN marks sent — retry resends        |
| EDGE-SM-028 | Reminder rule deleted while job queued in BullMQ | P1       | Cascade deletes execution → processor fails finding execution. Email already sent. |
| EDGE-SM-029 | Reminder kind "follow_up" round-trip             | P1       | **BUG**: toRuleDomain hardcodes kind:'deadline' → follow_up data lost on read      |

---

## 22. CROSS-MODULE INTERACTIONS (EDGE-CM-001..EDGE-CM-009)

| #           | Scenario                                                | Priority | Expected                                                                                                                                                                    |
| ----------- | ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EDGE-CM-001 | Head publishes while lead is mid-autosave               | P0       | **BUG**: saveDraft does NOT check report.status — lead can modify section after publication. Immutability broken.                                                           |
| EDGE-CM-002 | Carry-over runs while lead is editing target section    | P0       | **Race condition**: last writer wins. saveDraft does delete-then-recreate; carry-over adds items in transaction. If lead saves after carry-over, carried items are deleted. |
| EDGE-CM-003 | Admin archives project that has traffic lights in draft | P1       | Archived project remains in section's projectStatuses. Lead can still interact. On next saveDraft without that project, it disappears silently.                             |
| EDGE-CM-004 | Admin deletes user with active report sections          | P0       | **BUG**: removeUser filters from in-memory snapshot, but Prisma re-reads from DB → user reappears on next getSnapshot                                                       |
| EDGE-CM-005 | Admin deletes user who leads a project (no sections)    | P1       | Protected by FK: project.count > 0 prevents deletion                                                                                                                        |
| EDGE-CM-006 | Two carry-overs: different source, same target          | P1       | Both succeed. Target gets items from both sources. No duplication guard.                                                                                                    |
| EDGE-CM-007 | Concurrent admin snapshot saves                         | P0       | **Lost update**: no optimistic locking. Two parallel saveUser calls — last writer wins, one user silently lost.                                                             |
| EDGE-CM-008 | PDF export while report is being published              | P2       | Timing-dependent: export query may see published status mid-transaction                                                                                                     |
| EDGE-CM-009 | Report period deleted while PDF job queued              | P1       | Cascade deletes PdfExportJob → processor fails. onFailed logs only.                                                                                                         |

---

## 23. BOUNDARY VALUES — DEEP (EDGE-BV-001..EDGE-BV-019)

| #           | Scenario                                                          | Priority | Expected                                              |
| ----------- | ----------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| EDGE-BV-001 | Item text exactly 500 chars → accepted                            | P1       | Max boundary                                          |
| EDGE-BV-002 | Item text 501 chars → rejected                                    | P1       | Over max                                              |
| EDGE-BV-003 | Item text single space " " → passes Zod (length 1, no trim)       | P1       | Accepted but semantically empty                       |
| EDGE-BV-004 | Item text newline "\n" → passes Zod                               | P2       | Accepted                                              |
| EDGE-BV-005 | Decision deadline ISO string with timezone → coerced to UTC       | P1       | "2026-04-10T12:00:00+03:00" accepted                  |
| EDGE-BV-006 | Decision deadline "not-a-date" → ZodError                         | P1       | Coerce produces Invalid Date → rejected               |
| EDGE-BV-007 | Priority rank 1.5 (float) → rejected (z.int())                    | P1       | Not integer                                           |
| EDGE-BV-008 | Priority whitespace text passes Zod but fails business validation | P0       | Gap between Zod and validateSubmitInput               |
| EDGE-BV-009 | submitSectionSchema projectStatuses empty array                   | P0       | Rejected (min 1)                                      |
| EDGE-BV-010 | draftSaveSchema projectStatuses empty array                       | P1       | Accepted (no min on draft)                            |
| EDGE-BV-011 | adminUserSchema email "user@domain" (no TLD)                      | P1       | Depends on Zod v4 z.email() strictness                |
| EDGE-BV-012 | Project name unlimited length (no max constraint)                 | P2       | Accepted — potential DoS                              |
| EDGE-BV-013 | Overlapping report periods (no validation)                        | P1       | Both accepted — ambiguous activeReportId              |
| EDGE-BV-014 | periodEnd before periodStart (no cross-field validation)          | P1       | Inverted dates accepted                               |
| EDGE-BV-015 | Deadline outside period range                                     | P1       | Accepted, no cross-field check                        |
| EDGE-BV-016 | Nil UUID "00000000-0000-0000-0000-000000000000"                   | P1       | Passes Zod uuid() — used as fallback in reminder repo |
| EDGE-BV-017 | Date "2099-12-31T23:59:59Z" (far future)                          | P2       | Accepted, no upper bound                              |
| EDGE-BV-018 | adminSnapshotSchema.reminderExecutions default([])                | P2       | Missing key coerced to []                             |
| EDGE-BV-019 | ReminderRule version: 0 → rejected (min 1)                        | P1       | Boundary                                              |

---

## 24. ERROR PROPAGATION (EDGE-EP-001..EDGE-EP-010)

| #           | Scenario                                                                 | Priority | Expected                                                     |
| ----------- | ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------ |
| EDGE-EP-001 | Unhandled Error (not domain error) → "Unexpected error"                  | P0       | Original message discarded. No correlation ID in response.   |
| EDGE-EP-002 | Double Zod parsing: tRPC input schema + service-level parse              | P2       | Service parse unreachable (tRPC validates first). Redundant. |
| EDGE-EP-003 | Lead calls headProcedure → tRPC FORBIDDEN (middleware, not domain error) | P0       | Middleware fires before handler                              |
| EDGE-EP-004 | tRPC batch: one call fails, others succeed                               | P1       | Partial success — each call independent in batch             |
| EDGE-EP-005 | Prisma transaction timeout (15s) → INTERNAL_SERVER_ERROR                 | P1       | DB rolled back, client gets opaque error                     |
| EDGE-EP-006 | Report deleted between update and findUnique in saveAssembledReport      | P2       | Plain Error → INTERNAL_SERVER_ERROR                          |
| EDGE-EP-007 | User hard-deleted bypassing FK → author is null → TypeError              | P1       | row.author.name throws → INTERNAL_SERVER_ERROR               |
| EDGE-EP-008 | DEV_SESSION fallback always has role:head, activeReportSectionId:null    | P0       | Dev mode: unauthenticated users are treated as head          |
| EDGE-EP-009 | JWT expires mid-session → next request UNAUTHORIZED                      | P0       | Frontend must redirect to login                              |
| EDGE-EP-010 | DEV_SESSION + expired token → fallback used (expired token ignored)      | P1       | Dev mode ignores auth failures                               |

---

## 25. CONCURRENCY (EDGE-CC-001..EDGE-CC-005)

| #           | Scenario                                             | Priority | Expected                                                                                 |
| ----------- | ---------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| EDGE-CC-001 | Autosave debounce + manual submit race condition     | P0       | If submit commits first, autosave gets BAD_REQUEST. Frontend must swallow this silently. |
| EDGE-CC-002 | Two browser tabs same session: both saveDraft        | P0       | Last writer wins. No optimistic concurrency.                                             |
| EDGE-CC-003 | Two admin saves interleaved (non-transactional)      | P0       | Partial state possible. User silently lost.                                              |
| EDGE-CC-004 | BullMQ retry while first attempt still running (PDF) | P1       | Two processors, non-deterministic final checksum                                         |
| EDGE-CC-005 | BullMQ email retry → duplicate emails sent           | P1       | sendMail succeeds → markSent fails → retry resends                                       |

---

## 26. DATA INTEGRITY (EDGE-DI-001..EDGE-DI-014)

| #           | Scenario                                                             | Priority | Expected                                            |
| ----------- | -------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| EDGE-DI-001 | Report with 0 sections → portfolio overview green                    | P1       | Valid edge: all zeros                               |
| EDGE-DI-002 | Publish report with 0 sections allowed                               | P1       | No validation blocks it                             |
| EDGE-DI-003 | PDF export of empty published report                                 | P2       | Valid PDF, empty content                            |
| EDGE-DI-004 | Section with 0 items, 0 risks, 0 decisions → draft save OK           | P1       | Arrays can be empty on draft                        |
| EDGE-DI-005 | Submit with 0 items → MISSING_CURRENT_ITEM per project               | P0       | Business validation catches                         |
| EDGE-DI-006 | All projects archived → still appear in sections                     | P1       | No archived filter in queries                       |
| EDGE-DI-007 | User role changed in DB mid-session (JWT stale)                      | P0       | Old JWT retains old role for up to 1h               |
| EDGE-DI-008 | Report period in the past (deadline passed)                          | P1       | No auto-locking of sections                         |
| EDGE-DI-009 | Duplicate priority ranks pass Zod + validateSubmitInput              | P0       | **BUG**: DB @@unique throws P2002 → 500             |
| EDGE-DI-010 | Item references projectId from different lead's project              | P1       | No cross-reference validation                       |
| EDGE-DI-011 | carryOverStatusSchema only has 'completed' but DB has pending/failed | P0       | **BUG**: Reading non-completed row → ZodError → 500 |
| EDGE-DI-012 | reminderExecutions.recipientEmail hardcoded to '' in Prisma repo     | P1       | Empty email displayed in admin                      |
| EDGE-DI-013 | ReminderRule kind round-trip: follow_up → saved → read as 'deadline' | P0       | **BUG**: toRuleDomain hardcodes kind:'deadline'     |
| EDGE-DI-014 | SubmissionDashboardRow with projectNames: [] (lead with no projects) | P2       | Valid: empty array displayed                        |

---

## 27. FRONTEND STATE MANAGEMENT (EDGE-FE-001..EDGE-FE-007)

| #           | Scenario                                                        | Priority | Expected                                                                             |
| ----------- | --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| EDGE-FE-001 | superjson transformer on both server and client                 | P0       | Dates serialized correctly                                                           |
| EDGE-FE-002 | NEXT_PUBLIC_API_URL undefined → falls back to localhost:3001    | P1       | Dev works, production breaks                                                         |
| EDGE-FE-003 | getActiveSection returns INTERNAL_SERVER_ERROR for null section | P0       | Frontend shows "Unexpected error" — not user-friendly                                |
| EDGE-FE-004 | Query invalidation after submit → reports.getActive refreshed   | P0       | Submitted state reflected                                                            |
| EDGE-FE-005 | httpBatchLink: partial batch success                            | P1       | Individual errors per query                                                          |
| EDGE-FE-006 | sameSite:'lax' cookie on cross-domain mutations                 | P0       | POST mutations may fail if API on different subdomain                                |
| EDGE-FE-007 | JWT activeReportId absent (undefined) vs null                   | P0       | **BUG**: nullable() rejects undefined — Zod parse fails on JWT decode if key omitted |

---

## 28. ADMIN SNAPSHOT PATTERN (EDGE-AS-001..EDGE-AS-004)

| #           | Scenario                                                            | Priority | Expected                                                                  |
| ----------- | ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| EDGE-AS-001 | saveSnapshot not transactional — crash mid-save                     | P1       | Partial state in DB                                                       |
| EDGE-AS-002 | Delete reminder rule → cascade deletes executions → BullMQ orphaned | P1       | Jobs fail, email already sent                                             |
| EDGE-AS-003 | Admin-created user samlId = email → SAML mismatch later             | P2       | Different samlId from Keycloak                                            |
| EDGE-AS-004 | Admin changes period status published → draft                       | P0       | **Effectively unpublishes** — report becomes editable again via saveDraft |

---

## 29. VISUAL / CSS EDGE CASES (VIS-001..VIS-090)

### 29.1 OKLCH Theme Tokens

| #       | Scenario                                                       | Priority | Expected                                     |
| ------- | -------------------------------------------------------------- | -------- | -------------------------------------------- |
| VIS-001 | All 18 @theme tokens render on screen                          | P1       | Background, foreground, muted, primary, etc. |
| VIS-002 | Print fallback: all 18 tokens replaced by hex                  | P0       | @media print block covers all tokens         |
| VIS-003 | `* { border-color: var(--color-border) }` doesn't leak         | P2       | Tables/cards don't have unexpected borders   |
| VIS-004 | Custom spacing tokens (xs..3xl) don't conflict with Tailwind 4 | P3       | No collisions                                |

### 29.2 Traffic Light Colors

| #       | Scenario                                          | Priority | Expected                       |
| ------- | ------------------------------------------------- | -------- | ------------------------------ |
| VIS-010 | Green: bg oklch(0.925 0.084 155) + text + border  | P0       | Visually correct               |
| VIS-011 | Yellow: bg + text + border distinct from green    | P0       | Distinguishable                |
| VIS-012 | Red: bg + text + border                           | P0       | Visually correct               |
| VIS-013 | Unset: neutral gray                               | P0       | Clearly different from colored |
| VIS-014 | Print hex: green #bbf7d0/#166534/#4ade80          | P0       | Hex values correct             |
| VIS-015 | Print hex: yellow #fef08a/#854d0e/#facc15         | P0       | Hex values correct             |
| VIS-016 | Print hex: red #fecaca/#dc2626/#f87171            | P0       | Hex values correct             |
| VIS-017 | Print hex: unset #f5f5f5/#737373/#e5e5e5          | P0       | Hex values correct             |
| VIS-018 | Selected ring (ring-2) visible on all 4 variants  | P1       | Ring doesn't clash with border |
| VIS-019 | Disabled opacity-50: yellow still distinguishable | P2       | Low contrast concern           |

### 29.3 Print CSS

| #       | Scenario                                                | Priority | Expected                                                              |
| ------- | ------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| VIS-020 | print:p-0 removes padding                               | P0       | Full-width content                                                    |
| VIS-021 | print:bg-white background                               | P0       | White background                                                      |
| VIS-022 | print:shadow-none on cards                              | P0       | No box-shadow                                                         |
| VIS-023 | print:border on cards                                   | P0       | Visible border                                                        |
| VIS-024 | break-inside-avoid on section cards                     | P0       | Card doesn't split                                                    |
| VIS-025 | break-before-page on sections > 0                       | P0       | New page per lead                                                     |
| VIS-026 | **GAP**: No -webkit-print-color-adjust: exact           | P0       | **Background colors may not print!** Chromium strips bg without this. |
| VIS-027 | **GAP**: TrafficLightBadge dot background may not print | P0       | Depends on VIS-026 fix                                                |

### 29.4 Font Loading

| #       | Scenario                                            | Priority | Expected                |
| ------- | --------------------------------------------------- | -------- | ----------------------- |
| VIS-030 | Inter 400 (normal) renders for body text            | P1       | Correct weight          |
| VIS-031 | Inter 600 (semibold) renders for headings           | P1       | Correct weight          |
| VIS-032 | font-medium (500) falls back to 400 — no 500 loaded | P2       | Browser interpolation   |
| VIS-033 | Cyrillic subset renders Russian names/text          | P0       | No tofu/missing glyphs  |
| VIS-034 | display: swap causes FOUT (flash of unstyled text)  | P3       | Acceptable trade-off    |
| VIS-035 | --font-inter CSS variable set on html               | P2       | Variable chain resolves |

### 29.5 Long Text Overflow

| #       | Scenario                                           | Priority | Expected                            |
| ------- | -------------------------------------------------- | -------- | ----------------------------------- |
| VIS-040 | 40-char username in NavUser truncates at 120px     | P1       | Ellipsis visible                    |
| VIS-041 | Single-char initial in Avatar: "A" centered        | P2       | Doesn't look broken                 |
| VIS-042 | 2-char Cyrillic initials in Avatar: "АП"           | P2       | Fits in circle                      |
| VIS-043 | 60-char project name in ProjectStatusGrid wraps    | P1       | Card height expands                 |
| VIS-044 | 50-char project name in TrafficLightBadge          | P1       | Badge wraps or truncates acceptably |
| VIS-045 | 500-char item text in published report <li>        | P1       | Wraps inside card                   |
| VIS-046 | Long risk text + impact badge: badge stays visible | P1       | shrink-0 on badge                   |
| VIS-047 | Long email in DataTable cell                       | P2       | Wraps or scrolls                    |

### 29.6 Scale Tests

| #       | Scenario                                               | Priority | Expected                |
| ------- | ------------------------------------------------------ | -------- | ----------------------- |
| VIS-050 | 10+ projects in ProjectStatusGrid (5 rows at md)       | P1       | Grid height acceptable  |
| VIS-051 | 50+ items in ItemsEditor: autosave still works         | P1       | Performance OK          |
| VIS-052 | 10+ sections in assembled report: sticky header works  | P1       | No z-index issues       |
| VIS-053 | 0 sections in assembled report: publish button visible | P1       | Page not broken         |
| VIS-054 | Progress bar at 0%: track visible                      | P2       | bg-primary/20 track     |
| VIS-055 | Progress bar at 100%: full fill                        | P2       | Rounded corners correct |

### 29.7 Empty States

| #       | Scenario                                                  | Priority | Expected                               |
| ------- | --------------------------------------------------------- | -------- | -------------------------------------- |
| VIS-060 | DataTable empty: "No data yet" centered with py-12        | P1       | All 4 admin tabs + dashboard + archive |
| VIS-061 | RisksEditor 0 risks: "No risks added"                     | P1       | Centered, muted                        |
| VIS-062 | DecisionsEditor 0 decisions: "No decisions added"         | P1       | Centered, muted                        |
| VIS-063 | Section with all empty arrays: CardContent has no content | P2       | Card doesn't collapse                  |
| VIS-064 | AutosaveIndicator idle: no visual gap in header           | P2       | Returns null cleanly                   |

### 29.8 Z-Index Stacking

| #       | Scenario                                              | Priority | Expected                      |
| ------- | ----------------------------------------------------- | -------- | ----------------------------- |
| VIS-070 | Sheet (z-50) covers sticky header (z-50)              | P0       | Sheet overlay on top (portal) |
| VIS-071 | Dialog (z-50) over Sheet (z-50): Dialog wins          | P0       | Dialog portaled after Sheet   |
| VIS-072 | Toast over Sheet and Dialog                           | P0       | Sonner z-9999                 |
| VIS-073 | Tooltip over sidebar content in collapsed mode        | P1       | Tooltip portaled at z-50      |
| VIS-074 | DropdownMenu (NavUser) over sticky header             | P1       | Portaled, wins DOM order      |
| VIS-075 | Only one Sheet open at a time (sidebar vs mobile nav) | P1       | Independent triggers          |

### 29.9 Animations

| #       | Scenario                                                                         | Priority | Expected                      |
| ------- | -------------------------------------------------------------------------------- | -------- | ----------------------------- |
| VIS-080 | Sheet slide-in 500ms, slide-out 300ms                                            | P2       | Smooth                        |
| VIS-081 | Dialog zoom-in-95 200ms                                                          | P2       | Smooth                        |
| VIS-082 | **GAP**: Skeleton pulse nearly invisible — accent vs background contrast ~1.05:1 | P1       | Pulse barely visible on white |
| VIS-083 | Loader2 spin smooth in buttons and indicators                                    | P2       | No clipping                   |
| VIS-084 | Sidebar collapse transition smooth                                               | P2       | Width animates                |

### 29.10 Component Variants Used

| #       | Scenario                                                 | Priority | Expected        |
| ------- | -------------------------------------------------------- | -------- | --------------- |
| VIS-085 | Badge "default" variant: head role, published status     | P2       | Correct styling |
| VIS-086 | Badge "secondary" variant: lead role, active project     | P2       | Correct styling |
| VIS-087 | Badge "outline" variant: draft, unresolved, carried-over | P2       | Correct styling |
| VIS-088 | Button "default": Submit, Publish, Add actions           | P2       | Primary color   |
| VIS-089 | Button "outline": Cancel, Export PDF trigger             | P2       | Border-only     |
| VIS-090 | Button "ghost": table row actions, hamburger             | P2       | Transparent bg  |

### 29.11 Critical CSS Gaps Found

| #           | Scenario                                               | Priority | Expected                                               |
| ----------- | ------------------------------------------------------ | -------- | ------------------------------------------------------ |
| VIS-GAP-001 | **No -webkit-print-color-adjust: exact**               | P0       | Background colors stripped in PDF. Highest print risk. |
| VIS-GAP-002 | **No dark mode token overrides**                       | P1       | OS dark mode + light OKLCH = mismatched colors         |
| VIS-GAP-003 | **Skeleton contrast ~1.05:1** — nearly invisible pulse | P1       | Users don't see loading state                          |
| VIS-GAP-004 | **Hardcoded green/destructive in decisions-editor**    | P2       | Bypasses design tokens, no print fallbacks             |
| VIS-GAP-005 | **No min-h/max-h on CrudSheet scroll area**            | P2       | May not scroll on short viewports                      |

---

## 30. RESPONSIVE BREAKPOINTS — DEEP (RESP-020..RESP-035)

| #        | Scenario                                            | Priority | Expected             |
| -------- | --------------------------------------------------- | -------- | -------------------- |
| RESP-020 | Mobile nav hidden at 1024px+ (lg)                   | P0       | lg:hidden class      |
| RESP-021 | Sidebar visible at 1024px+                          | P0       | Not lg:hidden        |
| RESP-022 | ProjectStatusGrid 1 col < 768px, 2 col ≥ 768px      | P0       | md breakpoint        |
| RESP-023 | Dialog footer: col-reverse < 640px, row ≥ 640px     | P1       | sm breakpoint        |
| RESP-024 | NavUser name hidden < 1024px                        | P1       | lg:inline-block      |
| RESP-025 | CrudSheet 400px: doesn't overflow on 375px viewport | P1       | Constrained          |
| RESP-026 | MobileNav sheet 280px on 320px viewport             | P1       | Fits                 |
| RESP-027 | Main content p-4 < 1024px, p-8 ≥ 1024px             | P2       | lg:p-8               |
| RESP-028 | 320px viewport: no horizontal scroll on any page    | P0       | Content fits         |
| RESP-029 | 375px viewport (iPhone SE): all pages usable        | P1       | Touch targets ≥ 44px |
| RESP-030 | 1920px viewport: content centered, max-w-1200       | P2       | No stretch           |

---

## 31. DISCOVERED BUGS (BUG-001..BUG-010)

These are actual defects found during analysis, not just test scenarios:

| #       | Bug                                                                                                                                                                    | Severity | Location                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| BUG-001 | **saveDraft after publish**: ReportSectionsService.saveDraft does NOT check parent report's published status → leads can modify sections of published reports          | P0       | apps/api/src/modules/report-sections/ |
| BUG-002 | **Duplicate priority ranks**: Zod + validateSubmitInput allow duplicate ranks (e.g., three rank:1), but DB @@unique([reportSectionId, rank]) throws P2002 → opaque 500 | P0       | packages/shared + apps/api            |
| BUG-003 | **Carry-over only processes first section**: findFirst by reportId returns one section — 5 of 6 leads' data silently ignored                                           | P0       | apps/api/src/modules/carry-over/      |
| BUG-004 | **Carry-over idempotency broken**: Prisma repo always calls create() even when existingExecution found → unique constraint violation on second call                    | P0       | apps/api/src/modules/carry-over/      |
| BUG-005 | **No markExportFailed**: After 3 BullMQ retries, PDF job stays queued/processing in DB forever. No failed status path.                                                 | P1       | apps/api/src/modules/pdf-export/      |
| BUG-006 | **carryOverStatusSchema mismatch**: Zod only allows 'completed' but DB has pending/failed → reading non-completed rows throws ZodError → 500                           | P1       | packages/shared/schemas               |
| BUG-007 | **Reminder kind data loss**: toRuleDomain hardcodes kind:'deadline' → 'follow_up' rules lose their kind on read                                                        | P1       | apps/api/src/modules/reminders/       |
| BUG-008 | **removeUser not durable**: Service filters from in-memory snapshot, but Prisma re-reads from DB → user reappears on next getSnapshot                                  | P1       | apps/api/src/modules/admin/           |
| BUG-009 | **JWT nullable vs optional**: userSessionSchema uses nullable() for activeReportId — if JWT omits the key (undefined), Zod parse fails                                 | P1       | packages/shared/schemas/auth          |
| BUG-010 | **No -webkit-print-color-adjust**: PDF background colors may be stripped by Chromium renderer                                                                          | P0       | packages/ui/src/styles                |

---

## GRAND TOTAL

| Part                       | Categories        | Scenarios |
| -------------------------- | ----------------- | --------- |
| Part 1: Core functionality | 20 categories     | ~1050     |
| Part 2: State machines     | EDGE-SM 1-29      | 29        |
| Part 2: Cross-module       | EDGE-CM 1-9       | 9         |
| Part 2: Boundary values    | EDGE-BV 1-19      | 19        |
| Part 2: Error propagation  | EDGE-EP 1-10      | 10        |
| Part 2: Concurrency        | EDGE-CC 1-5       | 5         |
| Part 2: Data integrity     | EDGE-DI 1-14      | 14        |
| Part 2: Frontend state     | EDGE-FE 1-7       | 7         |
| Part 2: Admin snapshot     | EDGE-AS 1-4       | 4         |
| Part 2: Visual/CSS         | VIS 1-90, GAP 1-5 | 95        |
| Part 2: Responsive deep    | RESP 20-30        | 11        |
| Part 2: Discovered bugs    | BUG 1-10          | 10        |
| **Part 2 subtotal**        |                   | **~1263** |

---

---

# PART 3: COMBINATORIAL, NEGATIVE, NETWORK, LOCALIZATION, ACCESSIBILITY

**Added:** 2026-04-12 (third pass)
**New scenarios:** ~400+

---

## 32. COMBINATORIAL FORM STATES (TC-001..TC-050)

### 32.1 Traffic Light × Projects (Pairwise)

| #        | P1                            | P2     | P3    | P4    | P5     | P6    | Expected                                                                   |
| -------- | ----------------------------- | ------ | ----- | ----- | ------ | ----- | -------------------------------------------------------------------------- |
| TC-TL-01 | green                         | green  | green | green | green  | green | Submit allowed                                                             |
| TC-TL-02 | red                           | yellow | green | red   | yellow | green | Submit allowed (mixed)                                                     |
| TC-TL-03 | unset                         | green  | green | green | green  | green | Blocked — "P1 must have traffic light"                                     |
| TC-TL-04 | unset                         | unset  | unset | unset | unset  | unset | Blocked — 6 error messages                                                 |
| TC-TL-05 | red                           | unset  | green | unset | red    | green | Blocked — 2 errors (P2, P4)                                                |
| TC-TL-06 | green                         | green  | green | green | green  | unset | Boundary: 5/6 set, last unset                                              |
| TC-TL-07 | (draft) all unset             |        |       |       |        |       | Draft save allowed — status optional                                       |
| TC-TL-08 | (direct API) all unset submit |        |       |       |        |       | **Bug candidate**: toSubmitInput falls back to 'red' for null trafficLight |

### 32.2 Items: type × carriedOver × completed

| #        | type         | carriedOver | completed | Submit valid                   | Display                                                               |
| -------- | ------------ | ----------- | --------- | ------------------------------ | --------------------------------------------------------------------- |
| TC-IT-01 | current      | false       | null      | Valid                          | No checkbox                                                           |
| TC-IT-02 | current      | true        | null      | Valid                          | Checkbox unchecked                                                    |
| TC-IT-03 | current      | true        | false     | Valid                          | Checkbox unchecked                                                    |
| TC-IT-04 | current      | true        | true      | Valid                          | Checkbox checked                                                      |
| TC-IT-05 | next         | false       | null      | Valid                          | No checkbox                                                           |
| TC-IT-06 | next         | true        | true      | Valid                          | Checkbox checked                                                      |
| TC-IT-07 | current      | false       | true      | Valid                          | **Bug**: completed=true but no checkbox rendered — data inconsistency |
| TC-IT-08 | current      | false       | false     | Valid                          | No checkbox, completed=false stored but invisible                     |
| TC-IT-09 | (none)       | —           | —         | Blocked — "needs current item" | —                                                                     |
| TC-IT-10 | next only ×N | —           | —         | Blocked — no current           | —                                                                     |

### 32.3 Submit Validation All-Combinations

| #        | TL set | Has current item | Priorities ×3 | Result                                         |
| -------- | ------ | ---------------- | ------------- | ---------------------------------------------- |
| TC-SV-01 | yes    | yes              | yes           | Allowed                                        |
| TC-SV-02 | no     | yes              | yes           | Blocked (TL)                                   |
| TC-SV-03 | yes    | no               | yes           | Blocked (item)                                 |
| TC-SV-04 | yes    | yes              | no            | Blocked (priorities)                           |
| TC-SV-05 | no     | no               | yes           | Blocked (TL + item)                            |
| TC-SV-06 | no     | yes              | no            | Blocked (TL + priorities)                      |
| TC-SV-07 | yes    | no               | no            | Blocked (item + priorities)                    |
| TC-SV-08 | no     | no               | no            | Blocked (all 3 — error count = projects×2 + 1) |

### 32.4 Priority Combinations

| #        | p1.text                | p2.text | p3.text  | Valid                                                              |
| -------- | ---------------------- | ------- | -------- | ------------------------------------------------------------------ | -------------------- |
| TC-PR-01 | "A"                    | "B"     | "C"      | Yes                                                                |
| TC-PR-02 | ""                     | "B"     | "C"      | No — min(1) fails                                                  |
| TC-PR-03 | " "                    | "B"     | "C"      | **Gap**: passes Zod (3 spaces ≥ min 1) but fails client trim check |
| TC-PR-04 | "A"                    | "B"     | (only 2) | No — length(3) fails                                               |
| TC-PR-05 | "A"                    | "B"     | "C"      | "D" (4 items)                                                      | No — length(3) fails |
| TC-PR-06 | rank 1,1,2 (duplicate) |         |          | Zod passes, DB @@unique crashes                                    |

### 32.5 Section Status × Re-submit

| #        | Status    | Action    | Expected                              |
| -------- | --------- | --------- | ------------------------------------- |
| TC-SS-01 | draft     | saveDraft | Success                               |
| TC-SS-02 | draft     | submit    | Success → submitted                   |
| TC-SS-03 | submitted | saveDraft | BAD_REQUEST SECTION_ALREADY_SUBMITTED |
| TC-SS-04 | submitted | submit    | BAD_REQUEST SECTION_ALREADY_SUBMITTED |
| TC-SS-05 | submitted | UI        | Read-only, submit button hidden       |

### 32.6 Autosave Timing

| #        | User action                    | Concurrent state   | Expected                                          |
| -------- | ------------------------------ | ------------------ | ------------------------------------------------- |
| TC-AS-01 | Type in field                  | No pending save    | Debounce 300ms → save                             |
| TC-AS-02 | Rapid typing 2s                | Debounce resets    | ONE save 300ms after last key                     |
| TC-AS-03 | Save in flight + type again    | New debounce       | Potential double-save race                        |
| TC-AS-04 | Section submitted (read-only)  | Any change         | isReadOnly guard — no autosave                    |
| TC-AS-05 | Component unmounts during save | saving in progress | Promise discarded silently                        |
| TC-AS-06 | API error during autosave      | saving → error     | **BUG**: No try/catch → "Saving..." stuck forever |

---

## 33. NEGATIVE API TESTING (TC-API-001..TC-API-040)

### 33.1 Schema Fuzzing — saveDraft

| #         | Payload mutation                    | Expected                            |
| --------- | ----------------------------------- | ----------------------------------- |
| TC-API-01 | Missing reportSectionId             | 400 BAD_REQUEST (Zod)               |
| TC-API-02 | reportSectionId: "not-a-uuid"       | 400                                 |
| TC-API-03 | Missing projectStatuses array       | 400                                 |
| TC-API-04 | projectStatuses: null               | 400                                 |
| TC-API-05 | Extra field `__proto__: {...}`      | Stripped by Zod .strip() — 200 OK   |
| TC-API-06 | items[0] with extra fields          | Stripped silently — 200 OK          |
| TC-API-07 | items[0].type: "weekly"             | 400 (invalid enum)                  |
| TC-API-08 | items[0].text: ""                   | 400 (min 1)                         |
| TC-API-09 | items[0].text: "A"×501              | 400 (max 500)                       |
| TC-API-10 | decisions[0].deadline: "not-a-date" | 400 (coerce.date fails)             |
| TC-API-11 | decisions[0].deadline: -1 (number)  | **200 OK** — coerces to 1969-12-31  |
| TC-API-12 | decisions[0].deadline: 0            | **200 OK** — coerces to epoch       |
| TC-API-13 | priorities[0].rank: 0               | 400 (min 1)                         |
| TC-API-14 | priorities[0].rank: 4               | 400 (max 3)                         |
| TC-API-15 | priorities[0].rank: 1.5             | 400 (int check)                     |
| TC-API-16 | 10,000 items in items array         | **200 OK** — no array max! DoS risk |
| TC-API-17 | 10,000 risks in risks array         | **200 OK** — no array max!          |
| TC-API-18 | Empty object {} as body             | 400 (missing required fields)       |
| TC-API-19 | Array as body []                    | 400 (not object)                    |
| TC-API-20 | String as body "hello"              | 400 (not object)                    |

### 33.2 SQL Injection

| #         | Payload                                  | Expected                                    |
| --------- | ---------------------------------------- | ------------------------------------------- |
| TC-SQL-01 | `"'; DROP TABLE items; --"` in item.text | Stored as literal (Prisma parameterized)    |
| TC-SQL-02 | `"1 OR 1=1"` in decision.owner           | Stored as literal                           |
| TC-SQL-03 | `"${process.env.SECRET}"` in risk.risk   | Stored as literal (no server interpolation) |

### 33.3 XSS

| #         | Payload                        | Web UI                 | PDF Risk                 |
| --------- | ------------------------------ | ---------------------- | ------------------------ |
| TC-XSS-01 | `<script>alert(1)</script>`    | React escapes → safe   | PDF: depends on template |
| TC-XSS-02 | `<img src=x onerror=alert(1)>` | React escapes → safe   | PDF: verify              |
| TC-XSS-03 | `javascript:alert(1)`          | No link context → safe | Safe                     |
| TC-XSS-04 | `"><svg onload=alert(1)>`      | React escapes → safe   | PDF: verify              |

### 33.4 Unicode Edge Cases

| #         | Payload                          | Field              | Expected                                                                             |
| --------- | -------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| TC-UNI-01 | `"😀🚀💡"` (emoji, 4-byte UTF-8) | item.text          | Passes max(500) by char count. PostgreSQL OK.                                        |
| TC-UNI-02 | `"مرحبا"` (RTL Arabic)           | priority.text      | Stored OK. PDF RTL layout issue?                                                     |
| TC-UNI-03 | `"\u200B"` (zero-width space)    | priority.text      | **BUG**: Passes Zod min(1) AND client trim check — visually empty priority submitted |
| TC-UNI-04 | `"\u0000"` (null byte)           | any text field     | **BUG**: Passes Zod, PostgreSQL rejects → INTERNAL_SERVER_ERROR                      |
| TC-UNI-05 | `"\uFFFE"` (BOM)                 | any text field     | Passes Zod. Display issues in PDF.                                                   |
| TC-UNI-06 | 250 emoji (500 JS char units)    | item.text max(500) | Passes at boundary                                                                   |
| TC-UNI-07 | 251 emoji (502 JS char units)    | item.text max(500) | Rejected (502 > 500)                                                                 |
| TC-UNI-08 | Combining diacritics `é` (e + ́)  | item.text          | 2 char units for 1 visual char — counts toward max                                   |

---

## 34. NETWORK RESILIENCE (TC-NET-001..TC-NET-015)

**Config note**: tRPC client uses `httpBatchLink` with NO retry logic, NO timeout config, NO error interceptor. React Query defaults: queries retry 3×, mutations retry 0×.

| #         | Scenario                                            | Expected                                                           |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| TC-NET-01 | API returns 502                                     | TRPCClientError. Query retries 3×. Mutation fails once.            |
| TC-NET-02 | API returns 503                                     | Same as 502                                                        |
| TC-NET-03 | API returns 504                                     | Same                                                               |
| TC-NET-04 | Network disconnect during autosave                  | **BUG**: fetch hangs → no try/catch → "Saving..." forever          |
| TC-NET-05 | Slow API (>5s) during autosave                      | Multiple debounces fire. Both saves execute. Last-write-wins.      |
| TC-NET-06 | Network disconnect during submit                    | **BUG**: no try/catch in handleConfirmSubmit → unhandled rejection |
| TC-NET-07 | CORS error                                          | Opaque network error → same as disconnect                          |
| TC-NET-08 | Batch: one call fails, others succeed               | Partial batch success — individual errors per call                 |
| TC-NET-09 | API down at page load                               | QueryError shown with retry button                                 |
| TC-NET-10 | API recovers after initial failure + retry          | Data loads on retry                                                |
| TC-NET-11 | WebSocket not used — polling for PDF status         | 2000ms interval via refetchInterval                                |
| TC-NET-12 | PDF polling: API unreachable during poll            | Single poll fails, next 2s poll retries                            |
| TC-NET-13 | Very large response (snapshot with 1000 users)      | No response size limit — may be slow                               |
| TC-NET-14 | Request timeout (browser default ~300s)             | Very slow autosave blocks UI for 5 min                             |
| TC-NET-15 | Abort controller not used — no request cancellation | Component unmount doesn't cancel in-flight                         |

---

## 35. DATE & TIMEZONE EDGE CASES (TC-DT-001..TC-DT-020)

### 35.1 z.coerce.date() Behavior

| #        | Input                                        | Result                       | Accepted             |
| -------- | -------------------------------------------- | ---------------------------- | -------------------- |
| TC-DT-01 | `"2026-04-12T00:00:00.000Z"`                 | Valid ISO                    | Yes                  |
| TC-DT-02 | `"2026-04-12"` (date-only)                   | Midnight UTC                 | Yes                  |
| TC-DT-03 | `1744412400000` (epoch ms)                   | Valid date                   | Yes                  |
| TC-DT-04 | `-1`                                         | 1969-12-31T23:59:59.999Z     | **Yes** (pre-epoch!) |
| TC-DT-05 | `0`                                          | 1970-01-01T00:00:00Z (epoch) | **Yes**              |
| TC-DT-06 | `"not-a-date"`                               | Invalid Date                 | Rejected             |
| TC-DT-07 | `null` (nullable field)                      | null                         | Yes                  |
| TC-DT-08 | `"2000-02-29"` (leap day)                    | Valid                        | Yes                  |
| TC-DT-09 | `"1900-02-29"` (not leap year)               | Invalid Date                 | Rejected             |
| TC-DT-10 | EU DST spring-forward date                   | UTC storage — no issue       | Yes                  |
| TC-DT-11 | `"2026-12-31T23:59:59.999Z"` (year boundary) | Valid                        | Yes                  |
| TC-DT-12 | `Number.MAX_SAFE_INTEGER`                    | Year ~287,396                | **Yes** (absurd)     |
| TC-DT-13 | `Number.MIN_SAFE_INTEGER`                    | Far past                     | **Yes** (absurd)     |

### 35.2 Display Timezone Issues

| #        | Scenario                                | Expected                                 |
| -------- | --------------------------------------- | ---------------------------------------- |
| TC-DT-14 | periodStart midnight UTC, user in UTC+3 | `toLocaleDateString` shows previous day! |
| TC-DT-15 | publishedAt midnight UTC, user in UTC+3 | Shows previous day                       |
| TC-DT-16 | submittedAt displayed in ru-RU vs en-US | Different pages use different locales    |
| TC-DT-17 | Dec 31 23:00 UTC, user UTC+3 → Jan 1    | Year changes in display                  |
| TC-DT-18 | No `timeZone: 'UTC'` in any formatter   | All dates shift by user timezone         |
| TC-DT-19 | Print page dates in en-US locale        | Inconsistent with ru-RU dashboard        |
| TC-DT-20 | Admin panel dates in en-US locale       | Inconsistent with ru-RU elsewhere        |

---

## 36. LOCALIZATION (TC-I18N-001..TC-I18N-015)

| #          | Scenario                                       | Priority | Expected                                                         |
| ---------- | ---------------------------------------------- | -------- | ---------------------------------------------------------------- |
| TC-I18N-01 | Admin panel dates: en-US                       | P1       | Should be ru-RU for Russian users                                |
| TC-I18N-02 | Print page dates: en-US                        | P1       | "April 12, 2026" instead of "12 апреля 2026"                     |
| TC-I18N-03 | Dashboard dates: ru-RU                         | P2       | Correct for target audience                                      |
| TC-I18N-04 | Archive dates: ru-RU                           | P2       | Correct                                                          |
| TC-I18N-05 | Mixed locale in same user flow                 | P1       | Head sees en-US admin + ru-RU dashboard                          |
| TC-I18N-06 | Validation messages in English                 | P1       | "Project X must have a traffic light" — should be Russian?       |
| TC-I18N-07 | All UI labels hardcoded English                | P2       | "My Report", "Submit Section", "Review Dashboard"                |
| TC-I18N-08 | Toast messages hardcoded English               | P2       | "Section submitted", "Report published"                          |
| TC-I18N-09 | localeCompare('ru') not used in DataTable sort | P1       | Cyrillic names sorted by Unicode codepoint, not Russian alphabet |
| TC-I18N-10 | Russian names with Ё/ё sorted incorrectly      | P2       | Ё often sorts wrong without ru locale                            |
| TC-I18N-11 | Empty state text in English                    | P3       | "No data yet", "No risks added"                                  |
| TC-I18N-12 | Auth error messages in English                 | P2       | "Service Unavailable", "Verification Failed"                     |
| TC-I18N-13 | Dialog descriptions in English                 | P2       | "Published reports cannot be edited"                             |
| TC-I18N-14 | Badge labels in English                        | P3       | "Submitted", "Draft", "Resolved", "Unresolved"                   |
| TC-I18N-15 | Button labels in English                       | P3       | "Add User", "Remove", "Publish Report"                           |

---

## 37. ACCESSIBILITY — DEEP (A11Y-040..A11Y-080)

### 37.1 Focus Management

| #        | Scenario                                                | Priority | Expected                                                               |
| -------- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| A11Y-040 | Submit validation error: focus NOT moved to error Alert | P0       | **BUG**: Error appears at top of form but focus stays on submit button |
| A11Y-041 | ConfirmDialog open: focus moves to Cancel button        | P1       | Radix default                                                          |
| A11Y-042 | ConfirmDialog close: focus returns to trigger           | P1       | Radix default                                                          |
| A11Y-043 | CrudSheet open: focus moves to first input              | P1       | Radix default                                                          |
| A11Y-044 | CrudSheet close: focus returns to "Add" button          | P1       | Radix default                                                          |
| A11Y-045 | MobileNav open: focus moves to close button             | P1       | Radix Sheet                                                            |
| A11Y-046 | MobileNav close: focus returns to hamburger             | P1       | Radix default                                                          |
| A11Y-047 | No skip-to-main-content link on any page                | P2       | **Missing**                                                            |

### 37.2 Missing ARIA Attributes

| #        | Scenario                                          | Priority | Expected                                                      |
| -------- | ------------------------------------------------- | -------- | ------------------------------------------------------------- |
| A11Y-050 | Sidebar `<nav>` landmark missing                  | P1       | **BUG**: Sidebar is a `<div>`, not `<nav>`                    |
| A11Y-051 | Desktop nav has no `aria-current="page"`          | P1       | **BUG**: Only MobileNav has it, not RoleNav                   |
| A11Y-052 | Read-only groups lack `aria-disabled="true"`      | P1       | **BUG**: Submitted form groups not announced as disabled      |
| A11Y-053 | CrudSheet inputs lack `aria-required`             | P1       | **Missing**: Name/Email have no required indicator            |
| A11Y-054 | CrudSheet inputs lack `aria-invalid` on error     | P1       | **Missing**: No error state communicated                      |
| A11Y-055 | Progress bar lacks `aria-label`                   | P1       | **BUG**: Screen reader says "progress bar N%" with no context |
| A11Y-056 | PDF export status badge not in `aria-live` region | P1       | **Missing**: Status changes not announced                     |
| A11Y-057 | Decorative Lucide icons lack `aria-hidden="true"` | P2       | FileDown, Check, Loader2, AlertCircle icons                   |
| A11Y-058 | ConfirmDialog loading button: no accessible name  | P2       | Spinner replaces text, no aria-label                          |

### 37.3 Keyboard Navigation Gaps

| #        | Scenario                                                  | Priority | Expected                                                                                         |
| -------- | --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| A11Y-060 | DataTable sortable headers not keyboard-operable          | P1       | **BUG**: No tabIndex, no onKeyDown on `<th>`                                                     |
| A11Y-061 | ArchiveReportList clickable rows not keyboard-activatable | P1       | **BUG**: onClick on `<tr>` but no tabIndex/onKeyDown — keyboard users can only use "Open" button |
| A11Y-062 | Tab order through lead form: all inputs reachable         | P0       | Verify full flow                                                                                 |
| A11Y-063 | Escape closes all dialogs                                 | P0       | Radix handles natively                                                                           |
| A11Y-064 | Escape closes all sheets                                  | P0       | Radix handles natively                                                                           |
| A11Y-065 | Tab trapped inside open dialog                            | P0       | Radix focus trap                                                                                 |
| A11Y-066 | Tab trapped inside open sheet                             | P0       | Radix focus trap                                                                                 |

### 37.4 Screen Reader Announcements

| #        | Scenario                                                      | Priority | Expected                            |
| -------- | ------------------------------------------------------------- | -------- | ----------------------------------- |
| A11Y-070 | Autosave "Saving..."/"Saved" announced via aria-live="polite" | P0       | Correct ✓                           |
| A11Y-071 | Validation errors announced via role="alert" on Alert         | P0       | Correct ✓                           |
| A11Y-072 | Toast notifications announced                                 | P1       | Verify Sonner Toaster has aria-live |
| A11Y-073 | Traffic light selection announced                             | P1       | aria-checked on radio               |
| A11Y-074 | DataTable sort direction announced                            | P1       | aria-sort on active column          |
| A11Y-075 | Page title changes on navigation                              | P2       | No explicit `<title>` per route     |

### 37.5 ItemsEditor ID Collision Risk

| #        | Scenario                                                   | Priority | Expected                                                                                   |
| -------- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| A11Y-076 | Items with same originalIndex across current/next sections | P1       | **Potential BUG**: Duplicate `id="item-{N}"` in DOM → broken label association             |
| A11Y-077 | Checkbox aria-label overrides implicit label text          | P2       | Inconsistent: aria-label says "Carry-over item N completed", visible text says "Completed" |

---

## 38. BROWSER COMPATIBILITY (COMPAT-001..COMPAT-015)

| #          | Scenario                                         | Priority | Expected                                                            |
| ---------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------- |
| COMPAT-001 | Chrome: OKLCH colors render                      | P0       | Full support since Chrome 111                                       |
| COMPAT-002 | Firefox: OKLCH colors render                     | P0       | Full support since Firefox 113                                      |
| COMPAT-003 | Safari: OKLCH colors render                      | P0       | Full support since Safari 15.4                                      |
| COMPAT-004 | Edge: OKLCH colors render                        | P0       | Same as Chrome (Chromium)                                           |
| COMPAT-005 | Safari: print CSS with OKLCH fallbacks           | P1       | Safari print may differ from Chromium                               |
| COMPAT-006 | Chrome PDF renderer (Playwright): OKLCH in PDF   | P0       | Chromium may not support OKLCH in PDF mode → hex fallbacks required |
| COMPAT-007 | Firefox: `break-before-page` support             | P1       | Supported but rendering may differ                                  |
| COMPAT-008 | Safari: `break-inside-avoid` support             | P1       | Supported since Safari 15                                           |
| COMPAT-009 | Mobile Safari: MobileNav Sheet touch interaction | P1       | Touch gestures for sheet close                                      |
| COMPAT-010 | Mobile Chrome: touch targets ≥ 44px              | P1       | Android usability                                                   |
| COMPAT-011 | IE11 (if any user has it)                        | P3       | Not supported — app uses ES2020+                                    |
| COMPAT-012 | Safari: `suppressHydrationWarning` behavior      | P2       | Same as Chrome                                                      |
| COMPAT-013 | Firefox: Radix UI dialog/sheet animations        | P2       | CSS animations may differ                                           |
| COMPAT-014 | Chrome: large DataTable (100+ rows) rendering    | P2       | No virtualization                                                   |
| COMPAT-015 | Safari: Inter font Cyrillic subset rendering     | P1       | Verify no fallback glyphs                                           |

---

## 39. DOCKER & DEPLOYMENT (DEPLOY-001..DEPLOY-015)

| #          | Scenario                                        | Priority | Expected                              |
| ---------- | ----------------------------------------------- | -------- | ------------------------------------- |
| DEPLOY-001 | Docker Compose up: postgres + redis + api + web | P0       | All 4 services start                  |
| DEPLOY-002 | API starts without Redis (BullMQ disabled)      | P0       | Should start gracefully               |
| DEPLOY-003 | API starts without PostgreSQL                   | P0       | healthcheck /health/ready returns 503 |
| DEPLOY-004 | /health/live returns 200 under normal load      | P0       | Liveness check                        |
| DEPLOY-005 | /health/ready returns 503 when DB unreachable   | P0       | Readiness check                       |
| DEPLOY-006 | Graceful shutdown (SIGTERM)                     | P1       | Connections drained                   |
| DEPLOY-007 | DATABASE_URL env var required                   | P0       | API fails to start without it         |
| DEPLOY-008 | AUTH_JWT_SECRET env var required                | P0       | JWT signing fails without it          |
| DEPLOY-009 | AUTH_DEV_MODE=false in production               | P0       | Dev-login not mounted                 |
| DEPLOY-010 | FRONTEND_URL env var for CORS                   | P0       | Cross-origin requests work            |
| DEPLOY-011 | Docker image build succeeds                     | P0       | Multi-stage Dockerfile                |
| DEPLOY-012 | Prisma migration on fresh DB                    | P0       | Schema applied correctly              |
| DEPLOY-013 | Seed script populates test data                 | P1       | 8 users, 6 projects, 1 period         |
| DEPLOY-014 | Port 3001 (API) and 3000 (web) exposed          | P0       | Container ports                       |
| DEPLOY-015 | Connection pool exhaustion under load           | P2       | PgBouncer removed — Prisma direct     |

---

## 40. ADDITIONAL BUGS FOUND IN PASS 3 (BUG-011..BUG-020)

| #       | Bug                                                                                                                                             | Severity | Location                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| BUG-011 | **Autosave no try/catch**: useEffect autosave has no error handling → "Saving..." indicator stuck forever on network error                      | P0       | apps/web/src/components/report-section/report-section-form.tsx |
| BUG-012 | **Submit no try/catch**: handleConfirmSubmit has no error handling → unhandled promise rejection on network failure                             | P0       | Same file                                                      |
| BUG-013 | **Zero-width space bypasses priority validation**: `"\u200B"` passes both Zod min(1) and client trim() check → visually empty priority accepted | P1       | packages/shared + apps/web                                     |
| BUG-014 | **Null byte crashes PostgreSQL**: `"\u0000"` in text fields passes Zod but PostgreSQL rejects → unhandled INTERNAL_SERVER_ERROR                 | P1       | packages/shared schemas                                        |
| BUG-015 | **No array size limits**: items/risks/decisions arrays have no max() → 10K+ elements pass Zod → DoS risk                                        | P1       | packages/shared schemas                                        |
| BUG-016 | **Pre-epoch dates accepted**: `z.coerce.date()` accepts negative numbers → dates in 1969 and before stored                                      | P2       | packages/shared schemas                                        |
| BUG-017 | **Mixed locale dates**: Admin panel uses en-US, dashboard uses ru-RU — same date looks different on same screen                                 | P1       | apps/web components                                            |
| BUG-018 | **No timeZone in date formatters**: Users in UTC+3 (Moscow) see period dates shifted one day earlier for midnight-UTC timestamps                | P1       | All date formatting call sites                                 |
| BUG-019 | **DataTable sort headers not keyboard-accessible**: `<th>` with onClick but no tabIndex/onKeyDown → keyboard-only users can't sort              | P1       | packages/ui DataTable                                          |
| BUG-020 | **toSubmitInput silently defaults unset traffic light to 'red'**: Client-side fallback may submit incorrect data when traffic light is null     | P1       | apps/web report-section-form.tsx                               |

---

## FINAL GRAND TOTAL

| Part                                                     | Categories       | Scenarios |
| -------------------------------------------------------- | ---------------- | --------- |
| **Part 1**: Core functionality                           | 20 categories    | ~1050     |
| **Part 2**: Edge cases, state machines, visual           | 11 categories    | ~213      |
| **Part 3**: Combinatorial, negative, network, i18n, a11y | 9 categories     | ~400      |
| **Discovered bugs (all parts)**                          | BUG-001..BUG-020 | 20        |
| **Part 3 subtotal**                                      |                  | **~1683** |

---

---

# PART 4: GAP REVIEW — MISSED SCENARIOS

**Added:** 2026-04-12 (review pass)
**New scenarios:** ~80

---

## 41. PRISMA↔APP SCHEMA DRIFT (SCH-001..SCH-006)

| #       | Scenario                                                                                                        | Priority | Expected                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| SCH-001 | PdfExportJob: DB writes `pending`, app expects `queued`                                                         | P0       | Verify mapping dbStatusToDomain round-trips correctly               |
| SCH-002 | ReminderExecution: DB `pending` initial state vs app `queued`                                                   | P1       | Verify initial write                                                |
| SCH-003 | ReminderRule DB columns (name, cronExpression, enabled) vs app schema (kind, fireAt, timezone, status, version) | P0       | Structural mismatch — verify actual DB columns match service writes |
| SCH-004 | CarryOverExecution: service only writes `completed` — verify no orphan `pending` rows                           | P1       | No code path writes pending                                         |
| SCH-005 | PdfExportJob.requestedBy required in DB — verify service passes it                                              | P0       | NOT NULL constraint                                                 |
| SCH-006 | Priority @@unique([reportSectionId, rank]) with concurrent saveDraft                                            | P1       | Rank collision at DB level                                          |

---

## 42. AUTH EXTENDED (AUTH-EXT-001..AUTH-EXT-010)

| #            | Scenario                                                           | Priority | Expected                                                   |
| ------------ | ------------------------------------------------------------------ | -------- | ---------------------------------------------------------- |
| AUTH-EXT-001 | Logout cookie name mismatch: hardcoded vs AUTH_JWT_COOKIE_NAME env | P0       | **BUG**: Custom cookie name → logout doesn't clear session |
| AUTH-EXT-002 | JWT expires after 60 min during active autosave                    | P0       | UNAUTHORIZED → redirect to login                           |
| AUTH-EXT-003 | JWT expires mid-submit between client validation and API call      | P0       | Auth redirect, not generic error                           |
| AUTH-EXT-004 | SAML callback with unrecognized role "manager"                     | P1       | Cast `as Role` — no runtime validation                     |
| AUTH-EXT-005 | SAML callback with missing role attribute                          | P1       | Null role, DB write behavior?                              |
| AUTH-EXT-006 | Server start with AUTH_DEV_MODE=false and no AUTH_JWT_SECRET       | P0       | Env validation fails at startup                            |
| AUTH-EXT-007 | AUTH_JWT_COOKIE_NAME absent from env schema                        | P2       | Verify default fallback works                              |
| AUTH-EXT-008 | Cookie `secure: true` only in production (NODE_ENV)                | P1       | HTTP in dev, HTTPS in prod                                 |
| AUTH-EXT-009 | Dev login with custom email override                               | P2       | Session built for specified email                          |
| AUTH-EXT-010 | Dev login role=invalid returns 400                                 | P1       | Descriptive error                                          |

---

## 43. PDF PROCESSOR GAPS (PDF-EXT-001..PDF-EXT-005)

| #           | Scenario                                                     | Priority | Expected                                                                 |
| ----------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| PDF-EXT-001 | Playwright navigates to print page WITHOUT auth cookie       | P0       | **BUG RISK**: Headless browser may get auth error page instead of report |
| PDF-EXT-002 | PDF_OUTPUT_DIR not set → fallback to /app/data/pdfs          | P1       | Directory must exist or write fails                                      |
| PDF-EXT-003 | artifactUrl stored as relative `/pdfs/{jobId}.pdf`           | P1       | Frontend download link must resolve                                      |
| PDF-EXT-004 | Two PDF exports for same report running simultaneously       | P1       | Both produce valid PDFs, non-deterministic                               |
| PDF-EXT-005 | Checksum (SHA-256) correct length and non-null on completion | P2       | Integrity verification                                                   |

---

## 44. REMINDER EXTENDED (REM-EXT-001..REM-EXT-006)

| #           | Scenario                                                       | Priority | Expected                                 |
| ----------- | -------------------------------------------------------------- | -------- | ---------------------------------------- |
| REM-EXT-001 | Email body contains reportId UUID (not human-readable period)  | P2       | Verify email content                     |
| REM-EXT-002 | AdminPanel sends reminder only to leads[0].email (first lead)  | P1       | Only one job queued, not per-lead        |
| REM-EXT-003 | listReminderExecutions .at(-1) for latest — not sorted by date | P2       | May return wrong "latest"                |
| REM-EXT-004 | BullMQ failed event: does it update DB status to `failed`?     | P1       | Only logs to stderr                      |
| REM-EXT-005 | Execute paused rule: verify specific error code                | P1       | BAD_REQUEST not FORBIDDEN                |
| REM-EXT-006 | Deduplication key includes fireAt but NOT email                | P1       | Same rule+fireAt blocks second recipient |

---

## 45. ADMIN EXTENDED (ADMIN-EXT-001..ADMIN-EXT-007)

| #             | Scenario                                                 | Priority | Expected                            |
| ------------- | -------------------------------------------------------- | -------- | ----------------------------------- |
| ADMIN-EXT-001 | Remove lead with projects: DB FK Restrict error          | P0       | UI must show meaningful error       |
| ADMIN-EXT-002 | Remove lead who is activeReportSectionId author          | P1       | Subsequent saveDraft fails          |
| ADMIN-EXT-003 | Bootstrap project when no lead users exist               | P1       | Silent no-op (no error, no project) |
| ADMIN-EXT-004 | Bootstrap twice: hardcoded UUIDs → upsert not duplicate  | P1       | Idempotent                          |
| ADMIN-EXT-005 | Admin snapshot full round-trip (export/import)           | P2       | All 6 entity types preserved        |
| ADMIN-EXT-006 | Snapshot import during active autosave                   | P1       | Race condition                      |
| ADMIN-EXT-007 | ReminderRule version field: DB column or in-memory only? | P2       | Verify persistence                  |

---

## 46. MULTI-STEP WORKFLOWS (WORKFLOW-001..WORKFLOW-007)

| #            | Scenario                                                      | Priority | Expected                                        |
| ------------ | ------------------------------------------------------------- | -------- | ----------------------------------------------- |
| WORKFLOW-001 | Full cycle: 6 leads submit → head publishes → PDF → download  | P0       | All state transitions work without page refresh |
| WORKFLOW-002 | Partial submission: 3/6 leads submit, head publishes          | P0       | Publish allowed (no completeness check)         |
| WORKFLOW-003 | JWT expires mid-form, lead clicks submit                      | P0       | Redirect to login, draft preserved by autosave  |
| WORKFLOW-004 | Carry-over → lead sees carried items → edits → submits        | P0       | Both carried and new items in submitted section |
| WORKFLOW-005 | Two tabs same section: tab A saves data A, tab B saves data B | P1       | Last-write-wins, no data corruption             |
| WORKFLOW-006 | Viewer accesses published report and archive only             | P0       | FORBIDDEN on any head/lead endpoints            |
| WORKFLOW-007 | Viewer calls review.dashboard (protectedProcedure)            | P1       | Succeeds — is this intentional?                 |

---

## 47. ENVIRONMENT VARIABLES (ENV-001..ENV-003)

| #       | Scenario                                                | Priority | Expected                    |
| ------- | ------------------------------------------------------- | -------- | --------------------------- |
| ENV-001 | PDF_OUTPUT_DIR absent from env schema/.env.example      | P1       | Fallback used, documented   |
| ENV-002 | AUTH_JWT_COOKIE_NAME absent from env schema             | P1       | Logout cookie mismatch risk |
| ENV-003 | PDF_BASE_URL absent → Playwright navigates to undefined | P0       | PDF generation fails        |

---

## 48. COMPONENT EDGE CASES (COMP-EXT-001..COMP-EXT-010)

| #            | Scenario                                                           | Priority | Expected                                   |
| ------------ | ------------------------------------------------------------------ | -------- | ------------------------------------------ |
| COMP-EXT-001 | RoleNav uses `<a>` not `<Link>` → full page reload on nav          | P1       | Unsaved autosave data lost                 |
| COMP-EXT-002 | Head edits first item when section has 0 items                     | P1       | items[0] access on empty array → undefined |
| COMP-EXT-003 | Head traffic light edit doesn't reset section status to draft      | P0       | Section stays submitted                    |
| COMP-EXT-004 | toSubmitInput: null trafficLight → forced 'red'                    | P1       | Incorrect data submitted silently          |
| COMP-EXT-005 | QueryError UNAUTHORIZED redirect with undefined API URL            | P1       | Redirects to localhost:3001                |
| COMP-EXT-006 | QueryError network error case-insensitive match                    | P2       | "Network Error" caught                     |
| COMP-EXT-007 | PDF download button absent when status=failed                      | P1       | Only when completed+artifactUrl            |
| COMP-EXT-008 | PDF download button absent when artifactUrl=null despite completed | P1       | Edge case                                  |
| COMP-EXT-009 | Back button after submit → stale form state                        | P1       | Should show submitted read-only            |
| COMP-EXT-010 | Page refresh mid-form → unsaved changes lost (last autosave)       | P1       | Recovery from last successful autosave     |

---

## ADDITIONAL BUGS FOUND IN REVIEW (BUG-021..BUG-025)

| #       | Bug                                                                                                                                                              | Severity | Location                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| BUG-021 | **Logout cookie name hardcoded**: POST /auth/logout clears `customreport_session` but cookie name is configurable via AUTH_JWT_COOKIE_NAME — logout may not work | P0       | apps/api/src/modules/auth/auth.routes.ts |
| BUG-022 | **PDF processor no auth cookie**: Playwright headless browser navigates to print page without session cookie → may get auth error instead of report              | P0       | apps/api/src/modules/pdf-export/         |
| BUG-023 | **Reminder dedupeKey excludes email**: Two different recipients for same rule+fireAt share dedupeKey → second recipient never gets email                         | P1       | apps/api/src/modules/reminders/          |
| BUG-024 | **Head edits item[0] on empty items array**: `section.items[0]` is undefined when no items exist → potential runtime error                                       | P1       | apps/web assembled-report-review.tsx     |
| BUG-025 | **RoleNav full page reload**: Uses `<a>` instead of Next.js `<Link>` → every nav click triggers full reload, killing in-flight autosave                          | P1       | apps/web role-nav.tsx                    |

---

## FINAL GRAND TOTAL (ALL PARTS)

| Part                                                     | Categories        | Scenarios |
| -------------------------------------------------------- | ----------------- | --------- |
| **Part 1**: Core functionality                           | 20 categories     | ~1050     |
| **Part 2**: Edge cases, state machines, visual           | 11 categories     | ~213      |
| **Part 3**: Combinatorial, negative, network, i18n, a11y | 9 categories      | ~420      |
| **Part 4**: Gap review findings                          | 8 categories      | ~80       |
| **Discovered bugs**                                      | BUG-001..BUG-025  | 25        |
| **FINAL TOTAL**                                          | **48 categories** | **~1788** |

---

## v6.0 Release Smoke (Phase 28 / REL-03)

1:1 mapping with `/CHECKLIST.md` items. Every CHECKLIST.md ID below has one row here so an auditor can trace any release-day check back to a documented scenario.

### FUNC-LEAD-001 — Lead can save a draft section

- **Surface:** /lead/report
- **Setup:** lead session (AUTH_DEV_MODE_ALLOW_TEST=true or real Keycloak login)
- **Steps:** open page, fill at least one field, wait for autosave, refresh — value persists
- **Pass criteria:** ReportSection.status === 'draft', updated content visible after refresh
- **CI command:** n/a (manual)
- **Phase:** 28

### FUNC-LEAD-002 — Lead can submit a section after autosave settles

- **Surface:** /lead/report
- **Setup:** lead session with non-empty draft
- **Steps:** click "Submit", confirm dialog, observe lock + Submitted badge
- **Pass criteria:** ReportSection.status === 'submitted'; form is locked
- **CI command:** n/a (manual)
- **Phase:** 28

### FUNC-HEAD-001 — Head sees the assembled report and publishes it

- **Surface:** /head/dashboard, /head/report
- **Setup:** head session; >=1 submitted ReportSection
- **Steps:** open dashboard, navigate to assembled report, click Publish
- **Pass criteria:** Report.status === 'published', visible to viewers in /reports/history
- **CI command:** n/a (manual)
- **Phase:** 28

### FUNC-INTG-001 — Integration suite green

- **Surface:** apps/web Playwright integration suite
- **Setup:** docker postgres + redis up; `customreport_e2e` DB seeded
- **Steps:** `pnpm test:e2e:integration`
- **Pass criteria:** 21/21 specs green (Phase 27 baseline)
- **CI command:** `pnpm --filter @customreport/web test:e2e:integration`
- **Phase:** 28 (CI gate)

### AUTH-LOGIN-001 — Login as lead via Keycloak

- **Surface:** /login → /lead/report
- **Setup:** mock IdP container in docker-compose.test.yml (Phase 29) OR AUTH_DEV_MODE_ALLOW_TEST=true (Phase 28-02)
- **Steps:** navigate to /login; submit lead credentials; assert /lead/report renders
- **Pass criteria:** session cookie set; tRPC auth.me returns role=lead
- **CI command:** n/a (manual until Phase 29)
- **Phase:** 28 (with mock fallback) → 29 (full Keycloak)

### AUTH-LOGIN-002 — Login as head; head-only routes accessible

- **Surface:** /login → /head/dashboard
- **Setup:** head SAML profile / DEV_SESSION
- **Steps:** authenticate as head, open /head/dashboard, /head/report, /admin
- **Pass criteria:** all three pages render without 403
- **CI command:** n/a (manual)
- **Phase:** 28

### AUTH-VIEWER-001 — Viewer cannot access /admin or /head/\*

- **Surface:** /admin, /head/dashboard
- **Setup:** viewer session
- **Steps:** request restricted paths
- **Pass criteria:** SSR layout / proxy.ts redirects to /reports/history (or returns 403)
- **CI command:** n/a (manual)
- **Phase:** 28 (server check) → 29 (frontend RoleGate)

### AUTH-FILTERS-001 — Service-layer role filter unit tests

- **Surface:** archive.\* + weeklyReport.get + review.dashboard
- **Setup:** vitest harness; PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=давай
- **Steps:** run service-level unit tests
- **Pass criteria:** "AUTH-04 viewer scoping" describe blocks green; viewer cannot read draft rows
- **CI command:** `pnpm --filter @customreport/api test apps/api/src/modules/archive apps/api/src/modules/weekly-report`
- **Phase:** 28 (CI gate)

### AUTH-DEFAULT-DENY-001 — Default-deny role coverage gate

- **Surface:** trpc.router leaf procedures
- **Setup:** vitest harness
- **Steps:** run role-coverage.test.ts
- **Pass criteria:** every procedure prefix matches one of {publicProcedure, protectedProcedure, headProcedure, leadProcedure, viewerProcedure, anyRoleProcedure}
- **CI command:** `pnpm --filter @customreport/api test apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`
- **Phase:** 28 (CI gate; from Phase 27 / Plan 04)

### PDF-EXPORT-001 — Head exports a published report; PDF downloads non-empty

- **Surface:** /head/report Export PDF button
- **Setup:** head session; published report; AUTH_DEV_MODE_ALLOW_TEST=true; PDF_EXPORT_JWT_SECRET set
- **Steps:** click Export PDF, observe job queued, wait for completion, download file
- **Pass criteria:** /pdfs/<jobId>.pdf > 1KB; opens cleanly in a PDF viewer
- **CI command:** n/a (manual until Phase 29 e2e harness)
- **Phase:** 28

### PDF-COOKIE-001 — PDF cookie seam test

- **Surface:** PdfExportService.signPdfExportToken + processor cookie injection
- **Setup:** PDF_EXPORT_JWT_SECRET set; vitest harness
- **Steps:** unit-level guard verifies authToken is JWT-shaped and carries reportId claim
- **Pass criteria:** "AUTH-05 PDF export JWT signing" describe block green
- **CI command:** `pnpm --filter @customreport/api test apps/api/src/modules/pdf-export/pdf-export.service.test.ts`
- **Phase:** 28 (CI gate)

### PDF-CONTENT-001 — Generated PDF contains the report period text and lead names

- **Surface:** /pdfs/<jobId>.pdf
- **Setup:** as PDF-EXPORT-001
- **Steps:** open PDF, search for the period dates and at least 2 lead names
- **Pass criteria:** all expected text present; layout not broken
- **CI command:** n/a (manual)
- **Phase:** 28

### EMAIL-DEADLINE-001 — T-24h deadline reminder lands in test inbox; HTML and plaintext both present

- **Surface:** SMTP/test inbox
- **Setup:** test SMTP server (or jsonTransport in dev); ReminderRule kind=deadline with fireAt in the past; >=1 lead with draft section
- **Steps:** trigger RemindersScheduler.runOnce(now); inspect outgoing email
- **Pass criteria:** multipart email with both HTML and text bodies; subject contains report period and "24h"
- **CI command:** n/a (manual integration smoke)
- **Phase:** 28

### EMAIL-IDEMPOTENT-001 — Reminder idempotency test

- **Surface:** RemindersScheduler.runOnce
- **Setup:** vitest harness; in-memory repo
- **Steps:** fire scheduler twice within one UTC day with the same recipient; observe queue.add call count
- **Pass criteria:** queue.add called exactly once across both ticks
- **CI command:** `pnpm --filter @customreport/api test apps/api/src/modules/reminders/reminders.scheduler.test.ts`
- **Phase:** 28 (CI gate)

### EMAIL-DELIVERY-001 — Corporate SMTP accepts and delivers (no spam-folder routing)

- **Surface:** corporate SMTP server
- **Setup:** SMTP_HOST set to staging SMTP; SMTP_FROM aligned with corporate sender policy
- **Steps:** send a deadline reminder to a real corporate inbox; verify inbox placement (not spam)
- **Pass criteria:** message in primary inbox; SPF/DKIM pass
- **CI command:** n/a (manual)
- **Phase:** 28

### MOB-VIEWPORT-001 — All 7 pages have no horizontal scroll at 375px (Phase 30)

- **Surface:** every routed page
- **Setup:** Chrome DevTools mobile emulation 375x812
- **Steps:** scroll each page; assert no horizontal overflow
- **Pass criteria:** scrollWidth === clientWidth on body; no clipped controls
- **CI command:** n/a (Phase 30 will add a Playwright viewport spec)
- **Phase:** 30 (deferred)

### MOB-TAP-001 — Tap targets >=44px on iOS (Phase 30)

- **Surface:** every interactive element
- **Setup:** iOS device or Safari DevTools
- **Steps:** measure interactive element bounding boxes
- **Pass criteria:** min(width, height) >= 44px for all primary tap targets
- **CI command:** n/a (Phase 30)
- **Phase:** 30 (deferred)

### AI-EVAL-001 — AI eval suite green (Phase 31)

- **Surface:** AI insight generators
- **Setup:** Anthropic API key; eval dataset checked in
- **Steps:** `pnpm test:ai-eval`
- **Pass criteria:** all eval thresholds met
- **CI command:** `pnpm test:ai-eval` (script not yet implemented — Phase 31)
- **Phase:** 31 (deferred; CI-gate placeholder)

### AI-COST-001 — Anthropic dashboard daily spend <= budget cap (Phase 31)

- **Surface:** Anthropic console
- **Setup:** dashboard access
- **Steps:** check daily spend on staging key
- **Pass criteria:** spend <= configured cap
- **CI command:** n/a (manual)
- **Phase:** 31 (deferred)

### ANAL-CHARTS-001 — /reports/trends renders without console errors (Phase 30)

- **Surface:** /reports/trends
- **Setup:** head/viewer session; >=4 published reports
- **Steps:** open page, watch console
- **Pass criteria:** no console errors; charts render
- **CI command:** n/a (Phase 30)
- **Phase:** 30 (deferred)

### ANAL-PERF-001 — Analytics query p95 <200ms (Phase 30)

- **Surface:** analytics tRPC procedures
- **Setup:** load-test harness
- **Steps:** run k6 / autocannon against the trends endpoint
- **Pass criteria:** p95 latency < 200ms
- **CI command:** n/a (Phase 30)
- **Phase:** 30 (deferred)

---

# PART 5: PRODUCT-READY DOMAIN REGRESSION HARDENING

**Added:** 2026-05-08
**Reason:** manual UAT found domain-model, role, auth, hover, and evidence gaps that were not caught by broad page-level regression.
**Source plan:** .planning/regression/PRODUCT-READY-RETRO-AND-PLAN-2026-05-08.md

## 49. REPORTING SCOPE AND SDLC ASSIGNMENTS (DOM-STAGE-001..DOM-STAGE-006)

| #             | Scenario                                                                 | Priority | Expected                                                                          |
| ------------- | ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| DOM-STAGE-001 | Lead owns a product via Project.leadId but has no StageAssignment for it | P0       | Product is not included in lead report scope and does not block submit            |
| DOM-STAGE-002 | Lead has 3 stage assignments on one product                              | P0       | Exactly one product appears with exactly those 3 assigned stages                  |
| DOM-STAGE-003 | Lead sets Dev stage to Blocked                                           | P0       | Dev changes only; Testing and DevOps keep prior statuses                          |
| DOM-STAGE-004 | Lead changes Testing from Blocked/At Risk back to On Track               | P0       | Testing persists as On Track after autosave and reload                            |
| DOM-STAGE-005 | Head opens assembled report after per-stage updates                      | P0       | Product aggregate is derived from stage statuses and matches worst assigned stage |
| DOM-STAGE-006 | Admin changes a stage assignment                                         | P1       | Lead report scope updates after reload; removed assignments no longer validate    |

## 50. OPTIONAL MULTI-STAGE TAGGING (DOM-TAG-001..DOM-TAG-006)

| #           | Scenario                                                   | Priority | Expected                                                                        |
| ----------- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| DOM-TAG-001 | Lead creates Current Week item with no stages selected     | P0       | Item saves, reloads, and displays as applying to all assigned stages            |
| DOM-TAG-002 | Lead creates Current Week item with Dev + Testing selected | P0       | Item saves, reloads, and displays both selected stage badges                    |
| DOM-TAG-003 | Lead creates Next Week item with DevOps selected           | P1       | Item saves and displays the DevOps badge                                        |
| DOM-TAG-004 | Lead creates Risk/Blocker with no stages selected          | P0       | Risk applies to all assigned stages and does not fail required-stage validation |
| DOM-TAG-005 | Lead creates Decision with Dev + Testing selected          | P0       | Decision displays both stage badges; owner is read-only/current user            |
| DOM-TAG-006 | Lead creates Priority with one selected stage              | P1       | Priority displays selected stage after reload                                   |

## 51. ROLE AND SESSION MATRIX (ROLE-CTX-001..ROLE-CTX-006)

| #            | Scenario                                    | Priority | Expected                                                     |
| ------------ | ------------------------------------------- | -------- | ------------------------------------------------------------ |
| ROLE-CTX-001 | Anonymous browser opens /head/dashboard     | P0       | Redirects to landing/login with next, no indefinite skeleton |
| ROLE-CTX-002 | Lead browser opens /head/dashboard          | P0       | Authenticated forbidden page, not login                      |
| ROLE-CTX-003 | Head browser opens /head/dashboard          | P0       | Dashboard loads successfully                                 |
| ROLE-CTX-004 | Admin browser opens /admin                  | P0       | Admin loads successfully                                     |
| ROLE-CTX-005 | Viewer browser opens /admin                 | P0       | Authenticated forbidden page                                 |
| ROLE-CTX-006 | Anonymous browser opens /reports?tab=drafts | P0       | Redirects to landing/login with next                         |

## 52. UI GEOMETRY AND STATIC CHROME (UI-GEO-001..UI-GEO-006)

| #          | Scenario                                       | Priority | Expected                                                                |
| ---------- | ---------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| UI-GEO-001 | Hover over portfolio/report product card       | P1       | Bounding box top and height do not change; card does not overlap header |
| UI-GEO-002 | Open /reports?tab=drafts                       | P0       | Exactly one nav item is active: My History                              |
| UI-GEO-003 | Open /reports?tab=published                    | P0       | Exactly one nav item is active: Archive                                 |
| UI-GEO-004 | Empty product appears in assembled/head report | P1       | Product is muted, collapsed, non-expandable, and has no empty body copy |
| UI-GEO-005 | Open Decision modal at desktop width           | P1       | Owner display and fields are aligned; no overlap or clipping            |
| UI-GEO-006 | Open Decision modal at mobile width            | P1       | Fields stack cleanly; buttons remain visible                            |

## 53. ACTION LOG AND EVIDENCE (LOG-EV-001..LOG-EV-006)

| #          | Scenario                         | Priority | Expected                                                                                              |
| ---------- | -------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| LOG-EV-001 | Lead creates an item             | P0       | Persistent report.item.created action log entry exists with timestamp, user, route, correlationId     |
| LOG-EV-002 | Lead changes a stage status      | P0       | Persistent report.stage_status.changed action log entry exists with old/new status                    |
| LOG-EV-003 | Lead submits report              | P0       | report.submit.opened and report.submit.confirmed entries exist                                        |
| LOG-EV-004 | Admin changes a stage assignment | P0       | admin.stage_assignment.changed entry exists                                                           |
| LOG-EV-005 | Any role scenario completes      | P0       | Browser console has no unexpected errors and network has no 5xx responses                             |
| LOG-EV-006 | Any role scenario completes      | P0       | Evidence folder contains screenshots and JSON logs named by scenario ID                               |
| LOG-EV-007 | Weekly report load fails         | P0       | Backend log contains weeklyReport.get role/report context; frontend log contains route context        |
| LOG-EV-008 | Head opens lead report URL       | P0       | Frontend redirects to head report/dashboard; backend has no head-owned leadForm.byPeriod 5xx          |
| LOG-EV-009 | Lead form load fails             | P0       | Backend log contains leadForm.byPeriod NOT_FOUND with role/report/author context; no Unexpected error |
