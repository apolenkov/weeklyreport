## ADDED Requirements

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
