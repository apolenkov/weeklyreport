## ADDED Requirements

### Requirement: The lead toolbar presents the same control set in edit and slides

The lead report toolbar MUST render the same set of context controls in both edit and slides modes — including the Record-visibility toggle — so no control changes position or appears/disappears when the lead switches between modes.

1. The Record-visibility toggle (Mine only / Everyone) MUST render in both edit
   and slides modes (today it renders only in edit), so the controls after it do
   not shift position between modes.
2. The toolbar's control order and geometry MUST be identical across modes; the
   only mode-adaptive slot is the existing trailing utility (collapse-all in
   edit, fullscreen in slides), which already occupies one fixed-width position.
3. The visibility toggle MUST be functional in slides, not an inert placeholder —
   it drives the slide deck's record visibility (see `status-slide-rendering`).

#### Scenario: switching edit to slides keeps controls in place

- **WHEN** a lead toggles the view-mode control from edit to slides on their
  report
- **THEN** the Record-visibility toggle remains present in the same position and
  the view-mode toggle and trailing utility do not shift horizontally

#### Scenario: the visibility toggle is present and live in slides

- **WHEN** a lead views their report in slides mode
- **THEN** the Mine only / Everyone toggle is rendered and interactive, and
  changing it changes what the deck shows (not a disabled placeholder)
