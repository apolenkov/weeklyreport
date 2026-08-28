## REMOVED Requirements

### Requirement: The catalog is anchored to the App Router route surface

**Reason**: The route catalog duplicates product routes and OpenSpec requirements while creating a separate maintenance denominator.

**Migration**: Use the App Router source as the route inventory and focused tests for behaviors that carry demonstrated risk.

### Requirement: Every scenario has a machine-checkable outcome

**Reason**: The scenario catalog is retired.

**Migration**: Put machine-checkable outcomes directly in focused tests.

### Requirement: Every route has a reviewed behavioral intent

**Reason**: OpenSpec owns durable behavior; a second per-route intent inventory is no longer maintained.

**Migration**: Record behavior in the owning OpenSpec capability and product implementation.

### Requirement: A drift gate keeps the route catalog honest

**Reason**: The catalog and its drift gate are deleted together.

**Migration**: New routes follow ordinary product review and directly relevant tests.

### Requirement: Execution is route health plus one bounded smoke lifecycle

**Reason**: Route health and combined acceptance are retired by owner direction.

**Migration**: Run the one basic smoke when integration or release verification is required.

### Requirement: The catalog is documentation, not a new test runner

**Reason**: The catalog became test-runner input despite this boundary and is removed.

**Migration**: OpenSpec and focused tests remain the only durable behavior and executable regression sources.

### Requirement: Catalog role tokens are validated against the canonical role set

**Reason**: No catalog consumer remains.

**Migration**: Canonical role schemas and middleware builders continue to validate product authorization.

### Requirement: Catalog intent prose cannot invent product or data behavior

**Reason**: Deleting generated catalog prose removes this duplicate product-definition path.

**Migration**: Product and data behavior requires accepted OpenSpec and implementation evidence.
