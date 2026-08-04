# role-type Specification

## Purpose

Keep role vocabularies in one shared source per session and persistence axis, with schema-derived membership guards and a single presentation label source.

## Requirements

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
commented literal mirror pointing at this spec. The plain-Node catalog parser
(`e2e/sweep/catalog-parser.ts`, compiled by the root `tsconfig.scripts.json`
with empty workspace paths) keeps one value mirror for its direct Node entry
point; Playwright/e2e TypeScript sources use the shared `Role`/`DbRole` types
through `e2e/tsconfig.json`. Role tokens in catalog YAML are behavioral data.
The two shared Zod enums MUST
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

### Requirement: Role labels have one presentation source

Every UI surface that renders a human-readable role name MUST look it up
from `ROLE_LABEL` (`packages/shared/src/schemas/auth.ts`, re-exported at
`apps/web/src/app/login-page-roles.ts`) rather than declaring its own
role→label mapping or rendering the raw role token styled to look like a
label (e.g. CSS `text-transform`/`capitalize` on the literal value).

#### Scenario: a component renders a role name

- **WHEN** a component needs to display a role to a user (navigation
  identity, an admin filter/option list, a badge, a table cell)
- **THEN** it imports and reads `ROLE_LABEL[role]` instead of switching on
  the role token itself or re-declaring the label text
- **AND** the rendered text is identical across every surface for the same
  role

### Requirement: Role-membership guards derive from the shared schema

Runtime role-membership checks (`isRole`, `VALID_ROLES`, and equivalents) MUST
derive their accepted value set from `sessionRoleSchema.options` (or an
equivalent schema-backed check, e.g. `sessionRoleSchema.safeParse`) rather
than hand-writing the four-role literal list a second time. A field typed
as bare `string` where the value is actually role-provenanced MUST be
retyped to `Role` or `DbRole` per the axis rule above.

#### Scenario: the session role set changes

- **WHEN** `sessionRoleSchema`'s enum members change
- **THEN** every schema-derived guard (`isRole`, `VALID_ROLES`) accepts the
  new set without a corresponding hand-edit, because the guard reads the
  schema rather than mirroring it
