## ADDED Requirements

### Requirement: The legacy `components/admin` folder MUST dissolve into the `admin`, `period`, `review`, and `organization` slices plus `shared`

The grab-bag `apps/web/src/components/admin/` folder MUST be dissolved into five
canonical homes per the authoritative mapping's `Layer` and `Domain` columns, and
the legacy `components/admin/` directory MUST NOT survive the relocation. All 45
source files (filenames unchanged) MUST land as follows: 20 admin-console
components → `features/admin/ui/` and 5 pure utils/hooks/config
(`action-log-format`, `reminders-form-state`, `reminders-tab-format`,
`reminders-tab-mutations`, `timezone-options`) → `features/admin/model/`; the 10
period-lifecycle components (`periods-*`, `settings-periods-*`) →
`features/period/ui/` and `use-period-mutations` → `features/period/model/`; the 3
`reopen-*` files → `features/review/ui/`; the 3
`settings-identity/integrations/notifications` sub-tabs →
`features/organization/ui/`. Each co-located `*.test.tsx` MUST travel with its
source file (9 → `features/admin/ui/`, `periods-tab.test.tsx` →
`features/period/ui/`). Because three files are consumed across ≥2 slices they MUST
graduate out of the slice tree under rule-of-2 (web): `settings-tab-shared.tsx` and
`tab-count-pill.tsx` → `shared/ui/`, and `mock-data.ts` →
`shared/lib/admin-mock-data.ts` (renamed to avoid colliding with the landed
`shared/lib/dashboard-mock-data.ts`); as `shared/` is not a feature slice these
graduations MUST NOT gain a `webSlices` entry or a barrel. The `admin` slice MUST
be fronted by a `features/admin/index.ts` barrel exporting exactly the symbols its
routes load, but NO slice registers in the `webSlices` array this change: the
cross-slice zone keys on the importer, so registering `admin` while its composition
roots (`admin-panel.tsx`, `settings-tab.tsx`) still import `period`/`review`/
`organization` internals would flag those six imports. Registration of all four
seeded slices is deferred to the change that relocates the composition roots. The
relocation MUST be behavior-neutral (no component logic, props, or rendered output
change).

#### Scenario: Admin-folder files land in their canonical slice segments

- **WHEN** the admin dissolution slice is applied
- **THEN** `features/admin/ui/` holds the 20 admin components with their 9
  co-located `*.test.tsx`, and `features/admin/model/` holds the 5 pure
  utils/hooks/config modules
- **AND** `features/period/ui/` holds the 10 period-lifecycle components (with
  `periods-tab.test.tsx`) and `features/period/model/` holds `use-period-mutations`
- **AND** `features/review/ui/` holds the 3 `reopen-*` files and
  `features/organization/ui/` holds the 3 settings sub-tabs
- **AND** `apps/web/src/components/admin/` no longer exists

#### Scenario: The three ≥2-slice primitives graduate to shared

- **WHEN** the relocation slice is applied
- **THEN** `settings-tab-shared.tsx` and `tab-count-pill.tsx` live under
  `shared/ui/` and the former `mock-data.ts` lives at
  `shared/lib/admin-mock-data.ts`, none inside any `features/<domain>` slice
- **AND** every consumer imports them from those `shared/*` paths, and no
  `webSlices` entry or barrel is introduced for `shared/`

#### Scenario: No slice registers until the composition roots relocate

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array is unchanged by this change — none of `admin`,
  `period`, `review`, `organization` appears yet (each registers with the change
  that relocates the composition roots off their cross-slice internal imports)
- **AND** the two `app/(app)/admin/*` routes import their symbols from the
  `features/admin` barrel, and the six repointed exemptions reference the
  `features/admin/ui/*` and `shared/lib/admin-mock-data.ts` paths, not the legacy
  `components/admin/*` paths

#### Scenario: Composition roots reach seeded-but-unregistered slices by direct import

- **WHEN** `admin-panel.tsx` and `settings-tab.tsx` render the period, review, and
  organization sub-tabs
- **THEN** they import them by direct recomputed-relative path into the
  `features/{period,review,organization}/ui/*` files
- **AND** because those slices carry no `webSlices` entry this change, the imports
  trip no cross-slice zone (they convert to sibling-barrel imports when those
  slices register in their completing change)
