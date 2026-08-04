# dependency-cycle-elimination Specification

## Purpose

Eliminate runtime and type dependency cycles by landing each connected cluster atomically around one semantic owner with captured dependency-cruiser evidence.

## Requirements

### Requirement: Both dependency graphs MUST be acyclic

The application and package source graph MUST contain zero runtime
`no-circular` violations under the production dependency-cruiser configuration
and zero type-inclusive `no-circular` violations when
`--ts-pre-compilation-deps` is enabled. The type-cycle baseline MUST finish at
zero.

#### Scenario: Only the runtime graph is checked

- **WHEN** `pnpm depcruise` exits zero but the pre-compilation graph contains a
  cycle
- **THEN** cycle elimination is not complete
- **AND** `pnpm lint:type-cycles` reports the remaining measured baseline

### Requirement: A connected cluster is the atomic landing unit

Each connected cycle cluster MUST land in one commit containing the ownership
seam, all affected consumers, targeted evidence, exact baseline decrement, and
durable checkpoint. Work from two connected clusters MUST NOT be mixed in one
commit.

#### Scenario: One cluster is removed

- **WHEN** the pre-compilation graph loses every violation in that connected
  cluster
- **THEN** the same commit lowers the baseline by exactly that measured count
- **AND** unrelated clusters remain represented in the baseline

### Requirement: Cycle removal MUST establish semantic ownership

A cycle fix MUST establish a one-way dependency toward the module that owns the
contract or behavior. It MUST NOT use duplicated declarations, generic type
bags, pass-through barrels, dynamic-import indirection, ignored paths, or rule
weakening solely to make the graph green.

#### Scenario: A type is moved to a neutral dump

- **WHEN** both former sides still define or coordinate the behavior and a new
  file merely hosts their shared shape
- **THEN** the cluster is not accepted as architecturally resolved

### Requirement: Semantic cutovers are explicit and fully evidenced

When a cycle slice changes a public feature API, wire contract, product
behavior, schema, or persisted meaning, the owning OpenSpec requirements and
all downstream consumers MUST be updated in the same slice. A data-contract
cutover MUST also update and prove all affected seed profiles.

#### Scenario: Existing tests encode the former behavior

- **WHEN** the selected architecture intentionally changes that behavior
- **THEN** the delta specification states the new behavior
- **AND** targeted boundary tests and affected product journeys prove it
- **AND** green rewritten tests alone are insufficient

### Requirement: Exit status is captured from dependency-cruiser itself

Cycle verification MUST capture dependency-cruiser's own exit status in the
same process that invokes it. It MUST NOT pipe the command through a consumer
whose successful exit replaces dependency-cruiser's failure.

#### Scenario: The graph contains 27 violations

- **WHEN** the enforcement reporter runs directly
- **THEN** its exit status is 27
- **AND** a trailing display command cannot convert that result to zero
