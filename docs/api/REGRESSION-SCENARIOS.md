# Regression Test Scenarios

Complete regression scenarios organized by role. Each scenario describes a user journey
that must work end-to-end. These scenarios serve as the acceptance criteria for backend
completeness.

---

## Lead Scenarios (Team Lead)

### L-001: First Login — Auto-Create Weekly Report
**Given**: Lead user with projects, no existing report for current week
**When**: Lead logs in via SAML
**Then**:
1. System creates Report with `periodStart` = Monday 00:00, `periodEnd` = Sunday 23:59:59
2. System creates ReportSection linked to this lead
3. System creates 3 Priority records (rank 1, 2, 3) with default text
4. System creates ProjectStatus records for each non-archived project (status: green)
5. Session JWT contains valid `activeReportId` and `activeReportSectionId`
6. `reports.getActive` returns the new section with all projects

### L-002: Returning Login — Existing Report
**Given**: Lead user with existing draft section for current week
**When**: Lead logs in
**Then**:
1. No new Report or Section is created
2. Session references existing section
3. `reports.getActive` returns existing section data

### L-003: Save Draft — Full Section
**Given**: Lead has active draft section
**When**: Lead calls `reports.saveDraft` with:
  - Traffic lights for all projects
  - 5 current items, 3 next items
  - 2 risks with impact + mitigation
  - 1 decision with owner + deadline
  - 3 priorities
**Then**:
1. Section is persisted
2. Returned data matches input
3. Status remains 'draft'
4. `submittedAt` remains null

### L-004: Save Draft — Partial Data
**Given**: Lead has active draft section
**When**: Lead calls `reports.saveDraft` with:
  - No traffic lights (all optional in draft)
  - Empty items array
  - Empty risks, decisions
  - 1 priority
**Then**:
1. Section is saved (all fields optional in draft)
2. Traffic lights are null
3. Items/risks/decisions arrays are empty

### L-005: Save Draft — Autosave Idempotency
**Given**: Lead has draft with 3 items
**When**: Same `saveDraft` payload is sent twice (simulating autosave)
**Then**:
1. Both calls succeed
2. Final state matches the input
3. No duplicate items created

### L-006: Save Draft — Rejected After Submit
**Given**: Lead has submitted section (status: 'submitted')
**When**: Lead calls `reports.saveDraft`
**Then**:
1. Error: `SECTION_ALREADY_SUBMITTED` "Submitted sections are read-only."
2. Section data unchanged

### L-007: Save Draft — Rejected After Publish
**Given**: Head has published the report
**When**: Lead calls `reports.saveDraft`
**Then**:
1. Error: `SECTION_ALREADY_SUBMITTED` "Cannot edit sections of a published report."
2. Section data unchanged

### L-008: Submit — Happy Path
**Given**: Lead has draft with:
  - All projects have traffic light
  - All projects have at least one current item
  - 3 priorities filled
**When**: Lead calls `reports.submit` with `confirmed: true`
**Then**:
1. Section status changes to 'submitted'
2. `submittedAt` is set to current time
3. All data persisted (items, risks, decisions, priorities)
4. Subsequent `saveDraft` calls are rejected

### L-009: Submit — Missing Traffic Light
**Given**: Lead has 2 projects, one without traffic light
**When**: Lead calls `reports.submit`
**Then**:
1. Error: `MISSING_TRAFFIC_LIGHT` for the project without status
2. Section remains draft

### L-010: Submit — Missing Current Item
**Given**: Lead has project with only 'next' items, no 'current' items
**When**: Lead calls `reports.submit`
**Then**:
1. Error: `MISSING_CURRENT_ITEM` for that project
2. Section remains draft

### L-011: Submit — Missing Priorities
**Given**: Lead has only 2 priorities (needs exactly 3)
**When**: Lead calls `reports.submit`
**Then**:
1. Zod validation error (priorities.length !== 3)
2. Section remains draft

