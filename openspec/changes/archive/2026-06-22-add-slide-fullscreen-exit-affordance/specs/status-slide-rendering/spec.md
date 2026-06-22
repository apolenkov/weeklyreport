## MODIFIED Requirements

### Requirement: Slide Deck Must Provide an Exit-Fullscreen Affordance

When the user enters the slide deck in fullscreen mode, the deck MUST render a PERSISTENT, visible control that returns the user to the standard report view on EVERY deck (the lead deck and the head deck), so the control does not depend on toolbar/hero chrome that can scroll out of view in fullscreen. The user MUST never be trapped in fullscreen mode without a discoverable exit path. In addition, on entering fullscreen the deck MUST surface a discoverable hint that the `Esc` key exits (`Esc` always exits natively and cannot be suppressed), and the fullscreen toggle MUST expose its state to assistive technology via `aria-pressed` with a label that flips between "Enter fullscreen" and "Exit fullscreen". The toggle's state MUST be driven by the native `fullscreenchange` event so it stays correct when the user exits via `Esc`, and on exit focus MUST return to a concrete focusable control on the deck (never the floating exit pill, which unmounts when fullscreen ends) — on the lead deck the persistent toolbar toggle, on the head deck the deck article made programmatically focusable (`tabIndex={-1}`). The document-wide `f` fullscreen shortcut MUST have a single owner per deck so adding a second exit control does not double-toggle.

#### Scenario: a lead enters fullscreen and finds a visible exit

- **WHEN** a lead activates fullscreen on the lead slide deck
- **THEN** a persistent exit-fullscreen control is visible (independent of toolbar scroll position)
- **AND** clicking it returns the lead to the standard report view

#### Scenario: the deck shows an Esc hint on entering fullscreen

- **WHEN** any deck enters fullscreen
- **THEN** a discoverable hint that `Esc` exits is shown (it may be transient and auto-dismiss)
- **AND** pressing `Esc` returns the user to the standard report view

#### Scenario: exiting via Esc keeps the toggle correct and restores focus

- **WHEN** the user exits fullscreen by pressing `Esc` rather than the control
- **THEN** the fullscreen toggle reflects the non-fullscreen state (`aria-pressed="false"`, label "Enter fullscreen")
- **AND** focus is returned to the persistent toolbar toggle (not the floating exit pill, which unmounts when fullscreen ends)
