# Design — head dashboard declutter

## Why a new capability (`head-dashboard-clarity`)

No existing spec governs the head dashboard's card composition or the per-lead
reminder gate. `ui-role-route-access` only names `/head/dashboard` as a redirect
target; `report-routing` names "dashboard" as a navigation source; neither owns
the surface's content. `report-card-clarity` is scoped to the head REPORT's
product cards, not the dashboard — stretching it onto the dashboard would muddy
a report-scoped spec. So this change opens the first durable contracts for the
head dashboard under a new `head-dashboard-clarity` capability.

The two card removals are split by spec-worthiness:

- **`Activity24hCard`** is removed because it DUPLICATES the `activity.live`
  feed `ActivityLivePanel` already renders. That is a durable contract ("the
  feed renders once"), so it gets a spec requirement, mirroring the head-slides
  "status renders once" pattern.
- **`ProductKpiCard`** is removed on VALUE grounds, not duplication. A future
  re-add could be legitimate, so no durable "MUST NOT exist" contract is
  written — the deletion lives in `tasks.md` only.

`LeadSummaryTable` D1 is a layout contract, framed behaviorally ("fits its
container; no horizontal-scroll affordance at standard dashboard width") and
verified by screenshot, not a pixel unit test.

## The D6 dual mechanism (gate vs dispatch)

The "Remind" path has two independent gates, and the demo must satisfy BOTH:

| Surface                                      | Keys off                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| UI gate `hasActiveReminderRule`              | active **ReminderPolicy** count whose validity window covers `Report.deadline` (`weekly-report.prisma-repository.ts`) |
| `reminders.dispatchPending` actually sending | an active **ReminderRule** scoped to `reportId = ACTIVE_REPORT_ID` (`trpc.router.ts`)                                 |

The `small` tier (`prisma/seed-demo.ts`) today seeds NEITHER — it only
`deleteMany`s policies and rules. The `middle` tier (`seed-simple.ts`) already
seeds both. So the fix copies that proven shape into `seed-demo.ts`: one active
`ReminderPolicy` (deadline kind, `validFrom` ≤ active deadline, no `validUntil`)
plus one active `ReminderRule` with `reportId = ACTIVE_REPORT_ID`,
`status: active`, and a deterministic `fireAt` derived from the active period
deadline. Without both, either the button stays hidden (gate false) or the
click returns `no-active-rule` (no rule).

## Determinism (preserves `seed-determinism`)

Both new rows use fixed UUIDs (literal ids, like the `seed-simple` rule ids) and
a `fireAt` computed from the existing relative-to-run-week period constants — no
`Date.now()` or random values. Reseed reproduces identical ids and timestamps.

## The submitted-lead choice (preserves locked seed requirements)

D5 flips exactly ONE active lead section to `ReportSectionStatus.submitted`.
Submission state is orthogonal to traffic-light health and to the Mine/Everyone
lens, so this MUST NOT move the three-color health mapping (Маркетинговый
портал red, Платформа интеграций yellow, Внутренний BI green) and MUST NOT
remove any foreign co-owner content. Leaving the other leads draft keeps the
period `open` (not all-submitted), so the head still sees both Revoke (on the
submitted lead) and Remind (on a draft lead) on one screen. Pick a lead whose
submission keeps the existing "fully-green showcase" and "Everyone reveals
foreign content" scenarios intact.

## Invariants touched

- **deferred-feature pattern:** unaffected — no new deferred UI; the removed
  cards are deleted, not parked.
- **period dual-state / role-coverage gate:** unaffected — no Report write-path
  or tRPC procedure signature changes; only seed data and a prop thread.
- **destructive-db guard:** unaffected — seed runs under the existing non-prod
  reset path.
