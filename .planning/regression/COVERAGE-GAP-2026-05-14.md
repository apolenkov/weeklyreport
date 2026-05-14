# Coverage Gap Report — 2026-05-14

Branch: `fix/PRJ-2/uat-v7-2026-05-12`
Source sessions: `bba7038f` (120 MB) + `32223757` (806 KB) + all others scanned in cross-session inventory 2026-05-13.
Existing coverage sources: `apps/web/e2e/regression/*`, `apps/web/e2e/integration/*`, `apps/web/e2e/*.spec.ts`, and targeted component tests.

---

## 1. Bugs reported by user across sessions

### Area: Admin

| ID      | Bug description                                               | Status                           |
| ------- | ------------------------------------------------------------- | -------------------------------- |
| B1      | GroupProduct constraint — product belonged to multiple groups | fixed (4a444be)                  |
| B2      | attachProductToGroup — not atomic, cache not invalidated      | fixed (4a444be)                  |
| B3      | Users tab — no Active/Inactive/All status filter              | fixed (4a444be)                  |
| B4      | Groups tab — no archive filter                                | fixed (4a444be)                  |
| B5      | Products tab — no local search                                | fixed (4a444be)                  |
| B9      | Products leads picker — deactivated users shown               | fixed (4a444be)                  |
| A3      | Admin filters — no unified quick-filter                       | fixed (00dabff)                  |
| UFB-011 | Head/lead layout top spacing missing                          | **open**                         |
| UFB-024 | SC-16-02 still reports BLOCKED instead of SKIPPED             | fixed (`phase16-17-uat.spec.ts`) |
| UFB-032 | Background/surface tokens — flat colors                       | **open**                         |

### Area: Lead form

| ID         | Bug description                                          | Status                                        |
| ---------- | -------------------------------------------------------- | --------------------------------------------- |
| A13/A15    | form-race useEffect reset + stale deps                   | fixed (c60ccc2)                               |
| A17        | Decision modal FAB overlap on mobile                     | fixed (f433d0a)                               |
| A20        | Global flicker/re-mount without skeleton                 | partial (f433d0a)                             |
| D-11       | Lead report page: no green gradient background           | fixed (0371223)                               |
| D-12       | Item-edit-dialog: status pill state reset on open        | **open** (reverted — react-compiler conflict) |
| D-13       | StageMultiSelect: chips reset incorrectly on edit        | fixed (e537866)                               |
| D-14       | DecisionEditDialog: label alignment off                  | fixed (e537866)                               |
| D-15       | Risks: "All stages" pill shown even when stages filtered | fixed (e537866)                               |
| D-20       | VersionHistoryNav prev/next — no callback fired          | fixed (9fc8a50)                               |
| D-21       | Submit with no priorities: raw Zod error, no toast       | fixed (9fc8a50)                               |
| UFB-014    | SDLC stage multi-select on items/risks/decisions         | **open**                                      |
| LEAD-W1-02 | No Toggle All button                                     | fixed                                         |
| LEAD-W1-09 | No "Add item to …" buttons                               | fixed                                         |
| LEAD-W1-15 | No + Add Priority button                                 | fixed                                         |
| LEAD-W1-18 | Horizontal overflow 392/390                              | fixed (D-18)                                  |

### Area: Head / Dashboard

| ID    | Bug description                                             | Status                               |
| ----- | ----------------------------------------------------------- | ------------------------------------ |
| UAT-2 | Dashboard: missing Submissions 4/6, Blocked & At Risk panel | fixed                                |
| UAT-8 | /reports/trends returns 404                                 | fixed                                |
| A12   | Head scope leak — sees ALL leads, not own group             | fixed (A36 seed)                     |
| A33   | Head dashboard cross-role data confusion                    | fixed (A36)                          |
| D-32  | ActivityLivePanel — DEV_SESSION missing reportingGroupId    | fixed (9fc8a50)                      |
| D-29  | Head KPI metrics — not designed yet                         | **open** (Wave F research memo only) |
| D-34  | Viewer vs Head semantics — not defined yet                  | **open** (Wave F research memo only) |

### Area: Auth / Navigation

| ID      | Bug description                                                      | Status          |
| ------- | -------------------------------------------------------------------- | --------------- |
| UFB-004 | No-cookie protected pages hang on skeleton instead of redirect       | fixed           |
| D-18    | Context strip (org/name/role) visible on mobile                      | fixed (0371223) |
| D-7     | Reminders tab: no Coming Soon badge when no policies                 | fixed (e537866) |
| D-9     | Settings tab: CI Integration — no Coming Soon label                  | fixed (e537866) |
| D-25    | Lead history sidebar: no Coming Soon badge                           | fixed (e537866) |
| D-30    | Activity panel draft rows: navigable links (should be non-clickable) | fixed (e537866) |

### Area: Reports / Periods

| ID                 | Bug description                                          | Status                                      |
| ------------------ | -------------------------------------------------------- | ------------------------------------------- |
| A24                | Two duplicate open periods with same dates               | fixed (27ece23 — UNIQUE INDEX)              |
| A21                | Duplicate Week 20 draft cards in report list             | fixed (27ece23)                             |
| A25                | Period status badge showing "openreopened"               | fixed (24e51b9)                             |
| UAT-5              | Send Reminder: MailHog empty after click, no error toast | fixed (`alert-bar.test.tsx` E-04)           |
| E-08               | Report archive: Prev arrow still enabled on first page   | fixed (`dashboard-advanced.spec.ts` SC-176) |
| UAT-7 / LEAD-W1-18 | Horizontal scroll on mobile 390px viewport               | fixed                                       |
| D-6                | Archive snapshots policy — behavior undefined            | **open** (research memo only)               |
| D-8                | Period any-day UX — not implemented                      | **open** (research memo only)               |
| D-17               | Period navigator display improvement                     | **open** (research memo only)               |

