## Why

The crawler can undo a replacement action when its label shares the first 20 characters with the original control. C4098/C4123 require safe identity checks before repeated events.

## What Changes

- Compare the full normalized control name, native tag, role and probe anchor before undo.
- Reject unnamed, disabled, hidden or obstructed controls at event time.
- Preserve the observed state so existing restoration can reload after a mismatch.
- Exercise actual DOM events through a named agent-browser session on an isolated HTTP fixture.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: repeated presses require live observable identity and availability.

## Impact

Crawler probe, batch and restore caller; identity-prefix constant removed. Test support uses the existing production browser driver. No database, application UI, dependency or delivery changes.

## Non-goals

Select assignments, generic geometry, login and timeout recovery are other groups. No heuristics for renamed toggle labels.
