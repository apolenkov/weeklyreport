# Toolbar: document actions on the header line, neutral toggle family

## Why

The just-shipped two-row toolbar (`toolbar-two-row-document-vs-context`) put
both the Document-action row and the Context-control row inside one bordered
container. Two problems surfaced in live use (user review 2026-06-18, grade
"2/5"):

1. **The bordered box swallowed both rows and grew tall.** The document-action
   row and the context-control row sit in one cream-framed pill; because the
   segmented toggles are taller than the icon buttons, the two rows render at
   different heights and the box reads as "everything crammed in here". The
   page already has a header line (`My Report` / `Status Report` + status
   badge) that is the natural home for document actions — it is row 1 in the
   user's mental model, sitting empty on the right.

2. **Three different toggle styles + a latent token bug.** `ViewModeToggle`
   (Edit/Slides) and `ScopeToggle` (Product/Leads) use a green-bordered family;
   `RecordVisibilityToggle` (Mine only/Everyone) uses a different grey-bordered
   padded-track family — so "Mine/Everyone" and "Edit/Slides" do not read as
   the same control. Worse, both green-family toggles fill their inactive
   segment with `bg-[var(--color-surface)]`, and `--color-surface` is **not
   defined anywhere in the CSS** — it resolves to transparent, showing the
   cream toolbar frame (`--color-surface-hover: #f8f6f2`) through the segment.
   On the green-tinted page that reads as a "strange yellow" (user report).

The agreed mental model: **green solid = an action you take** (Submit, Publish);
**a toggle changes what/how you see** and must look like a toggle, not compete
with the green actions.

## What Changes

- **Promote document actions onto the page header line.** The document actions
  (lead: Version⏳, PDF⏳, Fill-From, Save, Submit Section, Request Reopen,
  Revoke; head: Export PDF, Move to archive, Publish & Lock; viewer: Export PDF)
  render in the right slot of the existing `<header>` (`justify-between`), beside
  the title/status block. `ReportToolbar` no longer renders a `documentActions`
  row; the bordered container holds only the Context-control bar (one row). This
  removes the two-row height mismatch — the box is single-row and fixed-height.
- **One neutral segmented-toggle family.** Introduce a shared presentational
  primitive (the segmented-pill look). `ViewModeToggle`, `ScopeToggle`, and
  `RecordVisibilityToggle` compose it so Edit/Slides, Product/Leads, and
  Mine/Everyone are visually identical: same height (44px), same per-segment
  min-width, same neutral border/track. Each keeps its own mechanics — Edit/Slides
  stays `<Link>` URL navigation, the others stay client state — so the visual
  unification does NOT collapse them into one component.
- **Reserve green for actions; toggles use a neutral-dark active fill.** The
  active segment fills with the neutral foreground token (`--color-foreground`,
  white text), NOT the brand accent. Brand green now appears only on real
  forward actions (Submit Section, Publish & Lock). Inactive segments use a
  solid near-white track (`--color-surface-empty`) so they never show the cream
  frame through — fixing the "yellow".
- **Remove the undefined `--color-surface` reference.** The inactive-segment
  background moves to the defined `--color-surface-empty`; no undefined custom
  property remains in the toggle styles.
- **Toggle All stays a quiet neutral utility button** (icon + visible label),
  not green and not a segmented toggle — it is a one-shot action on all
  sections, not a persistent two-option selection.
- Status indicators (Live · X/Y Submitted badge, autosave/Submitted badge,
  "No submitted content yet" hint, department label) stay on the header line as
  today; they are not actions and do not move into the context bar.

## Out of scope

- Reviving versions/snapshots (Version stays the inert Coming-soon stub).
- A real Copy control or a real lead PDF export.
- Admin surfaces (admin does not render the report toolbar).
- Full breakpoint redesign — but narrow-width reachability stays in scope: the
  header action group and the context bar each wrap/scroll so no control is
  clipped out of reach.
- Reworking the `ToolbarIconButton` 32px primitive or the Agent-review /
  ComingSoon inert pattern (kept as-is; only relocated).
- Fixing every other `--color-surface` callsite. The token is undefined and is
  also read outside the toggles (e.g. the empty-submissions state in
  `weekly-report-page.tsx`); this change only removes the reference from the
  segmented toggles. Defining `--color-surface` globally, or fixing the other
  callsites, is a separate token-hygiene task (a global definition would alter
  other surfaces and is out of scope here).

## Impact

- **Affected specs:**
  - MODIFIED `report-toolbar-layout` — the split axis is unchanged
    (document-action vs context-control) but document actions render on the page
    header line, and the bordered toolbar holds only the single context-control
    bar; the accent-hierarchy, inert-slot, role/period-adaptation, accessible-
    groups, and narrow-width requirements re-scope from "top row inside the
    toolbar" to "header action group" accordingly.
  - MODIFIED `head-toolbar-semantics` — the segmented toggles share one family
    with a **neutral active fill** (`--color-foreground`), not the brand accent;
    `RecordVisibilityToggle` joins the family.
  - MODIFIED `toolbar-polish` — the shared toggle family is "neutral", not
    "brand green family".
  - MODIFIED `report-toolbar-parity` — the "labeled header actions are not
    icon-ified" requirement re-scopes from "the document-action toolbar row" to
    "the page header line / context-control bar"; labeled actions keep their text
    after the move.
- Honours without modifying `lead-report-controls-integrity`,
  `lead-toolbar-presentation`, and the `deferred-feature-pattern`.
- **Affected code:**
  `apps/web/src/components/report-shell/report-toolbar.tsx` (drop the
  documentActions row),
  `.../report-shell/{view-mode-toggle,scope-toggle}.tsx` and the new shared
  segmented-toggle primitive,
  `apps/web/src/components/lead/lead-form.tsx` (`RecordVisibilityToggle` + move
  document actions into the header),
  `apps/web/src/components/weekly-report/weekly-report-page.tsx` (move
  Export/Archive/Publish into the header),
  `apps/web/src/components/head/head-report-shell.tsx` (slides-mode header +
  composition),
  `packages/ui/src/styles/globals.css` (remove the `--color-surface` reference
  path; the toggle uses `--color-surface-empty`).
- **Docs:** none required beyond the spec deltas (the colour/layout detail lives
  in `design.md`).