### L-012: Submit — Empty Priority Text
**Given**: Lead has 3 priorities, one with blank text
**When**: Lead calls `reports.submit`
**Then**:
1. Zod validation error (safeText rejects empty/whitespace)
2. Section remains draft

### L-013: Submit — Double Submit
**Given**: Lead has already submitted section
**When**: Lead calls `reports.submit` again
**Then**:
1. Error: `SECTION_ALREADY_SUBMITTED`
2. No state change

### L-014: View History
**Given**: Lead has sections in 3 different reports (different weeks)
**When**: Lead calls `reports.myHistory`
**Then**:
1. Returns 3 entries ordered by createdAt descending
2. Each entry contains: sectionId, reportId, periodStart, periodEnd, statuses

### L-015: View Dashboard
**Given**: Report has 3 leads (2 submitted, 1 draft)
**When**: Lead calls `review.dashboard`
**Then**:
1. Returns 3 rows
2. Draft rows come first, then submitted
3. Within same status, sorted by name (Russian locale)

### L-016: Access Control — Lead Cannot Publish
**Given**: Lead is authenticated
**When**: Lead calls `review.publish`
**Then**:
1. Error: 403 FORBIDDEN "Head role required"
2. Report unchanged

### L-017: Access Control — Lead Cannot Access Admin
**Given**: Lead is authenticated
**When**: Lead calls `admin.snapshot`
**Then**:
1. Error: 403 FORBIDDEN "Head role required"

### L-018: Access Control — Lead Cannot Export PDF
**Given**: Lead is authenticated
**When**: Lead calls `pdfExport.request`
**Then**:
1. Error: 403 FORBIDDEN "Head role required"

### L-019: Validation — Item Text Max Length
**Given**: Lead has active section
**When**: Lead calls `saveDraft` with item text of 501 characters
**Then**: Zod validation error

### L-020: Validation — Null Bytes in Text
**Given**: Lead has active section
**When**: Lead calls `saveDraft` with item text containing `\u0000`
**Then**: Zod validation error "Text must not contain null bytes"

### L-021: Validation — Zero-Width-Only Text
**Given**: Lead has active section
**When**: Lead calls `saveDraft` with item text `\u200B\u200B`
**Then**: Zod validation error "Text must contain visible characters"

### L-022: Validation — Max Items Boundary
**Given**: Lead has active section
**When**: Lead calls `saveDraft` with 100 items
**Then**: Success (at boundary)
**When**: Lead calls `saveDraft` with 101 items
**Then**: Zod validation error (exceeds max)

---

## Head Scenarios (Department Head / Director)

### H-001: First Login
**Given**: Head user exists in system
**When**: Head logs in
**Then**:
1. Session has `activeReportId` (latest draft report)
2. Session has `activeReportSectionId: null` (head has no section)
3. No ReportSection created for head

### H-002: View Dashboard
**Given**: Report has 6 leads
**When**: Head calls `review.dashboard`
**Then**:
1. Returns 6 rows
2. Shows status (draft/submitted) for each lead
3. Shows project names for each lead
4. Sorted: drafts first, then submitted

### H-003: View Assembled Report
**Given**: All leads have submitted
**When**: Head calls `review.assembledReport`
**Then**:
1. Returns full report with all sections
2. Portfolio overview computed (worst-case traffic light)
3. Sections sorted by authorName (Russian locale)
4. Each section has full data (items, risks, decisions, priorities)

### H-004: Portfolio Overview — All Green
**Given**: All project traffic lights are green
**When**: Head views assembled report
**Then**: `portfolioOverview.status` = 'green', `totals.green` = total projects

### H-005: Portfolio Overview — Mixed with Yellow
**Given**: 3 green, 2 yellow, 0 red
**When**: Head views assembled report
**Then**: `portfolioOverview.status` = 'yellow', totals correct

