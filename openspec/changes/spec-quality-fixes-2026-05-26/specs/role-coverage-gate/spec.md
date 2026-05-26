## MODIFIED Requirements

### Requirement: Procedures Must Use Canonical Builders

Every tRPC procedure defined in `apps/api/src/**/*.router.ts` MUST be constructed
using one of the 8 canonical middleware-chain builders exported from
`apps/api/src/infrastructure/trpc/`. Procedures that do not reference a canonical
builder MUST be rejected by the CI gate.

#### Scenario: Procedure imports a canonical builder

- **WHEN** a `*.router.ts` file defines a procedure using `publicProcedure`, `leadProcedure`, or another canonical builder imported from `apps/api/src/infrastructure/trpc/`
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: Procedure defines its own middleware chain inline

- **WHEN** a `*.router.ts` file defines a procedure by calling `t.procedure.use(myLocalMiddleware)` without going through a canonical builder
- **THEN** the role-coverage gate reports a violation citing `role-coverage-gate` and CI fails with a non-zero exit code

### Requirement: Gate Compares Builders by Reference Identity

The CI gate MUST verify that a procedure's builder is the same object reference
as one of the 8 canonical builders. A developer who copies a canonical builder's
middleware chain into a new local helper and uses that helper MUST still fail the
gate.

#### Scenario: Local helper replicates canonical builder body

- **WHEN** a `*.router.ts` file constructs a procedure via a local `const myProcedure = t.procedure.use(authMiddleware)` whose middleware chain is byte-for-byte identical to a canonical builder, but is a distinct object
- **THEN** the gate treats it as a non-canonical builder and CI fails citing `role-coverage-gate`

#### Scenario: Re-exported canonical builder passes identity check

- **WHEN** a module re-exports a canonical builder under an alias (`export { leadProcedure as authedProcedure }`) and a router imports that alias
- **THEN** the gate resolves the alias to the original canonical reference, confirms identity, and CI passes
