## Purpose

The Biome `recommended`-ruleset flip (behavior commit `c4610797`) altered
interactive accessibility behavior — keyboard navigation, dialog
Escape-closability, focus/tabindex changes, and decorative-SVG DOM attributes —
across 58 files. The static gates (`typecheck`/`lint`/`test`/`build`) cannot
prove an interaction still works, and several dialog backdrops carry lint
suppressions whose justification is a load-bearing a11y claim. This capability
fixes the durable property that those a11y behaviors stay regression-covered, so
that a green static gate is never mistaken for proof that an interaction or a
suppressed-backdrop dialog still works. It governs the regression-coverage
property, not a code module.

## Requirements

### Requirement: Interactive a11y changes from the recommended-ruleset flip MUST have regression coverage

The accessibility behavior introduced by the Biome `recommended` flip MUST be
covered by automated regression tests derived from the per-file / per-block /
per-DOM catalog in the `verify-a11y-recommended-flip` change's `design.md`. That
behavior is keyboard navigation, dialog Escape-closability, focus/tabindex
changes, and the DOM attributes added across the 58 changed files (behavior
commit `c4610797`). A green static gate (`typecheck`/`lint`/`test`/`build`) alone
MUST NOT be treated as proof that an interaction or a suppressed-backdrop dialog
still works.

In particular, every dialog whose backdrop carries a
`eslint-disable-next-line jsx-a11y/no-static-element-interactions` (or
`jsx-a11y/click-events-have-key-events`) suppression — the former
`biome-ignore lint/a11y/noStaticElementInteractions` / `useKeyWithClickEvents`
comments, converted 1:1 in `migrate-lint-to-eslint-prettier` Phase 1 — justified
as "keyboard-closable via Escape + close button" MUST have a regression test
that proves that claim at runtime. (The suppression's comment FORM is incidental;
the regression target is the runtime behavior, which is tool-independent.)

#### Scenario: a suppressed-backdrop dialog is proven keyboard-closable

- **WHEN** a dialog that suppresses the backdrop interaction rules is open
- **AND** the user presses `Escape`
- **THEN** a regression test asserts the dialog is removed from the DOM
- **AND** a separate assertion confirms the visible Cancel/close button also
  closes it

#### Scenario: a decorative-SVG DOM change is regression-asserted

- **WHEN** a decorative icon SVG was given `aria-hidden="true"` by the flip
- **THEN** a regression test (unit-rtl or snapshot) asserts that attribute is
  present, so a future edit that drops it fails the suite