### H-006: Portfolio Overview — Any Red Overrides
**Given**: 3 green, 2 yellow, 1 red
**When**: Head views assembled report
**Then**: `portfolioOverview.status` = 'red', totals correct

### H-007: Publish Report
**Given**: Report is draft
**When**: Head calls `review.publish`
**Then**:
1. Report status changes to 'published'
2. `publishedAt` set to current time
3. `publishedById` set to head's userId
4. `publishedByName` set to head's name
5. Report appears in archive

### H-008: Publish — Already Published
**Given**: Report already published
**When**: Head calls `review.publish` again
**Then**:
1. Error: 409 CONFLICT "Report has already been published."
2. No state change

### H-009: Request PDF Export
**Given**: Report is published
**When**: Head calls `pdfExport.request`
**Then**:
1. PdfExportJob created with status 'queued'
2. BullMQ job enqueued
3. Returns job with jobId

### H-010: PDF Export — Draft Report
**Given**: Report is draft (not published)
**When**: Head calls `pdfExport.request`
**Then**:
1. Error: 404 NOT_FOUND "PDF export requires a published report."

### H-011: Poll PDF Status
**Given**: PDF job exists with status 'queued'
**When**: Head calls `pdfExport.status`
**Then**: Returns job with current status

### H-012: Poll PDF Status — Not Found
**Given**: Invalid jobId
**When**: Head calls `pdfExport.status`
**Then**: Error: 404 NOT_FOUND

### H-013: Admin — View Snapshot
**Given**: System has users, projects, periods, rules
**When**: Head calls `admin.snapshot`
**Then**:
1. Returns all users (sorted by name)
2. Returns all projects (sorted by name)
3. Returns all periods
4. Returns all reminder rules

### H-014: Admin — Create User
**Given**: Head has access
**When**: Head calls `admin.saveUser` with new user data
**Then**: User created, returned in snapshot

### H-015: Admin — Update User
**Given**: Existing user with id X
**When**: Head calls `admin.saveUser` with same id, different data
**Then**: User updated (not duplicated)

### H-016: Admin — Delete User
**Given**: Existing user
**When**: Head calls `admin.deleteUser`
**Then**: User removed from snapshot (hard delete)

### H-017: Admin — Create Project
**Given**: Head has access
**When**: Head calls `admin.saveProject` with new project
**Then**: Project created, returned in snapshot

### H-018: Admin — Archive Project (Soft Delete)
**Given**: Active project
**When**: Head calls `admin.deleteProject`
**Then**: Project `archived` set to true (still in list)

### H-019: Admin — Create Period
**Given**: Head has access
**When**: Head calls `admin.savePeriod`
**Then**: Period created with start/end/deadline

### H-020: Admin — Create Reminder Rule
**Given**: Head has access
**When**: Head calls `admin.saveReminderRule`
**Then**: Rule created with kind/fireAt/timezone

### H-021: Admin — Delete Reminder Rule
**Given**: Existing rule
**When**: Head calls `admin.deleteReminderRule`
**Then**: Rule removed from snapshot (hard delete)

### H-022: Execute Reminder
**Given**: Active reminder rule
**When**: Head calls `reminders.execute` with ruleId + email
**Then**:
1. Execution created with status 'queued'
2. BullMQ email job enqueued
3. DedupeKey set to `{ruleId}:{fireAt}:{email}`

### H-023: Reminder — Deduplication
**Given**: Same reminder already executed for same rule/email
**When**: Head calls `reminders.execute` again
**Then**: Returns existing execution (no duplicate email)

### H-024: Reminder — Paused Rule
**Given**: Reminder rule with status 'paused'
**When**: Head calls `reminders.execute`
**Then**: Error: 400 "Reminder execution requires an active rule."

### H-025: Reminder — Rule Not Found
**Given**: Invalid ruleId
**When**: Head calls `reminders.execute`
**Then**: Error: 400 "Reminder rule was not found."

