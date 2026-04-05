# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse (3 phases)
**Coverage:** 29/29 v1 requirements mapped

---

## Phases

- [ ] **Phase 1: Core Report Capture** - Leads fill sections, head reviews submissions, data persists
- [ ] **Phase 2: Report Assembly & Publication** - Portfolio overview auto-assembles, reports published to web, PDF export available
- [ ] **Phase 3: Automation & Admin** - Email reminders, carry-over logic, admin panel, report history

---

## Phase Details

### Phase 1: Core Report Capture

**Goal:** Leads can submit structured report sections; head can review who has submitted; system captures all data with role-based access control

**Depends on:** Nothing (first phase)

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, ENTRY-01, ENTRY-02, ENTRY-03, ENTRY-04, ENTRY-05, ENTRY-06, ENTRY-07

**Success Criteria** (what must be TRUE):
  1. Lead logs in via Keycloak SAML and sees their section form
  2. Lead can fill items (project, text, tag, status), set traffic lights (green/yellow/red), add risks (project, risk, impact, mitigation), add decisions (text, owner, deadline, impact), set Top 3 priorities
  3. Lead can save section as draft multiple times without losing data
  4. Lead can submit entire section (status changes to "submitted"); submission is immutable until next report period
  5. Head logs in with "head" role and sees submission dashboard: list of all leads with status (submitted/draft)
  6. Unauthorized users see Keycloak login page and cannot access any report data
  7. Session persists across page refresh via JWT

**Plans:** TBD

**UI hint:** yes

---

### Phase 2: Report Assembly & Publication

**Goal:** Head can see aggregated portfolio status from all leads' traffic lights, publish final report for stakeholders, and export to PDF

**Depends on:** Phase 1

**Requirements:** PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07

**Success Criteria** (what must be TRUE):
  1. Head sees portfolio status overview that auto-aggregates traffic light colors from all leads: if any lead marked red, overview shows red; if all yellow+, shows yellow; if all green, shows green
  2. Head can view the assembled report with all sections from all leads in read-only mode before publishing
  3. Head can edit any section before publishing (modify items, risks, decisions, statuses)
  4. Head clicks "Publish" button; report becomes immutable and visible to all viewers
  5. Published report is accessible via web URL and displays all sections in formatted layout (project names, statuses, items, risks, decisions, top 3 priorities)
  6. Viewer role can view published reports but cannot edit
  7. When head clicks "Export to PDF", system returns PDF file matching current visual layout (uses BullMQ async job — no HTTP blocking)

**Plans:** TBD

**UI hint:** yes

---

### Phase 3: Automation & Admin

**Goal:** System automatically carries over pending items and unresolved decisions; sends email reminders; enables self-service admin configuration; archive is browsable

**Depends on:** Phase 1, Phase 2

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, NOTIF-01, NOTIF-02, ENTRY-08, ENTRY-09, ENTRY-10, HIST-01, HIST-02

**Success Criteria** (what must be TRUE):
  1. Head can add/remove users via admin panel and assign roles (lead/head/viewer); users login and see appropriate access level
  2. Head can create projects in admin panel and assign each to a lead; projects appear in lead's form for marking statuses
  3. Head can create new report periods with start date, end date, deadline; system prevents leads from submitting before deadline
  4. Head configures email reminder schedule (e.g., Friday 9AM, Friday 2PM); system sends emails to leads who haven't submitted by deadline
  5. When new report period opens, items marked "next period" from previous report automatically move to "current period"; unresolved decisions auto-carry; lead can mark carry-over items as completed or not-completed
  6. Email reminders are idempotent: if cron runs twice, lead gets one email (not duplicates)
  7. All published reports are browsable in history view sorted by date; user can click any past report and view it in full detail

**Plans:** TBD

**UI hint:** yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Report Capture | 0/3 | Not started | - |
| 2. Report Assembly & Publication | 0/2 | Not started | - |
| 3. Automation & Admin | 0/3 | Not started | - |

---

## Coverage Validation

**Total v1 requirements:** 29
**Mapped to phases:** 29
**Orphaned:** 0

**Mapping summary:**
- Phase 1: 11 requirements (4 AUTH + 7 ENTRY)
- Phase 2: 7 requirements (all PUB)
- Phase 3: 11 requirements (4 ADMIN + 2 NOTIF + 3 ENTRY carry-over + 2 HIST)

All requirements covered. No gaps.

---

## Rationale

**Phase ordering:**
1. **Phase 1 first:** Core capture is the foundation. Everything downstream (assembly, publication, automation) depends on data being collected and structured.
2. **Phase 2 after Phase 1:** Once data is captured, users need visibility. Portfolio overview and PDF export are the primary user value (replaces OnlyOffice workflow).
3. **Phase 3 after Phase 2:** Email reminders and carry-over logic are automation that reduce manual work. Admin panel enables self-service report period creation. These are valuable but can come after users have basic workflow working.

**Why coarse (3 phases):**
- Each phase delivers one complete, verifiable user capability
- Phase 1 is feature-complete for basic data entry
- Phase 2 adds publication and export (critical value)
- Phase 3 adds the automation that makes system "smart" vs just "a form"
- Three phases compress naturally without artificial splitting

**Why this grouping:**
- AUTH is small enough to bundle with ENTRY (they go together: login → fill form)
- PUB is cohesive: assembly, publication, and export are the "publish" capability
- ADMIN + NOTIF + HIST bundle as "operations and automation" that reduce head's manual work

---

*Roadmap created: 2026-04-06*
