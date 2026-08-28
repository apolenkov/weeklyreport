## MODIFIED Requirements

### Requirement: Runtime correctness MUST be proven without an exhaustive interaction platform

React warning, hydration, accessibility, console-source, and behavior-focused assertion requirements MUST be verified by focused tests colocated with product modules. No correctness requirement may require a root browser harness, route sweep, catalog, continuation graph, campaign ledger, per-control traversal, or AI-import protocol as its sole evidence source.

#### Scenario: A runtime correctness regression is introduced

- **WHEN** a focused product test observes a covered React warning, hydration error, console failure, or targeted accessibility defect
- **THEN** the smallest owning test fails and identifies the product surface
- **AND** no route matrix or exhaustive campaign is needed to reproduce it

## REMOVED Requirements

### Requirement: Swept role-reachable routes MUST render without React runtime warnings

**Reason**: The role route sweep is retired.

**Migration**: Put a focused regression at the product surface that emitted the warning.

### Requirement: Shared-shell controls swept across roles MUST satisfy the axe rules they currently violate

**Reason**: The four-role axe sweep is retired.

**Migration**: Keep accessibility assertions in focused component tests when a demonstrated risk requires them.

### Requirement: Sweep console noise MUST be filtered only with a confirmed source

**Reason**: The sweep console collector and allowlist are deleted.

**Migration**: A focused browser test may filter only an evidenced source within that test's local contract.
