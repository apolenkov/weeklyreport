# Head Toolbar Parity with the Lead Report Shell

## Why

User feedback (2026-06-10): the lead report toolbar — the rounded pill
bar in `report-toolbar.tsx` (`border border-[rgba(0,0,0,0.08)]
bg-[var(--color-surface-hover)]/70 px-2 py-1.5 rounded-[var(--radius)]`)
— and the lead form header row are the desired style for HEAD pages
too. Survey of head surfaces shows the drift:

- `/head/report/[id]` (review) stacks TWO period bars in two different
  container styles: the shell's `ReportToolbar` pill AND
  `weekly-report-page.tsx:350` "Context shell" (heavy `rounded-2xl`
  gradient + shadow, its own `HeadPeriodNavigator`). The arrangement is
  inverted vs lead: toolbar above the page header, plus a floating
  uncontained action row between them.
- Bare `/head/report` and viewer `/reports/[reportId]` render only the
  heavy gradient bar — no pill style at all.
- `/head/dashboard` already matches the lead header-row arrangement;
  no toolbar-shaped row exists there (survey result, no change).

Second part of the feedback: toolbar text buttons become compact 32px
icon buttons with `aria-label` + tooltip, consistently on BOTH lead and
head toolbars, behavior identical. `SaveNowButton` (32×32 circle,
aria-label + title) is the existing reference pattern.

## What Changes

1. Unify the period-context container: `weekly-report-page.tsx`
   replaces its bespoke gradient "Context shell" with the shared
   `ReportToolbar` component (component-level parity; all consumers —
   head, viewer, lead preview — inherit it).
2. Fix the review-page arrangement to the lead order — page header row
   first, ONE pill toolbar below it — and remove the duplicated period
   bar on `/head/report/[id]` (design D2).
3. Convert text buttons inside the pill toolbar to 32px icon buttons
   with `aria-label` + tooltip via a shared `ToolbarIconButton`
   primitive: `ArchiveToggle` (lead + head) and the `FillFromButton`
   triggers (lead). Identical behavior, roles, and state semantics.
4. Tests pinned to the new contract; snapshots updated deliberately.

**Non-goals:** no theme/rebrand/token work (research-gated); `Present`
/ `Print` / `Export PDF` / `Publish` keep visible text labels
(`head-toolbar-semantics` durable spec); lead header-row buttons
(Toggle All, Submit) stay text; no version-nav reintroduction — this
runs AFTER `defer-versions-coming-soon`, the toolbar is designed
around the remaining controls.

## Capabilities

### New Capabilities

- `report-toolbar-parity`: lead and head report surfaces share one
  toolbar container component; compact toolbar icon buttons carry
  `aria-label` + tooltip and one shared 32px size.

### Modified Capabilities

<!-- none: head-toolbar-semantics and ui-control-density are preserved,
not modified — see design.md "Invariants" -->

## Impact

- `apps/web/src/components/report-shell/` — `report-toolbar.tsx`
  (unchanged container, new consumers), new `toolbar-icon-button.tsx`,
  `archive-toggle.tsx`.
- `apps/web/src/components/lead/fill-from-button.tsx`.
- `apps/web/src/components/weekly-report/weekly-report-page.tsx`.
- `apps/web/src/components/head/head-report-shell.tsx`.
- Tests: `archive-toggle.test.tsx`, `fill-from-button.test.tsx`,
  `report-toolbar.test.tsx`, `weekly-report-page.test.tsx`, affected
  snapshots.