### H-026: List Reminder Executions
**Given**: Rule has 5 past executions
**When**: Head calls `reminders.listExecutions`
**Then**: Returns all 5 executions

### H-027: Carry Over — Happy Path
**Given**: Source report has submitted sections with next items and unresolved decisions
**When**: Head calls `carryOver.execute` with source + target reportIds
**Then**:
1. `next` items copied as `current` with `carriedOver: true`
2. Unresolved decisions copied with `resolvedAt: null`
3. Items matched to target sections by authorId
4. Returns execution with correct counts

### H-028: Carry Over — Same Report
**Given**: Same reportId for source and target
**When**: Head calls `carryOver.execute`
**Then**: Error: 400 "Carry-over requires different source and target reports."

### H-029: Carry Over — No Sections
**Given**: Source or target has no sections
**When**: Head calls `carryOver.execute`
**Then**: Error: 400 "Carry-over requires both source and target sections."

### H-030: Carry Over — Deduplication
**Given**: Carry over already executed for source->target
**When**: Head calls `carryOver.execute` again
**Then**: Returns existing execution (no re-copy)

### H-031: Carry Over — Only Next Items
**Given**: Source has `current` and `next` items
**When**: Head calls `carryOver.execute`
**Then**: Only `next` items are carried, `current` items are NOT copied

### H-032: Carry Over — Resolved Decisions Not Copied
**Given**: Source has resolved and unresolved decisions
**When**: Head calls `carryOver.execute`
**Then**: Only unresolved decisions (resolvedAt === null) are carried

---

## Viewer Scenarios (Observer / Stakeholder)

### V-001: Login
**Given**: Viewer user exists
**When**: Viewer logs in
**Then**:
1. Session has `activeReportId` (latest draft report, if exists)
2. Session has `activeReportSectionId: null`
3. No ReportSection created

### V-002: View Dashboard
**Given**: Active report with leads
**When**: Viewer calls `review.dashboard`
**Then**: Returns submission status for all leads (read-only)

### V-003: View Archive — List
**Given**: 3 published reports exist
**When**: Viewer calls `archive.list`
**Then**:
1. Returns 3 reports
2. Sorted by publishedAt descending
3. Each has portfolioStatus, publishedByName

### V-004: View Archive — Detail
**Given**: Published report exists
**When**: Viewer calls `archive.detail`
**Then**: Returns full report with all sections

### V-005: View Archive — Not Found
**Given**: Non-existent reportId
**When**: Viewer calls `archive.detail`
**Then**: Error: 404 NOT_FOUND

### V-006: Access Control — Cannot Edit
**Given**: Viewer is authenticated
**When**: Viewer calls `reports.saveDraft`
**Then**: Effectively no-op (no activeReportSectionId in session, section not found)

### V-007: Access Control — Cannot Publish
**Given**: Viewer is authenticated
**When**: Viewer calls `review.publish`
**Then**: Error: 403 FORBIDDEN

### V-008: Access Control — Cannot Access Admin
**Given**: Viewer is authenticated
**When**: Viewer calls `admin.snapshot`
**Then**: Error: 403 FORBIDDEN

### V-009: Access Control — Cannot Export PDF
**Given**: Viewer is authenticated
**When**: Viewer calls `pdfExport.request`
**Then**: Error: 403 FORBIDDEN

### V-010: Access Control — Cannot Execute Reminders
**Given**: Viewer is authenticated
**When**: Viewer calls `reminders.execute`
**Then**: Error: 403 FORBIDDEN

### V-011: Access Control — Cannot Carry Over
**Given**: Viewer is authenticated
**When**: Viewer calls `carryOver.execute`
**Then**: Error: 403 FORBIDDEN

---

## Cross-Role Scenarios

