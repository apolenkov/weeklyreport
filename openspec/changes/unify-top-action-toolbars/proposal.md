# Unify the Top Action Toolbars Across Report Surfaces (2026-06-14)

## Why

Live-walk feedback (Agentation, `/head/report/<id>`, 2026-06-14): the top
**action-button row** on the head report does not read as part of the toolbar
redesign. The user generalized it — "especially the top panels with buttons" —
so this is a cross-surface consistency gap, not a one-page fix.

What is actually inconsistent (verified in source):

1. The head report action row (`head/head-report-shell.tsx:145`) is a **bare**
   `flex flex-wrap items-center justify-end gap-x-5 gap-y-2` — its controls
   (ScopeToggle, ViewModeToggle, Present, Print, AgentReviewComingSoon) float on
   the page. The lead report toolbar (`report-shell/report-toolbar.tsx`) wraps
   its controls in a **unified pill container**
   (`border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5 rounded-[var(--radius)]`).
   Same controls, different framing.
2. The in-flight `polish-lead-toolbar-and-risk-dialog` change is moving the lead
   toolbar controls toward a 32×32 icon-button idiom (1.1 inert archive
   indicator, 1.2 rounded coming-soon). Head will diverge again once that lands
   unless the same idiom is ported here.

This is the "head-toolbar-parity, round 2": that archived change ported the
**ReportToolbar pill** (period navigator + archive toggle) to head, but left the
**action-button header row** (Edit / Slides / Present / Print / scope) in the
bare-flex form.

3. **Viewer is outright broken** ("viewer полетел", 2026-06-14): the published
   viewer (`app/(app)/reports/[reportId]/page.tsx`) renders its OWN
   `<h1>Status Report</h1>` + Report-ID + a bare action row, then mounts
   `WeeklyReportPage` which renders its own "Status Report · Live · N/N" header —
   so the title appears TWICE. The head shell avoids this by feeding actions into
   `WeeklyReportPage`'s `toolbar` slot and suppressing the inner context bar; the
   viewer never got that treatment. This is a bug, not just inconsistency — task
   2.0, highest priority in this change.

## What Changes (DESIGN draft — implement AFTER polish icon-button parity lands)

1. Give the head report action row the same unified container framing as the
   lead toolbar pill, so the action controls sit in one bar instead of floating.
   Apply in BOTH head modes (form header row + slides mode, where the shell
   renders the row directly).
2. Align the action controls to the FINAL lead icon-button styling chosen in
   `polish-lead-toolbar-and-risk-dialog` (height, radius, icon-button vs.
   text+icon) so head and lead match. Keep behavior, hrefs, and aria intact.
3. Audit the other "top panels with buttons" the user flagged generally —
   inventory every report-surface top action row (lead form header, head
   dashboard/review, viewer) and record which already match vs. need the same
   container/control treatment. Fix the ones that diverge; leave a note for any
   intentionally-distinct surface.

Presentation/consistency only — no logic, data, or behavior changes. UI strings
stay English. No theme/token/dark-mode work (research-only per repo rule).

## Open Questions (resolve before implementing)

- Container exactly mirrors the lead pill, or a head-specific lighter variant
  (head is read-only — fewer controls)?
- Do Present/Print stay as labeled text+icon pills (they are primary actions),
  or also collapse to icon-only with tooltip like the utility controls?
- Scope of the "everywhere" audit: report surfaces only, or all app top bars?

## Dependencies

- MUST land AFTER `polish-lead-toolbar-and-risk-dialog` so it targets the final
  lead control styling, not the interim one (otherwise head re-diverges).
- Builds on the archived `head-toolbar-parity` and `unify-head-toolbar-controls`
  — read both before implementing; reuse their tokens/components, do not fork.

## Out of Scope

- Theme / token / dark-mode / background changes.
- Behavioral changes to any control (navigation, export, scope switching).

## Notes

- Capture draft from the 2026-06-14 live walk. Needs a short design pass (the
  open questions) before code. The `specs/` direction, if added, records intent,
  not a final contract.
