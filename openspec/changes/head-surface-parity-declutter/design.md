# Design — head-surface-parity-declutter

MVP. Captured from the 2026-06-30 demo (cluster C7). **Re-verified against the live
component source on 2026-06-30** (read-only; safe — the parallel session's uncommitted
edits are in `apps/api/.../admin/*`, not the web slide/toolbar/dashboard components).

## Finding: most C7 premises are already shipped + specced (likely a stale-build demo)

The demo ran against the docker `web` image, which serves a STALE built bundle (memory:
`close-slides-visibility-tails`, `dev-uat-role-login-and-stale-tells`). Reading the
current source shows most of C7's declutter asks are already done and already specced:

| C7 premise                                  | Live state          | Evidence (test + spec)                                                                                                                                          |
| ------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove "Group Status Slides" heading        | **already removed** | `status-slide-deck.test.tsx:545` asserts absent; `head-slide-density` "renders no standalone heading band"                                                      |
| Clarify/cut `ReadinessStrip`                | **already removed** | `status-slide-deck.test.tsx:514` "renders no in-slide readiness strip"; `head-slide-density:18-20`                                                              |
| Trim `Activity24hCard`                      | **already removed** | `dashboard-page.test.tsx:171` "the duplicate Activity24hCard was removed"; `head-dashboard-clarity:13`                                                          |
| Remove "Present" button                     | **already removed** | `head-report-shell.test.tsx:284` "Present + browser-Print header links are removed entirely"                                                                    |
| `LeadSummaryTable` horizontal scroll        | **already specced** | `head-dashboard-clarity` "The Period Summary table fits its container without horizontal scroll"                                                                |
| `ScopeToggle` unchanged                     | **confirmed no-op** | shared `SegmentedToggle` already unifies lead+head (decisions-locked)                                                                                           |
| Controls at the top / document-action split | **largely shipped** | `head-report-shell` has "Context controls" + "Document actions" groups, single Export-PDF as a document action — verify top placement visually on a fresh build |

**Consequence for this change:** the `head-surface-parity` ADDED spec re-states behavior
that is already shipped. It should be re-framed (at Саша's call) from "introduce" to
"verify shipped / lock the contract", or its moot requirements dropped. Do NOT implement
it as new work without confirming against a fresh (non-docker) build first.

## Spec-debt flag (pre-existing — flag, do NOT fix as part of C7)

"Present" is removed from the head header in code, but two durable specs still mandate it
as a labeled action: `head-toolbar-semantics` ("their icon (\"Present\", \"Print\")…
icon-only rendering is not allowed for actions that navigate to a distinct surface") and
`report-toolbar-parity` ("actions that durable specs require labeled (`Present`, `Print`,
`Publish`)"). These are stale relative to the shipped code. This is pre-existing spec
debt outside C7's diff — record it as a separate cleanup, do not fold it into C7 (global
rule: flag pre-existing errors, don't fix outside your own change). The `/present` ROUTE
still exists; only the header LINK was removed.

## Two genuine open items — they REVERSE shipped + specced behavior, so they need Саша

Per memory `live-feedback-vs-documented-decisions` and `three-changes-impl`, a live-demo
ask that reverses a documented/shipped decision must be confirmed before it is enshrined.

1. **Agent-review placement.** C7's demo ask was "move Agent-review into the
   period-navigation row." But the shipped + specced state is the opposite: Agent-review
   is the FIRST element of the toolbar "Context controls" group (leading edge, before the
   toggles) — `head-report-shell.test.tsx` "places the agent-review placeholder before the
   toggles", `head-toolbar-semantics` Req3, and it is mounted exactly once
   (`deferred-feature-pattern` "render exactly once on every on-screen surface";
   `status-slide-deck.test.tsx:524` "relocated to the toolbar context row"). Moving it to
   the period-nav row reverses all three. **Needs Саша** before any MODIFIED delta.
2. **KPI card slim.** This one IS live net-new: `kpi-cards.tsx` is currently three tall
   cards (p-5, a 56px conic-gradient ring, 32px deadline numeral), not the "compact
   single-row strip" C7 describes. Note: it currently renders `KpiData` from
   `./mock-data` — confirm it is wired to real data before investing. The slim is a
   density change that `responsive-compact-layout`'s "A Compact Density Baseline Applies
   at All Tiers Without Dropping Signals" already covers in principle — so the cleanest
   home may be C5, not a separate C7 delta. **Needs Саша** (scope: fold into C5 / keep
   standalone / drop).

## Disposition

- No cross-capability MODIFIED deltas authored for C7: every existing-spec touch is either
  already shipped+specced (moot), pre-existing spec-debt (flag-not-fix), or one of the two
  reversal items pending Саша. There is no requirement that becomes contradictory from a
  net-new C7 behavior that is also locked — so nothing to author yet.
- Re-scope the `head-surface-parity` spec after Саша answers the two items above.