### X-001: Full Report Lifecycle
1. Head creates period via `admin.savePeriod`
2. Lead 1 logs in -> auto-creates section
3. Lead 2 logs in -> auto-creates section in same report
4. Lead 1 fills draft (saveDraft multiple times)
5. Lead 2 fills draft
6. Lead 1 submits section
7. Head sees 1 submitted, 1 draft on dashboard
8. Lead 2 submits section
9. Head sees 2 submitted on dashboard
10. Head views assembled report (all sections, portfolio overview)
11. Head publishes report
12. Leads' sections are now immutable (saveDraft rejected)
13. Head requests PDF export
14. Viewer sees report in archive

### X-002: New Week Transition
1. Week 1 report is published
2. Head carries over items from Week 1 to Week 2
3. Lead logs in -> new section for Week 2
4. Week 2 section has carried items (type: current, carriedOver: true)
5. Lead fills remaining fields and submits

### X-003: Unauthenticated Access
1. Any tRPC call without JWT cookie -> 401 UNAUTHORIZED
2. Expired JWT -> 401 UNAUTHORIZED
3. Invalid JWT -> 401 UNAUTHORIZED

### X-004: Multiple Leads Same Project
1. Lead 1 has project Alpha
2. Lead 2 has project Alpha and project Beta
3. Both login, each gets their own section
4. Lead 1 submits with Alpha = green
5. Lead 2 submits with Alpha = yellow, Beta = red
6. Assembled report shows Alpha twice (in different sections)
7. Portfolio overview counts all: green=1, yellow=1, red=1 -> status=red

### X-005: Admin Creates New Lead Mid-Week
1. Report exists for current week
2. Head creates new lead user via admin
3. New lead creates project for this lead
4. New lead logs in
5. Auto-create should create section in existing report (not a new one)
6. New section has ProjectStatus for the new project

### X-006: Reminder Flow
1. Head creates reminder rule for deadline
2. Head triggers execution for lead1@example.com
3. BullMQ processes job -> marks execution as 'sent'
4. Head triggers same rule+email again -> deduplicated, returns existing
5. Head views listExecutions -> shows 1 execution with status 'sent'

---

## Data Integrity Scenarios

### D-001: Items Array Boundary (100)
- 0 items: valid draft
- 100 items: valid (at boundary)
- 101 items: rejected by Zod

### D-002: Risks Array Boundary (100)
- Same as D-001

### D-003: Decisions Array Boundary (100)
- Same as D-001

### D-004: Priorities (Draft vs Submit)
- Draft: 0-50 priorities allowed
- Submit: exactly 3 with unique ranks required

### D-005: safeText Validation
- Empty string: rejected (min 1)
- Whitespace only: rejected (invisible-only check)
- Zero-width characters only: rejected
- Null byte: rejected
- Normal text with ZWS mixed in: accepted
- 500 chars: accepted (at boundary for item text)
- 501 chars: rejected (exceeds max)

### D-006: UUID Validation
- All ID fields must be valid UUID v4
- Non-UUID strings: rejected
- Empty strings: rejected

### D-007: Date Validation (reportDate)
- Year 2000: accepted (boundary)
- Year 1999: rejected
- Year 2026: accepted
- Epoch 0 (1970): rejected

### D-008: Traffic Light Values
- 'green', 'yellow', 'red': accepted
- 'blue', 'orange', '': rejected
- null: rejected in submit, allowed in draft

### D-009: Role Enum
- 'lead', 'head', 'viewer': accepted
- 'admin', 'LEAD', '': rejected

### D-010: Status Transitions
- draft -> submitted: allowed (via submit)
- submitted -> draft: NOT allowed (no endpoint for this)
- draft -> published: NOT allowed at section level (only at report level by head)
- published -> draft: NOT allowed (immutable)

---

## Test Count Summary

| Role | Scenarios | Tests |
|------|-----------|-------|
| Lead | L-001 to L-022 | 22 |
| Head | H-001 to H-032 | 32 |
| Viewer | V-001 to V-011 | 11 |
| Cross-Role | X-001 to X-006 | 6 |
| Data Integrity | D-001 to D-010 | 10 |
| **Total** | | **81** |
