# Slide-mode collapse/fullscreen: one mode-adaptive trailing control

## Why

To stop the lead context bar from shifting when switching edit↔slides, the
previous round rendered "Toggle All" in slides too — but slides have no
accordions, so it is inert there, and a separate Fullscreen control also sits in
the bar. Two problems: a dead button in slides, and a redundant control. The user
chose to make the trailing slot mode-adaptive instead (grill 2026-06-18): one
control that is collapse-all in edit and fullscreen in slides, so the slot is
always meaningful and never jumps.

## What Changes

- Replace the lead context bar's trailing utility (the edit-only "Toggle All"
  button + the separate slides Fullscreen button) with a **single mode-adaptive
  icon-only control** in one fixed-width slot:
  - **edit** → collapse/expand all report sections (current `handleToggleAll` /
    `groupExpanded` behavior), collapse icon.
  - **slides** → toggle fullscreen of the deck (current `SlideFullscreenButton`
    behavior on `deckRef`), fullscreen / exit-fullscreen icon.
- Icon-only, square, at `--toolbar-control-h`, same position/width across modes
  so the row does not shift; each variant keeps an accessible name (sr-only text
  - tooltip).
- Remove the now-inert "Toggle All in slides" path and the standalone in-bar
  `SlideFullscreenButton` mount; the floating-overlay fullscreen variant (when
  already fullscreen) is unaffected.

## Out of scope

- Adding a real collapse/expand to slide content (the product grid keeps its
  "+N more" overflow as-is; own-scope quadrants stay fully expanded per
  `lead-slide-quadrants`). The slides variant is fullscreen, not section-collapse.
- Head/viewer toolbars (head has no Toggle All; viewer is read-only).

## Impact

- Affected specs: MODIFIED `lead-toolbar-presentation` (the trailing control is
  one mode-adaptive icon slot; no separate fullscreen / inert Toggle-All),
  MODIFIED `report-toolbar-layout` (context-control list: expand-all →
  mode-adaptive collapse/fullscreen control), and MODIFIED `report-toolbar-parity`
  (the former labeled `Toggle All` is replaced by this icon-only control carrying
  its name via aria-label + tooltip — resolves the durable "Toggle All keeps a
  visible text label" contract).
- Affected code: `apps/web/src/components/lead/lead-form.tsx` (context-bar
  trailing control: render one mode-adaptive control, drop the separate
  `SlideFullscreenButton` mount and the `!isSlidesMode` removal that exposed the
  inert Toggle All), reusing `handleToggleAll`/`groupExpanded` (edit) and the
  fullscreen toggle on `deckRef` (slides). `SlideFullscreenButton` floating
  variant stays for the in-deck overlay.
