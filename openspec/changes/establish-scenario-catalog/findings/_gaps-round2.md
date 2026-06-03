# SC-3 round 2 — final convergence gap-critic

<!--
  Round 2 of the loop-until-dry gap-critic. Reviews the WHOLE catalog as it
  stands after the round-1 gap-fill pass (API tier + new UX tier). Reports
  ONLY findings NOT already in _gaps.md / _ux-findings.md.

  Date: 2026-06-03, branch main. Reachability confirmed via grep + codegraph.
-->

## Verdict: MORE-WORK

Two new genuine gaps (one dead enum value, one whole-tier coverage hole),
one new uncovered-enum gap, plus two scoping/framing observations that are
NOT new gaps. Entry-point parity and machine-checkability both CONVERGED.

| Axis                                             | Result                          |
| ------------------------------------------------ | ------------------------------- |
| 1. Entry-point parity (uncataloged entry points) | **0 new** — CONVERGED           |
| 2. Enum-state parity (uncovered/dead values)     | **2 new** (1 dead, 1 uncovered) |
| 3. UX/API linkage holes                          | **1 new** (`/admin` tier)       |
| 4. Machine-checkability violations               | **0** — CONVERGED               |

---

## Axis 1 — Entry-point parity: CONVERGED (0 new)

Re-derived the full entry-point surface independently and matched it against
every `*.feature` file.

- **tRPC:** 85 real procedures in `trpc.router.ts` (the `_entry-points.md`
  count of "86" includes one false positive — line 1355 `procedure: row.procedure,`
  is a field in the `admin.actionLog.list` output object, not a procedure
  declaration). All 85 namespaced procedures (`namespace.procedure`) appear by
  full namespaced name in the catalog. Zero uncataloged.
- **REST (4 endpoints / 3 controllers):** health (`live`/`ready`), metrics,
  web-vitals — all in `system-entry-points.feature`.
- **BullMQ workers (3):** EmailReminderProcessor, PdfExportProcessor,
  TelegramProcessor — all cataloged.
- **Cron (4):** auto-publisher, auto-archiver, period-creator,
  reminders.scheduler — all cataloged.
- **Next routes (2):** client-logs, revalidate-org — both cataloged.

No entry point is worse than `covered: none`. The SC-6 drift gate would PASS on
existence. (The `covered: none` subset remains the round-1 §6 automation
backlog; unchanged here.)

---

## Axis 2 — Enum-state parity: 2 new findings

Checked all 17 enums / every value against both tiers, excluding the four
round-1-handled values (CarryOverStatus.failed, ReminderRuleStatus.paused,
ItemWorkflowStatus.done, ItemWorkflowStatus.in_progress).

### 2.1 NEW — `PdfExportStatus.processing` is DEAD (never written)

- **Enum:** `pending | processing | completed | failed`.
- **Code reality:** PdfExport carries a domain↔db status mapper
  (`pdf-export.prisma-repository.ts:18-32`) that declares `processing` in both
  directions, but **no production path ever writes it.**
  `pdf-export.service.ts` writes only `"queued"` (→db `pending`, line 151) and
  `"completed"` (line 208); the repository writes `"failed"` (line 106). The
  BullMQ processor (`pdf-export.processor.ts`) calls only `markExportFailed`
  and `markExportCompleted` — there is no `markProcessing` / intermediate
  transition. Grep for a `"processing"` write outside the mapper returns
  nothing.
- **Catalog state:** `processing` has zero occurrences in any feature file in
  any phrasing.
- **Frame:** same class as round-1 §4 (dead enum value, declared-but-never-
  written), but NOT listed there — round 1 marked PdfExportJob as "clean
  writer+reader coverage" without auditing the per-value write set. Dead value;
  no scenario should assert it (and the catalog correctly never does), but it
  belongs in the dead-enum ledger alongside CarryOverStatus.failed.

### 2.2 NEW — `WorkingDays.MON_FRI / MON_SAT / MON_SUN`: live but un-mentioned

- **Enum:** `MON_FRI | MON_SAT | MON_SUN` (wire form `mon-fri | mon-sat | mon-sun`).
- **Writer in code (live):** `admin.savePeriod` / `admin.saveProject` /
  `admin.updateSettings` persist `settings.workingDays` through the
  `workingDaysToPrisma` mapper (`admin.prisma-repository.ts:63-70,185`).
- **Reader in code (live, behavior-affecting):** `business-date.ts::computeDeadline`
  consumes the value through `workingDaySet` → `isBusinessDay`/`addBusinessDays`.
  Both call sites pass the **stored** `settings.workingDays`, NOT a constant:
  `period-admin.service.ts:248-254` (`admin.createPeriodManual` entry point)
  and `period-creator.scheduler.ts:111-117` (the daily period-creator cron).
  So MON_SAT/MON_SUN genuinely change the computed deadline in v1.
- **Catalog state:** ZERO occurrences of `MON_FRI`/`MON_SAT`/`MON_SUN` or the
  wire forms `mon-fri`/`mon-sat`/`mon-sun`, or `workingDays`, or "business day",
  in EITHER tier. The `admin.savePeriod` scenarios (admin.feature:556-567)
  assert periodStart/End/deadline/status but never the `workingDays` field; no
  scenario asserts a non-Mon-Fri deadline.
