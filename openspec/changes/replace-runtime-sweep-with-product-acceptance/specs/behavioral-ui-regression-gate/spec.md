## REMOVED Requirements

### Requirement: Durable behavior-anchored Scenario Catalog

**Reason**: The catalog duplicated OpenSpec and became a separate delivery denominator.

**Migration**: Keep behavior in OpenSpec and focused tests colocated with product modules.

### Requirement: Deterministic browser gate remains smoke-only

**Reason**: The owner retired the separate browser harness, including a replacement smoke.

**Migration**: Use focused product-adjacent tests and human product review when warranted.

### Requirement: Acceptance harness boundary

**Reason**: No blocking browser acceptance harness remains.

**Migration**: Keep shared test helpers local to their product test family.

### Requirement: Per-role route health produces a blocking verdict

**Reason**: The route matrix and its catalog, anomaly reporter, and axe collector are deleted.

**Migration**: Canonical product role middleware remains machine-enforced; concrete UI defects receive focused regressions.
