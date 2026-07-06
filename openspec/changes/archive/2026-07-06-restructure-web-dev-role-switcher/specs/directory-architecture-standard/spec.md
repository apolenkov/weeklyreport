## ADDED Requirements

### Requirement: The dev role-switcher MUST live in `shared/ui`, not a feature slice

`role-switcher.tsx` MUST reside at `apps/web/src/shared/ui/` (filename unchanged
from `components/dev/`). It MUST NOT land in `features/auth/`: its consumer
`shared/ui/navigation/nav-bar.tsx` is in the `shared/` layer, and `shared/` MUST
NOT depend on a `features/` slice, so an `auth`-slice home would create a forbidden
`shared → features` backward import. The `components/dev/` directory MUST NOT
survive. The relocation MUST be behavior-neutral.

#### Scenario: The role-switcher lands in shared, leaving only slides in components

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/shared/ui/role-switcher.tsx` exists
- **AND** `apps/web/src/components/dev/` no longer exists
- **AND** `nav-bar.tsx` imports it from `../role-switcher` (a same-layer import,
  not a `shared → features` edge)
