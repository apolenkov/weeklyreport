## Why

When Export PDF is disabled for an unpublished or reopened report, sighted
mouse and keyboard users can see only a dim icon and cannot discover the
publish prerequisite. The C47 screenshot review in
`~/work/customreport-archive/2026-08-11-product-form-atlas/` confirmed that the
reason exists only as screen-reader text on a native disabled button, which
cannot receive focus or trigger the required visible guidance.

## What Changes

- Keep Export PDF disabled under the existing eligibility rules.
- Expose the exact publish prerequisite in a visible tooltip from a focusable
  and hoverable wrapper around the disabled control.
- Preserve the button's accessible name and described-by relationship.
- Add focused keyboard, pointer, accessibility, and enabled-state tests.

### Non-goals

- No PDF eligibility, request, worker, polling, or download changes.
- No new visible label in the compact toolbar and no redesign of other icon
  actions.
- No API, database, schema, authorization, or route changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `toolbar-polish`: require the disabled Export PDF prerequisite to remain
  available to screen readers and become visibly discoverable by pointer and
  keyboard users.

## Impact

The change affects `ExportPdfButton`, its focused component tests, the toolbar
presentation contract, and C47 browser evidence. PDF export behavior and
backend eligibility remain unchanged.
