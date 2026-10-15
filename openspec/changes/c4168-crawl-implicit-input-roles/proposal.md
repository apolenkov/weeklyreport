# Proposal

## Why

The crawler probe reports every `<input>` other than checkbox and radio as
`textbox` (C4168, TASK-503.36). A native snapshot of the same fixture shows
`number` as `spinbutton` and `range` as `slider`, and an input button is a
`button`. The full walk's write guard (`fullControlReason`) protects inputs
only through that wrong `textbox` role, so correcting the role on its own
would let the walk press inputs that no scenario has audited.

## What Changes

- The probe reports the implicit ARIA role from html-aria for inputs:
  `button`/`submit`/`reset`/`image` → `button`, `number` → `spinbutton`,
  `range` → `slider`, checkbox and radio as before, text-like types as
  `textbox`. Types without an implicit ARIA role (date, time, color, file and
  the like) report no role instead of an invented `textbox`. An unknown or
  invalid `type` is the browser's `text`. An empty `role=""` still falls back
  to the implicit role; a non-empty explicit role is unchanged.
- The full-walk write guard keeps protected inputs by tag and DOM type, not
  by role: every `<input>` except checkbox and radio still needs a named
  scenario, so the role correction admits no new action. Textarea and
  explicit `textbox` controls stay protected; checkbox, radio and buttons
  keep their current treatment.

Policy: 008 + Astra, 2026-10-15
(`handoffs/task-503/crawler-roles-36/POLICY-008-ASTRA.json`).

## Capabilities

### ui-crawl

ADDED: probed inputs carry their implicit role, and the full-walk input guard
does not depend on it.

## Impact

`scripts/ui-crawl/probe.ts`, `scripts/ui-crawl/full-plan.ts` and their
tests (`full-plan.test.ts`, native `observations.browser.test.ts`). Control
identities (`controlKey`, `elementId`) of the re-classified inputs change once
between crawler versions. An `<input>` with an explicit non-checkbox/radio role
(none in product source today) now also needs a named scenario.
