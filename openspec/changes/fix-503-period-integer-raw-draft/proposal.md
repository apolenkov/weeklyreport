# Proposal

## Why

C4708 (duplicate F8029-2, ticket `w039a-number-field-raw-input`): the Settings →
Periods integer fields use `type="number"`. Browsers sanitize the displayed
value of that control, so non-numeric draft text such as `12days` renders as
empty and the admin cannot see what they typed, while the field's own parser
(`parseIntegerInBounds`) already validates the raw text. `+8` is a concrete
divergence: the parser accepts it and the number control blanks it.

## What Changes

- `NumberField` and `ReopenWindowField` become `type="text"` with
  `inputMode="numeric"`; native `min`/`max` are removed and no `pattern` is
  added, so the integer parser stays the only validity source.
- The accepted range moves into each field's accessible description (the
  spinbutton range semantics are gone): period length, default deadline and
  auto-archive hints gain `Must be min..max unit.`, and the reopen hint is
  referenced from `aria-describedby` when there is no error.
- The committed-value reseed is unchanged, so a valid draft may be re-rendered
  in canonical integer form after it commits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-settings-ui`

## Impact

`settings-periods-field-controls.tsx`, `settings-periods-fields-base.tsx`,
`settings-periods-fields-cycle.tsx` and their colocated tests. Arrow-key and
wheel stepping and the spinbutton role disappear on these five fields.

## Non-goals

- `parseReopenWindow` and `parseIntegerInBounds` still disagree on a leading
  sign; unifying them is out of scope.
- Other `type="number"` inputs (reminder policy offset row) are not covered.
- Real browser typing, paste, keypad and a11y-tree behavior need agent-browser
  and are listed as native checks.
