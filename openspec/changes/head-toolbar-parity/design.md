# Design — Head Toolbar Parity

## Context

Surfaces surveyed 2026-06-11 (code-verified):

| Surface                                                        | Container today                                        | Arrangement today                                               |
| -------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Lead `/lead/report` (`lead-form.tsx:1463-1614`)                | `ReportToolbar` pill                                   | header row → pill toolbar → content (reference)                 |
| Head `/head/report/[id]` (`head-report-shell.tsx`)             | pill + heavy gradient bar (both)                       | toolbar → floating action row → page header → second period bar |
| Head bare `/head/report`, viewer `/reports/[id]`, lead preview | heavy gradient bar only (`weekly-report-page.tsx:350`) | header → gradient bar → content                                 |
| Head `/head/dashboard` (`dashboard-page.tsx:289`)              | none (header only)                                     | already lead-style header; no toolbar-shaped row                |

Pill toolbar controls after `defer-versions-coming-soon` (which runs
first tonight and hides `VersionHistoryNav`):

- Lead: `PeriodNavigator` (icon arrows — fine), `ArchiveToggle`
  (text pill), `FillFromButton` (text split-button), `SaveNowButton`
  (already a 32×32 icon button — the reference pattern,
  `save-now-button.tsx:13-26`).
- Head: `PeriodNavigator`, `ArchiveToggle` (same components).

## Goals / Non-Goals

**Goals:** one toolbar container component on every report surface;
lead arrangement (header row, then pill toolbar) on the head review
page; toolbar text buttons → 32px icon buttons with `aria-label` +
tooltip on both roles. Component-level parity.

**Non-Goals:** theme/palette/token changes (research-gated repo rule);
relabeling or icon-ifying header-row actions (Submit, Toggle All,
Export PDF, Publish, Present, Print); touching the dashboard beyond
the recorded survey result; reintroducing version browsing.

## Decisions

### D1 — Icon conversion applies to pill-toolbar controls only

"Toolbar controls" in the feedback means the `ReportToolbar` pill bar.
`Present`/`Print` keep visible labels: the durable
`head-toolbar-semantics` spec forbids icon-only rendering for them and
was written from this same user's earlier walk-through ("icon-only
actions nobody could decode"). Converting them would contradict a
durable contract to satisfy a stylistic one. Assumption stated; if the
user later wants header actions converted, that is a separate change
with a `head-toolbar-semantics` MODIFIED delta.

### D2 — One toolbar per page: shell wins, WRP context bar suppressed

`/head/report/[id]` currently renders two period navigators (shell
`PeriodNavigator` + WRP `HeadPeriodNavigator`) in two container
styles. Parity = ONE pill toolbar, placed below the page header like
lead. `WeeklyReportPage` gets an explicit prop (e.g.
`contextToolbar?: boolean`, default true) so `HeadReportShell` can
suppress the inner bar and remain the single toolbar owner; the
department label ("X · Live portfolio review") moves into the shell
toolbar's center slot (`leadingExtras`). Standalone consumers (bare
`/head/report`, viewer `/reports/[id]`, lead preview) keep the default
and simply get the pill container instead of the gradient bar.
Fallback if the suppression prop proves risky during implementation:
minimum viable parity is restyling the WRP bar to `ReportToolbar` and
keeping both bars — record the decision in tasks if taken.

Review fix 2026-06-11: the boolean suppression prop left the toolbar
shell-level, ABOVE the real page header (h1 "Status Report" + publish
actions) inside `WeeklyReportPage` — the spec scenario only half-held.
Replaced by a `toolbar` ReactNode slot: the shell still composes the
single `ReportToolbar`, but the page renders it below its page header
row, so the lead arrangement holds for the actual header, not just the
shell's utility action row. Slides mode (no WRP header) keeps the
shell-level toolbar.

### D3 — Shared `ToolbarIconButton` primitive, SaveNow as the spec

New `report-shell/toolbar-icon-button.tsx`: 32×32 (`h-8 w-8`)
circular button, `aria-label` + `title` (native tooltip — the
repo-wide pattern; no new Radix Tooltip dependency in the toolbar),
focus-visible ring, disabled opacity — extracted from
`SaveNowButton`'s proven styling so parity is enforced by one
component, not by copied class strings. `SaveNowButton` is refactored
to consume it (no behavior change). Size lives once in the primitive —
no magic 32s scattered across call sites.

### D4 — `ArchiveToggle` stays a switch; count stays visible

Conversion keeps `role="switch"`, `aria-checked`, the checked visual
state, and the existing aria-label/title. The `archivedCount` is data
the user acts on, so it stays visible as a compact numeric badge on
the icon button (not tooltip-only); the full wording lives in
`aria-label` + `title`. Behavior identical.

### D5 — `FillFromButton` keeps both affordances

The split-button becomes two adjacent 32px icon buttons: copy icon =
"Fill from most recent submitted period" (existing title), caret =
"Choose past report to fill from" (existing aria-label). The picker
panel, search, and confirm flow are untouched.

### D6 — Ordering dependency

Runs AFTER `defer-versions-coming-soon`. The toolbar trailing group is
designed as: Fill-from icons · separator · versions ComingSoon
placeholder (inert, compact — allowed below cluster height by the
`ui-control-density` exception) · separator · SaveNow. Do not
re-render `VersionHistoryNav`.

## Invariants (preserved / mutated / relaxed)

- `ui-control-density` — preserved: the pill-toolbar cluster shares
  one 32px height; header-row clusters keep
  `--touch-target-min` (44px); no control leaves the tab order.
- `head-toolbar-semantics` — preserved: Present/Print labeled, one
  "Publish", segmented family untouched, placeholder subordinate.
- `a11y-regression-coverage` — every converted control keeps an
  accessible name (`aria-label`) and operability.
- `lead-report-controls-integrity` — controls keep honest semantics;
  no inert lookalikes added.
- No tRPC/schema/Prisma surface touched — role-coverage-gate,
  period-dual-state, destructive-db-guard not in play.

## Risks / Trade-offs

- [Shared WRP touches viewer surfaces] the container restyle is
  visible on `/reports/[id]` and the lead preview → acceptable: that
  IS component-level parity; verify those routes render in tests.
- [Icon-only discoverability] mitigated by tooltips + aria-labels and
  by D1 keeping navigation/primary actions labeled.
- [Snapshot churn] head/weekly-report snapshots change → update
  deliberately, never blind `-u` across unrelated suites; the
  pre-existing dirty `product-accordion.test.tsx.snap` must NOT be
  staged or reverted.
- [Parallel-change collision] `save-now-pending-indicator` also
  touches the save control tonight → keep the `SaveNowButton`
  refactor (D3) purely structural; rebase order handled by the queue.
