# Head dashboard: declutter + make the demo affordances live

## Problem

The live walk-through of `/head/dashboard` (2026-06-23) found the surface
cluttered and two of its controls dead in the demo:

- `ProductKpiCard` adds a second, divergent set of KPIs below the real
  `KpiCards` — the head reads it as noise, not value.
- `Activity24hCard` re-renders the exact same `activity.live` feed that
  `ActivityLivePanel` already shows at the top — pure duplication.
- The `LeadSummaryTable` ("Period Summary") table is ~14px wider than its
  `overflow-x-auto` wrapper, so a phantom horizontal scrollbar appears; its
  square rules also clash with the rounded card idiom of the other cards.
- Every demo lead is In-progress, so the head can never see the "send back"
  (Revoke) affordance the table is meant to demonstrate.
- The demo seeds no active reminder rule, so the per-lead `RemindLeadButton`
  posts `reminders.dispatchPending` and gets `{dispatched:0,
reason:"no-active-rule"}` — a dead button that still flashes "Retry". The
  `AlertBar` already hides Remind when `!hasActiveReminderRule`; the table
  ignores that gate and offers the dead action.

User direction (live demo 2026-06-23, "ЗАФИКСИРОВАННЫЕ РЕШЕНИЯ"): remove the
two cards, fix the table, and make the demo exercise Revoke + Remind for real.
See `docs/demo-feedback-2026-06-23-head-surfaces.md` (Change 1).

## Solution

1. **Delete `ProductKpiCard` and `Activity24hCard`** (components + their tests),
   and unmount both from `dashboard-page.tsx`. `ActivityLivePanel` stays as the
   single owner of the `activity.live` feed. **recharts stays a dependency** —
   it is still used by `reports/trends` (`lead-velocity.chart.tsx`,
   `traffic-light-history.chart.tsx`) and the `@customreport/ui` chart
   component, so its package entries are NOT removed (verified by grep).
2. **Fit the `LeadSummaryTable` to its container** so no horizontal-scroll
   affordance appears at standard dashboard width, and bring its rows into the
   rounded card idiom of the other dashboard cards.
3. **Seed one lead `submitted`** in the small tier so the head sees and can
   exercise the existing per-lead Revoke / Revoke All flow (form → Draft),
   without changing the period's open status or any product's health color.
4. **Seed one active reminder rule** (policy + report-scoped rule, like the
   `middle` tier already does) so a Remind click dispatches an email, AND gate
   the table's `RemindLeadButton` by `hasActiveReminderRule` (the same
   `canSendReminder` gate `AlertBar` already honors) so it never offers a dead
   action.

## Non-goals

- Building real Agent-review or any new KPI surface — the two cards are removed
  on value/duplication grounds, not parked behind a flag.
- Removing the `telemetry.summary` tRPC procedure or the `recharts` dependency.
- The head slides parity work and the flagged-red dedup bug — those land in the
  sibling changes `head-slides-lead-parity` and `fix-flagged-red-escalation-dedup`.
- The `ProductAccordion` redesign — separate research-track change.

## Source

Live demo feedback, 2026-06-23 (`docs/demo-feedback-2026-06-23-head-surfaces.md`,
Change 1 — head-dashboard-declutter; decisions locked).

## Activation trigger

(Active — user-directed declutter of a confusing live surface.)