### Area: PDF / Jobs

| ID     | Bug description                            | Status                         |
| ------ | ------------------------------------------ | ------------------------------ |
| UAT-13 | No PdfExportJob row after PDF export click | fixed (integration test added) |

### Area: Hardening / Infra

| ID  | Bug description                                | Status                          |
| --- | ---------------------------------------------- | ------------------------------- |
| H-1 | Destructive guard: `postgres` host not blocked | fixed (5a815d9)                 |
| H-2 | `revalidate-org` route: no CSRF Origin check   | fixed (5a815d9)                 |
| H-3 | A24 migration: hardcoded seed UUID in DELETE   | fixed (5a815d9 — generic dedup) |
| A7  | db:reset:hard does not clean ActionLog         | fixed (de869d5)                 |
| A31 | wipe-manual-uat does not clean Report Archive  | fixed (77bb925)                 |

---

## 2. Currently covered in regression specs

```
apps/web/e2e/regression/
  agent-a-auth.spec.ts          AUTH + landing + archive (DASH-001..035, REV-*)
  agent-a-archive.spec.ts       archive route
  agent-a-landing.spec.ts       landing page
  agent-b-admin-users.spec.ts   ADM-010..020 (users CRUD)
  agent-b-admin-products.spec.ts ADM-040..050 (products)
  agent-b-admin-jobs.spec.ts    ADM-130..140 (jobs tab)
  agent-b-lead-items.spec.ts    LEAD-040..050 (items editor)
  agent-b-lead-priorities.spec.ts LEAD-080..092 (priorities)
  agent-b-lead-risks.spec.ts    LEAD-060..065 (risks)
  agent-b-lead-render.spec.ts   LEAD-001..030 (form render)
  agent-b-lead-submit.spec.ts   lead submit flow
  admin-groups.spec.ts          group create + user assign + action log
  admin-stage-reassignment.spec.ts product/stage assignee replace

apps/web/e2e/
  regression-uat-v7.spec.ts     D-7/9/11/13/18/20/21/25/27/30/32/35/36 (12 specs)
  lead-form-crud.spec.ts        S1..S8 (stage popover, items, risks, decisions, priorities)
  integration/lead-journey.integration.spec.ts  lead submit + head publish lifecycle
  integration/head-journey.integration.spec.ts  head publish/reopen/portfolio
  integration/pdf-export.integration.spec.ts    PDF enqueue + artifact URL
  integration/auth-guard.integration.spec.ts    unauthed redirect
  period-features.spec.ts       E2E-06/07/08 (period nav, fill from, version history)
  cross-role-lifecycle.spec.ts  SC-39..46 cross-role access
  dashboard-advanced.spec.ts    SC-176 archive pagination

apps/web/src/components/dashboard/
  alert-bar.test.tsx            E-04 dispatch failure -> visible error toast
```

---

## 3. GAP: reported bugs with no corresponding regression test

| Priority | Bug ID  | Description                                                           | Missing test                        | Recommended file                                                            |
| -------- | ------- | --------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| **P0**   | D-12    | Item-edit-dialog: status pill does not reset on re-open               | Test reverted; bug unresolved       | `apps/web/e2e/regression/agent-b-lead-items.spec.ts` — add re-open scenario |
| **P1**   | UFB-011 | Head/lead layout: content overlaps header (top spacing)               | No bounding-box assertion           | `apps/web/e2e/regression-uat-v7.spec.ts` — add getBoundingClientRect check  |
| **P1**   | UFB-014 | Stage multi-select on items/risks/decisions not implemented           | No test (feature not built)         | Blocked — feature needed first                                              |
| **P1**   | D-6     | Archive snapshots: policy undefined (snapshot on submit? on publish?) | No test; behavior not spec'd        | Blocked — design decision needed                                            |
| **P1**   | D-8     | Period any-day UX                                                     | No test; feature not built          | Blocked — design decision needed                                            |
| **P1**   | D-16    | Priority chip: stage color + first-letter (research done, not built)  | No test                             | Blocked — implementation needed first                                       |
| **P1**   | D-17    | Period navigator display improvement                                  | No test                             | Blocked — implementation needed first                                       |
| **P2**   | UFB-032 | Surface/background token regression                                   | No visual regression for background | `apps/web/e2e/visual/` — visual diff after design pass                      |
| **P2**   | D-29    | Head dashboard KPI metrics (research done, not built)                 | No test                             | Blocked — feature needed first                                              |
| **P2**   | D-34    | Viewer vs head role semantics                                         | No test                             | Blocked — spec decision needed                                              |
| **P2**   | A35     | Director role UAT                                                     | Explicitly deferred                 | Next UAT cycle                                                              |

---

## 4. Recommendations — highest-priority actionable gaps

Resume update 2026-05-14:

1. **E-04 reminder silent failure** — covered by `apps/web/src/components/dashboard/alert-bar.test.tsx`: dispatch mutation failure now asserts `toast.error` with the backend error message.

2. **E-08 archive pagination prev-boundary** — already covered by `apps/web/e2e/dashboard-advanced.spec.ts` SC-176: `Previous page` is disabled on page 1 and enabled after moving to page 2.

3. **UFB-024 SC-16-02 status fix** — already covered by `apps/web/e2e/regression/phase16-17-uat.spec.ts`: no theme controls produces `SKIPPED`, not `BLOCKED`.

Seven gaps are blocked on feature/design decisions (UFB-014, D-6, D-8, D-16, D-17, D-29, D-34) — defer to the phase where the feature lands.

One gap (D-12 item-edit-dialog status pill reset) needs a different implementation approach before a test can be written — the react-compiler-safe fix is not yet designed.
