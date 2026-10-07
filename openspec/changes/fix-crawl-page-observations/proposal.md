## Why

The crawler can miss changed form values and current long tasks while reporting false clipping and obstruction. Accepted tickets ops-crawl-longtask-measurement, ops-crawl-quick-value-signature, ops-crawl-obstruction-geometry and ops-crawl-clipping-geometry define OCR C4125/C4167/C4160/C4161 and their evidence.

## What Changes

- Include non-password live field values in quick restoration identity.
- Measure long tasks in the current press interval before returning its result.
- Use the visible rectangle intersection for obstruction testing.
- Distinguish accessible scrolling and intentional truncation from hidden overflow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: accurate state and geometry observations.

## Impact

Crawler batch and probe scripts, native browser regressions and ui-crawl specification. No dependencies.

## Non-goals

- Product behavior, database E2E, full signature redesign, crawl limits and delivery configuration.
