# Proposal

## Why

When more accessible entities match a Lead's reference than the server offers as
clarification options, the assistant silently drops the rest. The response carries
no count and no truncation signal, so the Lead cannot tell that some matches are
unselectable. Tracked as C1883 in TASK-503.55 (archived) and merged into
TASK-503.111 (W503-111).

## What Changes

- `clarification_required` carries `total` (all distinct accessible candidates) and
  `truncated` (true when `total` exceeds the returned options). No pagination.
- The Lead UI shows one truncation line under the options when `truncated` is true.
- The answer prompt is not changed: clarification is returned before any model call.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-report-assistant`: the explicit product outcomes requirement gains the
  clarification count contract and two scenarios replacing the single
  disambiguation scenario.
