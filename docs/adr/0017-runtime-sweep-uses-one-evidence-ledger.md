# Runtime sweep uses one evidence ledger

The Exhaustive Runtime Sweep uses Playwright for deterministic surface and
state enumeration, bounded AI Drivers for semantic exploration, and one
SHA-bound evidence ledger owned by the primary orchestrator. A baseline stays
immutable until every candidate is adjudicated; fixes happen afterward and
trigger affected reruns plus one full final rerun, preventing mixed-version
coverage from being presented as a complete result.

## Consequences

Browser driving is sequential against a resettable E2E database, while
read-only candidate verification may run in parallel. A campaign is complete
only when every declared coverage cell is terminal and no confirmed functional,
accessibility, or visual gap remains; excluded engines and viewports are named
explicitly.
