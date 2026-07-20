# Tasks

- [x] 1. In `lead-form.tsx`, replace the two separate trailing controls (the
      slot-A `{isSlidesMode && <SlideFullscreenButton/>}` and the trailing
      `{(content) && <Toggle All button>}`) with ONE mode-adaptive trailing
      control in the right cluster:
  - edit → icon-only square button (CollapseIcon) calling `handleToggleAll`.
  - slides → the fullscreen toggle on `deckRef` (reuse `SlideFullscreenButton`
    default variant, already icon-only square).
- [x] 2. Both variants at `h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)]`
      (square, fixed) in the same trailing slot, so the row does not shift when
      switching modes.
- [x] 3. Edit-mode accessible name + tooltip track `groupExpanded`: "Collapse all
      sections" when expanded, "Expand all sections" when collapsed.
- [x] 4. ALWAYS reserve the edit-mode slot (render it, `disabled` when there is
      nothing to collapse — do NOT conditionally remove it), so adding/removing
      sections in-session never makes it appear/disappear and shift the row.
- [x] 5. Remove the now-inert "Toggle All in slides" exposure and the duplicate
      slot-A `SlideFullscreenButton` mount. Keep `SlideFullscreenButton`
      `variant="floating"` for the in-deck overlay.
- [x] 6. Update lead-form / toolbar tests: edit shows the collapse control with a
      state-reflecting label and activating it toggles sections; slides shows the
      fullscreen control (not a "Toggle All"); the trailing slot keeps one fixed
      width and stays present across modes and across content add/remove.
- [x] 7. Gates green (typecheck/lint/test); live-verify lead edit↔slides at
      1088/1200px: trailing control swaps icon/behavior in place, no row shift,
      no dead button.
