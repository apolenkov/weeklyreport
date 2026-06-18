# Design — mode-adaptive trailing control

## Behavior by mode (one slot, fixed width)

| Mode   | Icon                                        | Action                       | Wiring (existing)                                                        |
| ------ | ------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| edit   | collapse (`CollapseIcon`)                   | collapse/expand all sections | `handleToggleAll()` flips `groupExpanded` consumed by `AccordionSection` |
| slides | fullscreen / exit (`Maximize2`/`Minimize2`) | toggle deck fullscreen       | the `SlideFullscreenButton` toggle logic on `deckRef`                    |

Both render through one square icon button at `h-[var(--toolbar-control-h)]
w-[var(--toolbar-control-h)]`, neutral outline, same slot in the right-aligned
view cluster (trailing). Because the slot is a fixed square in both modes, the
clicked control never changes width or position when the user flips Edit↔Slides.

## Accessibility

- edit: `aria-label="Collapse all sections"` (or expand, per current state) +
  tooltip; slides: `aria-label="Enter fullscreen"`/`"Exit fullscreen"` + tooltip.
- icon-only with an sr-only label OR aria-label (note: a `<button>` forwards
  `aria-label` fine; only `next/link` dropped it in jsdom — this is a button, so
  aria-label is safe).

## Implementation notes

- In `lead-form.tsx` the context-bar trailing control currently is: a separate
  `{isSlidesMode && <SlideFullscreenButton/>}` in slot A AND a `{(content) &&
<Toggle All button>}` trailing. Collapse to ONE trailing control switched by
  `isSlidesMode`: slides → render the fullscreen toggle (reuse
  `SlideFullscreenButton` default variant, already icon-only square); edit →
  render the collapse icon button calling `handleToggleAll`.
- Drop the standalone slot-A `SlideFullscreenButton` mount so fullscreen appears
  only as the trailing control (no duplicate).
- Keep `SlideFullscreenButton` `variant="floating"` (the in-deck overlay shown
  once already fullscreen) untouched.
- The trailing slot is ALWAYS reserved in edit (rendered), disabled when there is
  nothing to collapse — NOT hidden via `display:none`/conditional removal. In
  slides the fullscreen control always renders. Both occupy the same trailing slot
  at the same width, so the row stays stable even when sections are added/removed
  within a session.
- Edit-mode accessible name + tooltip track `groupExpanded`: "Collapse all
  sections" when expanded, "Expand all sections" when collapsed. (The control is a
  `<button>`, so `aria-label` forwards reliably — unlike the `next/link` toggles.)

## Risk

- Reserving a disabled control on an empty edit report shows a greyed icon with
  nothing to do. Acceptable trade-off for a non-shifting row; the disabled state +
  tooltip make it honest.
