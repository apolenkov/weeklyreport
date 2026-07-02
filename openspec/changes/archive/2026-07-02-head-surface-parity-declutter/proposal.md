## Why

> Captured from 2026-06-30 in-app annotations (cluster C7), grilled + adversarially
> verified. See `docs/feedback/decisions-locked-2026-06-30.md` and
> `docs/feedback/annotations-triage-2026-06-30.md`.

The head surfaces (slides, dashboard, report toolbar) drifted from the lead layout and
carry non-signal chrome. The stakeholder asked to mirror the lead idiom and shed clutter.

## What Changes

- **Slides declutter + parity:** remove the redundant "Group Status Slides" header line;
  move the slide toolbar controls to the top like the lead deck (positional parity);
  clarify or cut the `ReadinessStrip`; move the Agent-review control into the
  period-navigation row. The carousel placement stays (confirmed good).
- **Dashboard declutter:** slim the `ProductKpiCard` to a compact single-row strip
  (Submissions / Deadline / Risks & Blockers) — keep the signal, shed the space; fix the
  `LeadSummaryTable` style/unexpected-scroll; trim the low-value `Activity24hCard`; verify
  `BlockedAtRiskTable` state correctness.
- **Report toolbar parity:** place publish / request-all-reopen / Agent-review / Edit like
  the lead's status row (top-left of the logo); remove the "Present" button (slides mode
  supersedes it).
- **ScopeToggle:** NO change — the "share one idiom lead+head" goal is already met by the
  shared `SegmentedToggle`; a literal pill-border restyle would reverse a shipped decision.
- **Positional stability across Edit↔Slides** (the `mqqe419t`/`mqqe3llq` reflow/duplicate):
  **verify on a fresh build first**; if it persists it becomes a whole-header
  positional-stability requirement (homed where header composition is governed).

## Capabilities

### New Capabilities

- `head-surface-parity`: the head slides/dashboard/toolbar declutter + lead-parity rules.

### Modified Capabilities

- (Implementation MODIFIED follow-ups in `design.md` with exact headers: `report-toolbar-parity`,
  `head-toolbar-semantics`, `head-slide-density`, `head-dashboard-clarity`, `toolbar-polish`.)

## Impact

- Web only — head slides/dashboard/toolbar composition + density. No write path, no
  schema, no new procedure.
- `ProductKpiCard` is slimmed, NOT deleted (a single soft "maybe remove" — keep the
  signal). `ScopeToggle` is unchanged.
- `BlockedAtRiskTable` correctness ties to the escalation/`at_risk` flagged-red roll-up —
  verify, don't redesign.
- Out of scope: a literal ScopeToggle restyle; deleting `ProductKpiCard`; any new data
  surface. The reflow requirement is conditional on the fresh-build verify.
