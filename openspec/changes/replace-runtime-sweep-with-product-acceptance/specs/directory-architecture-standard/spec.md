## REMOVED Requirements

### Requirement: Runtime-sweep preflight modules MUST expose bounded ownership groups

**Reason**: The entire `e2e/runtime-sweep/` platform, including preflight diagnostics and reveal continuation, is being retired rather than reorganized again.

**Migration**: Product browser acceptance moves to the bounded `e2e/acceptance/` contour, which is governed by the `bounded-product-acceptance` whole-contour file and line budgets.

## ADDED Requirements

### Requirement: The browser acceptance contour MUST remain a bounded test layer

The owned `e2e/acceptance/` tree MUST remain within the file and line budgets defined by `bounded-product-acceptance`. It MUST depend on existing test helpers and product contracts, and production modules MUST NOT import from it.

#### Scenario: Acceptance architecture grows beyond its budget

- **WHEN** a change adds acceptance files or non-generated lines beyond the frozen bound
- **THEN** the directory-architecture gate fails and reports the measured total
- **AND** no nested-folder reshuffle may evade the whole-contour count
