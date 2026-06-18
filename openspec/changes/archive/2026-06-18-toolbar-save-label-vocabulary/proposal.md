# Toolbar vocabulary: slate toggle fill + labeled neutral Save

## Why

Two `toolbar-polish` statements drifted from the shipped toolbar:

1. It still names the segmented-toggle active fill `--color-foreground`, but
   `toolbar-compact-icon-controls` moved it to the softer slate
   `--color-toggle-active`.
2. It says utility actions all use the "32px icon-button treatment", but the
   lead Save control is now a labeled neutral pill (user request 2026-06-18:
   "Save with text, like Submit's size, but not green") — green stays the single
   forward commit; Save keeps its transient saving-accent busy state.

## What Changes

- Correct the active-fill token to `--color-toggle-active` (slate), not
  `--color-foreground`.
- Clarify the control vocabulary: icon-only utilities (export, archive, history,
  fill, version/PDF stubs) use the 32px icon-button treatment; the Save control
  is a labeled neutral pill at the same shared height, never the brand green.

## Out of scope

- No code change — spec-text correction matching the shipped UI.

Also: the slide-hero scope toggle composes the same `SegmentedToggle` primitive
but at the hero row height (`h-11`) so it lines up with the hero badges/capsule,
while toolbar instances stay at `--toolbar-control-h`. And the lead Toggle-All
control now renders in both edit and slides so the context row keeps a stable
set/order across modes (the interactive Edit/Slides and Toggle-All controls hold
fixed positions — verified by live DOM measure: same x in both modes).

## Impact

- Affected specs: MODIFIED `toolbar-polish` (control-vocabulary requirement) and
  `head-toolbar-semantics` (toggle family: toolbar instances at
  `--toolbar-control-h`, slide-hero instance at the hero row height).