- **Relation to round 1:** round 1's Notes adjudicated WorkingDays as "live,
  not dead" — but only on the writer/reader-**existence** axis. It did not check
  value-mention coverage, and it repeated the schema's stale comment "v1 does
  not change deadline calc." That comment is wrong: the wired value IS consumed
  by `computeDeadline`. This is therefore a genuine NEW uncovered-enum gap
  (three live values, deadline-affecting, zero catalog presence), not a repeat.
- **Suggested fill:** one scenario per non-default value asserting that
  `computeDeadline(start, deadlineDays, mon-sat|mon-sun, tz, hour)` skips the
  expected non-working days (the natural unit is `business-date.ts`, which has
  no catalog scenario at all).

### Non-findings on this axis (verified, no new gap)

- `ReminderAudience.LEAD_WITH_DRAFT` IS covered via its wire alias
  `lead-with-draft` (review-reminders.feature:428). Not a gap.
- All other enum values across the 17 enums are present in at least one tier.

---

## Axis 3 — UX/API linkage holes: 1 new finding

### 3.1 NEW — entire `/admin` route tree has NO UX-tier coverage

- **Code reality:** `apps/web/src/app/(app)/admin/` exists with three pages —
  `admin` (page.tsx), `admin/products`, `admin/settings`. The landing page
  routes admins there (ui-print-landing.feature:90 "Enter Application for admin
  role links to /admin").
- **Catalog state:** the Playwright UX capture covered 17 routes
  (`_ux-matrix.md`) — and `/admin`, `/admin/products`, `/admin/settings` are
  **not among them.** No `ui-*.feature` scenario visits or asserts any admin
  page content; grep for "/admin and sees", "navigates to /admin", "Admin page"
  in `ui-*.feature` returns nothing.
- **Linkage hole:** all 37 `admin.*` mutating procedures (saveUser,
  saveReportingGroup, saveProject, savePeriod, savePolicy, saveReminderRule,
  updateSettings, updateOrganization, the delete/(de)activate family, stage-
  assignment + group-product CRUD, reopen-request responses, …) have a UI
  surface under `/admin/*` with **zero** UX-tier scenarios. The API tier covers
  the procedures; the UX tier never reaches the page that drives them. This is
  one-sided coverage, distinct from `_ux-findings.md` (which only classifies
  ROUTE-ACCESS for the 17 captured routes — it never visits the admin tree).
- **Suggested fill:** extend the Playwright capture to `/admin`,
  `/admin/products`, `/admin/settings` (4 roles × 3 routes) and add a
  `ui-admin.feature` mirroring the structural/authz pattern of the other UX
  files.

### Scoping observation (NOT a gap) — UX tier drives no mutations

Every `When` step in all four `ui-*.feature` files is a navigation
(`navigates to <route>` / `is on <route>`); none clicks, submits, or otherwise
drives a mutation. Mutating controls (Publish & Lock, Revoke All, Request
Reopen, Fill / Fill-from-past, Sign out) are asserted only as
present/enabled/disabled, never exercised through the UI.

This is NOT a linkage hole for those controls: their presence is asserted at
the UX tier AND their procedure is tested at the API tier (publish, submit,
saveDraft, requestReopen, revokeAllSubmitted) — intact coverage split across
tiers. Driving click-through mutations is not a stated catalog requirement
(`_ux-findings.md` frames the UX tier as a role×route structural/authz capture).
Recorded as a deliberate scope boundary, not a defect — the genuine one-sided
hole is `/admin` (§3.1), which the UX tier never even visits.

### Companion observation (NOT a gap) — `HEAD_OF_LATE` audience string

`ReminderAudience.HEAD_OF_LATE` (wire `head-of-late`) has zero literal catalog
mentions, while its sibling `lead-with-draft` is named. But the underlying
behavior — escalation digest to the head — IS covered
(review-reminders.feature:379-392, system-entry-points.feature:132-135). Only
the literal audience value-string is unnamed. This is exactly round 1's
`follow_up` treatment (notes-item / soft coverage gap, behavior covered, value-
string absent), so it is recorded parallel to that, not as a new hard gap.

---

## Axis 4 — Machine-checkability: CONVERGED (0 violations)

Spot-checked ~20 `Then` steps across ui-head, ui-reports, analytics-read,
lead-form, misc, system-entry-points. All are machine-checkable: exact URLs,
response shapes (`{ periods: [], rows: [] }`), error classes
(`UNAUTHORIZED`, `LeadFormDomainError` with verbatim message), exact enqueue
payloads, ARIA accessible names, heading text/levels. A scan for vague
adverbs (`correctly`, `properly`, `appropriately`, `as expected`, `gracefully`,
`nicely`, `intuitive`, …) across all feature files returned zero hits. No
violators.

One value-vocabulary note (not a violation): misc.feature:45/69 assert
PdfExportJob `status = "queued"` — `queued` is the DOMAIN status (mapped to db
`pending`), so the assertion is correct against the domain model, not a drift.

---

## Bottom line

- NEW uncataloged entry points: **0** (CONVERGED).
- NEW uncovered/dead enum states: **2** — `PdfExportStatus.processing` (dead,
  add to dead-enum ledger) and `WorkingDays.{MON_FRI,MON_SAT,MON_SUN}` (live,
  deadline-affecting, zero catalog presence → real fill target).
- NEW UX/API linkage holes: **1** — the `/admin` route tree (3 pages, 37
  admin.\* mutations) has zero UX-tier coverage.
- Machine-checkability violations: **0** (CONVERGED).

Verdict: **MORE-WORK** (carried by `/admin` UX coverage + WorkingDays values;
`PdfExportStatus.processing` is ledger-only).
