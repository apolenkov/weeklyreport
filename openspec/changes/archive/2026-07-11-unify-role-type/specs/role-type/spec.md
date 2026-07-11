## ADDED Requirements

### Requirement: The role vocabulary has one source of truth per axis

The workspace MUST expose exactly two role contracts, both in
`packages/shared` (`schemas/auth.ts`): `roleSchema` with its inferred
`DbRole` type for the persistence axis, and `sessionRoleSchema` with its
inferred `Role` type for the session axis. The
`"lead" | "head" | "admin" | "viewer"` literal union MUST NOT be re-declared
in any other type position in workspace source; consumers MUST import the
axis-appropriate shared type — `Role` for session-sourced values, `DbRole`
for persistence-sourced values (admin user models, `authorRole` read-model
mirrors, Prisma-sourced dev tooling rows, dev-login request payloads).
Compositions (`Role | null`, records keyed by a shared type) and deliberate
narrower subsets remain legal. Exemptions: runtime validators and
presentation-ordered lists may enumerate role VALUES while typing them from
shared; the Prisma seed toolchain (`prisma/`, compiled by
`tsconfig.prisma.json`, which cannot resolve workspace packages) keeps one
commented literal mirror pointing at this spec; the e2e tree
(isolated tsconfig without workspace resolution) stays self-contained; role
tokens in catalog YAML are behavioral data. The two shared Zod enums MUST
stay as two separate literal homes — collapsing one into the other would
remove the deliberate room for the axes to diverge.

#### Scenario: a new declaration needs a role type

- **WHEN** a maintainer types a role-valued field or variable outside
  `packages/shared`
- **THEN** they import `Role` or `DbRole` from `@customreport/shared`
  according to the value's provenance instead of re-declaring the union
- **AND** the residual sweep (all member orders plus `z.enum` forms) finds
  no type-position re-declaration outside the named exemptions

#### Scenario: the axes diverge

- **WHEN** a role value is added to one axis only
- **THEN** every cross-axis site (session value written to a persistence
  position or vice versa) surfaces as a compile-time error rather than a
  silent widening

### Requirement: The shared DbRole matches the database enum

The shared `DbRole` type MUST stay value-identical to Prisma's generated
`$Enums.Role`, pinned by a type-identity test in `apps/api`
(`expectTypeOf<DbRole>().toEqualTypeOf<$Enums.Role>()`). The session `Role`
type MUST NOT be pinned equal to `DbRole` or to the Prisma enum — the
two-alias design deliberately preserves their freedom to diverge; runtime
guard parity with `sessionRoleSchema.options` is pinned by tests instead.

#### Scenario: the Prisma enum changes

- **WHEN** a migration alters Prisma's `Role` enum without updating
  `roleSchema`
- **THEN** the identity test fails, naming the drifted member

#### Scenario: a session guard drifts

- **WHEN** `sessionRoleSchema` gains a member that a runtime guard
  (`isRole`, the last-role storage validator) does not accept
- **THEN** the guard parity tests fail
