## ADDED Requirements

### Requirement: Auxiliary repository roots MUST use deterministic concern ownership

Every maintained file under `scripts/`, `e2e/runtime-sweep/`, and `prisma/`
MUST have exactly one owner in a checked ownership catalogue. Its home MUST be a
deterministic function of concern first and role second. Executable entrypoints,
implementation, tests, and owned baseline/ledger data MUST remain inside the
owning concern boundary; a generic flat root or generic repository-wide `data/`
bucket MUST NOT be used as an ownership substitute.

#### Scenario: A runtime matrix compiler is catalogued

- **WHEN** a source file compiles or validates runtime matrix rows
- **THEN** its catalogue owner is the runtime-sweep matrix concern
- **AND** it resides below `e2e/runtime-sweep/matrix/`, not the harness root or an unrelated evidence directory

#### Scenario: An ownership map is incomplete

- **WHEN** a tracked file in a migrated root has zero or multiple ownership entries
- **THEN** the directory-architecture gate fails
- **AND** no move is accepted until exactly one target owner is recorded

### Requirement: Large direct-file inventories MUST split or carry a shrinking exception

A maintained directory containing more than 30 direct files MUST split along
catalogued concern boundaries unless the durable standard explicitly declares it
as a single-concern bounded-flat exception. Every exception MUST record its exact
current direct-file count as a non-increasing baseline. New files MUST NOT be
added to an over-threshold exception without first splitting or lowering the
count elsewhere in the same concern.

#### Scenario: A flat tooling directory grows beyond the threshold

- **WHEN** a change leaves more than 30 direct maintained files in a directory with no bounded-flat exception
- **THEN** the structural gate fails with the directory and count
- **AND** adding a filename prefix does not satisfy the requirement

#### Scenario: A declared flat API module does not grow

- **WHEN** an intentionally flat module is listed with a baseline of N direct files
- **THEN** the gate accepts a current count at or below N
- **AND** rejects N+1 until the module is split or the durable architecture decision is explicitly changed

### Requirement: Runtime-sweep sources MUST be grouped behind stable evidence contracts

Runtime campaign declaration, source binding, manifest, matrix, preflight, live
replay, evidence capture, exceptional scenarios, driver import, and process
support MUST reside in distinct concern directories behind minimal entrypoints.
Relocation MUST preserve serialized artifact schemas, digest computation,
exact-source binding, external archive destinations, and exactly-once cell IDs.

#### Scenario: Existing runtime artifacts are read after relocation

- **WHEN** SOURCE, PREFLIGHT, MATRIX, or MANIFEST fixtures created before the move are validated
- **THEN** their schemas and digests retain the same meaning
- **AND** no source path rename is encoded as a product finding or new cell identity

### Requirement: Prisma code MUST separate stable entrypoints, guards, operations, and seed families

`prisma/schema.prisma`, `prisma/migrations/`, and the Prisma-configured
`prisma/seed.ts` entrypoint MUST remain stable. Destructive guards MUST reside in
`prisma/guards/`, operational reset/wipe/backfill code in
`prisma/operations/`, and seed implementations under named profile/family
directories. All destructive operations MUST continue to invoke the production
guard; seed profiles MUST retain their manifests, identities, and deterministic
reference-time contracts.

#### Scenario: Prisma invokes the configured seed entrypoint

- **WHEN** Prisma runs the repository seed command after relocation
- **THEN** `prisma/seed.ts` dispatches to the selected profile implementation
- **AND** profile validation and dangerous-action consent remain enforced

#### Scenario: A wipe helper bypasses the guard

- **WHEN** a moved reset, wipe, or backfill entrypoint can mutate a protected database without the destructive guard
- **THEN** the target-guard tests and aggregate gate fail

### Requirement: Transitional web roots MUST converge on canonical feature or shared homes

`apps/web/src/features/report-pages` MUST retain only page-level composition.
Report-section, period, and review behavior MUST live in their canonical feature
segments behind existing facades. Root `src/lib`, `src/hooks`, and `src/server`
files MUST move by consumer ownership to `features/<domain>/{model,api}` or
`shared/{lib,hooks,server}`. The migration MUST introduce zero production deep
cross-slice imports.

#### Scenario: A report-specific hook is classified

- **WHEN** a root hook is consumed only by report-section behavior
- **THEN** it moves to the report-sections model segment
- **AND** it is not placed in `shared/hooks` merely because it began in the root hooks directory

#### Scenario: Cross-slice edges are remeasured

- **WHEN** the web migration completes
- **THEN** production deep cross-slice import count remains zero
- **AND** the prior test-only viewer deep import is removed rather than grandfathered
