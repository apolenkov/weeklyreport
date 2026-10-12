## Why

The existing published-snapshot contract requires author ordering to match the Russian live preview comparator. The current builder relies on database order. Collapsed dashboard content and changing Remind labels also need accurate accessibility semantics; revoke transport failures must use the existing curated-message owner.

## What Changes

- Sort mapped snapshot sections with the existing live preview author-name comparator, preserving query ordering and equal-name stability.
- Reuse one private Item/Risk/Decision include fragment with existing stableId ordering and comment fields. Add no comment chronology or new tiebreak policy.
- Export the existing shared asTrafficLight helper through its existing barrel declaration and reuse it under the existing persistence asTraffic name. Canonical schema owns vocabulary; null, undefined, unknown and uppercase remain null.
- Hide collapsed Blocked & At Risk content with inert and aria-hidden while retaining the grid animation.
- Derive the Remind accessible name from its visible label and Lead name; preserve live messages, timers and mutation behavior.
- Reuse mutationErrorMessage for revoke failures, preserving curated server messages.
- Preserve feedback capability gating, extract the existing trigger style base and reuse one same-origin Agentation endpoint constant.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `published-section-order-determinism`: clarify the existing preview/frozen comparator contract.
- `head-dashboard-clarity`: exclude collapsed content from accessibility and keep transient control names accurate.

## Impact

Only F15 explicit owners and additional Root grants. Existing Trends latest-status ordering, Less labels, feedback diagnostic keys, workflow disclosure and loaded-scope repairs are reused. Native browser, AT, database collation, integration, aggregate gates and independent review remain Root-owned and NE. TASK-287/D37-F15 evidence is external; no canonical registry or Backlog mutation.
