# Toolbar: compact icon controls, slate active, one shared height

## Why

Live review of the header-line + neutral-toggle toolbar (PR #17) surfaced four
polish gaps the user graded against:

1. The near-black active toggle fill (`--color-foreground`) read too harsh.
2. The text toggles (Edit/Slides, Mine only/Everyone) were wide and crowded the
   period navigator at the 1088px content width.
3. Controls sat at mixed heights (icon buttons 32px, pill actions / period nav
   ~44–48px), so the toolbar did not read as one row.
4. The view controls were left-aligned, mixed in with period navigation.

## What Changes

- **Slate active fill.** Segmented-toggle active segment moves from
  `--color-foreground` to a softer `--color-toggle-active` (#3f4a44) — still
  neutral and clearly selected, not the brand accent.
- **Icon-only where an icon is unambiguous.** Edit/Slides (pencil / grid) and
  the lead Mine/Everyone visibility toggle (one-person / group) and the slides
  Fullscreen control render icon-only, each keeping an accessible name
  (sr-only text + tooltip). Scope (Product/Leads) stays compact text — it has
  no unambiguous icon.
- **One shared control height.** A `--toolbar-control-h` (32px) token sizes
  every report-toolbar control — icon buttons, the pill actions (Submit
  Section / Publish & Lock / Toggle All / reversal actions), period navigation,
  the segmented toggles, and the Agent-review placeholder — so the toolbar reads
  as a single row of equal-height controls.
- **Two clusters per bar.** Period navigation (and the show-archived filter)
  anchor the left; the view controls (Agent review, scope, view-mode, Toggle
  All / Fullscreen) are pushed to the right by a flex spacer.

## Out of scope

- The header-line vs context-bar split and the document-action group (shipped in
  `toolbar-header-actions-neutral-toggles`).
- Any data / behavior change — presentation only.

## Impact

- Affected specs: MODIFIED `head-toolbar-semantics` (toggle family: slate active,
  icon-only Edit/Slides, compact shared height) and `lead-toolbar-presentation`
  (uniform toolbar control height; Mine/Everyone icon-only). `toolbar-polish`'s
  "one neutral family" still holds (slate is neutral) and is unchanged.
- Affected code: `packages/ui/src/styles/globals.css` (`--color-toggle-active`,
  `--toolbar-control-h`), `apps/web/src/components/report-shell/{segmented-toggle,view-mode-toggle,scope-toggle,agent-review-coming-soon}.tsx`,
  `apps/web/src/components/lead/{lead-form,period-navigator}.tsx`,
  `apps/web/src/components/weekly-report/{weekly-report-page,publish-lock-button}.tsx`,
  `apps/web/src/components/slides/slide-fullscreen-button.tsx`,
  `apps/web/src/components/head/head-report-shell.tsx`.
