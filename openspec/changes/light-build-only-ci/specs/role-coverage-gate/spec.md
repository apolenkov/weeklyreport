## RENAMED Requirements

- FROM: `### Requirement: Gate Runs in CI for Every PR Touching Router Files`
- TO: `### Requirement: Gate Runs Locally Before Push`

## MODIFIED Requirements

### Requirement: Gate Runs Locally Before Push

The role-coverage gate MUST execute through local pre-push (`pnpm test`), including merge requests that add or modify at least one `*.router.ts` file. A merge request that introduces a non-canonical procedure MUST be blocked from merging — the violation is surfaced before push, not at runtime.

#### Scenario: PR adds a new router file with a canonical procedure

- **WHEN** a merge request creates a new `*.router.ts` file whose procedures all use canonical builders
- **THEN** the role-coverage gate passes and does not block the merge request

#### Scenario: PR adds a router file with a non-canonical procedure

- **WHEN** a merge request creates or modifies a `*.router.ts` file that contains at least one procedure not using a canonical builder
- **THEN** the role-coverage gate fails, local verification fails, and delivery is blocked until the violation is corrected

### Requirement: Procedures Must Use Canonical Builders

Every tRPC procedure defined in `apps/api/src/**/*.router.ts` MUST be constructed
using one of the 7 canonical middleware-chain builders exported from
`apps/api/src/infrastructure/trpc/`. Procedures that do not reference a canonical
builder MUST be rejected by the local gate.

#### Scenario: Procedure imports a canonical builder

- **WHEN** a `*.router.ts` file defines a procedure using `publicProcedure`, `protectedProcedure`, or another canonical builder imported from `apps/api/src/infrastructure/trpc/`
- **THEN** the role-coverage gate reports the procedure as compliant and local verification passes

#### Scenario: Procedure defines its own middleware chain inline

- **WHEN** a `*.router.ts` file defines a procedure by calling `t.procedure.use(myLocalMiddleware)` without going through a canonical builder
- **THEN** the role-coverage gate reports a violation citing `role-coverage-gate` and local verification fails with a non-zero exit code

### Requirement: Gate Compares Builders by Reference Identity

The local gate MUST verify that a procedure's builder is the same object reference
as one of the 7 canonical builders. A developer who copies a canonical builder's
middleware chain into a new local helper and uses that helper MUST still fail the
gate.

#### Scenario: Local helper replicates canonical builder body

- **WHEN** a `*.router.ts` file constructs a procedure via a local `const myProcedure = t.procedure.use(authMiddleware)` whose middleware chain is byte-for-byte identical to a canonical builder, but is a distinct object
- **THEN** the gate treats it as a non-canonical builder and local verification fails citing `role-coverage-gate`

#### Scenario: Re-exported canonical builder passes identity check

- **WHEN** a module re-exports a canonical builder under an alias and a router imports that alias
- **THEN** the gate resolves the alias to the original canonical reference, confirms identity, and local verification passes
