## Why

Three existing report presentation contracts fail for admitted data: publish confirmation returns after eligibility loss, author deep links target an invisible or foreign lead product, and an unmatched emphasis marker is removed from a Chat answer.

## What Changes

- Retire publish dialog intent when the existing submission eligibility becomes false.
- Resolve author product targets against the displayed Product collection or the focused lead's own displayed products.
- Render only closed bold pairs; preserve an unmatched trailing marker as literal text.
- Reuse existing rail, requirement-copy and portfolio class owners; remove unread completion inputs and correct the Item rail rationale without behavior changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `head-report-visibility`: publish confirmation requires fresh intent after eligibility loss.
- `report-routing`: author target belongs to the displayed scope-specific collection.
- `lead-report-assistant`: unmatched emphasis remains literal.

## Impact

Owned web components and existing tests only. No schema, server, configuration, storage, authorization, lifecycle or dependency changes. Native browser, screen-reader, focus restoration and multi-client acceptance remain Root-owned and unproved by DOM unit checks.
