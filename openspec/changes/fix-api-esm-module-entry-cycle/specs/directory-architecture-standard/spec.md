## MODIFIED Requirements

### Requirement: Import boundaries MUST be machine-enforced, each new zone ratcheted

The target structure MUST be locked in `eslint.config.ts` by two mechanisms,
chosen by what a zone matches on. Package-name zones MUST extend the existing
`@typescript-eslint/no-restricted-imports` block: an invariant module's `domain/**`
MUST NOT import `@prisma/client`, `@nestjs/*`, `ioredis`, `bullmq`, or `nodemailer`;
and `packages/ui/**` MUST NOT import `@customreport/shared` domain schemas.
Relative-path zones MUST use the resolver-aware `import-x/no-restricted-paths`
rule from `eslint-plugin-import-x`, with the rule's native `except` option carrying
the ratchet allowlist: `apps/api/src/modules/A/**` MUST NOT import from
`apps/api/src/modules/B/**` except the sibling module's `index.ts` barrel, and
`apps/web/src/features/A/**` MUST NOT import from `apps/web/src/features/B/**`.
Slices meet only in `app/` or `shared/`. API bootstrap and infrastructure files
MAY additionally import an owning module's explicit `module.ts` composition
entry, which MUST export only eager framework wiring and MUST NOT become a
sibling-module contract surface. Suppressing any boundary-zone rule via
`eslint-disable` comments MUST be forbidden; the config-level `except` allowlist is
the only grandfathering mechanism.

The package-level boundaries (`packages/*` not importing from `apps/*`, `shared`
and `ui` not importing each other, `apps/api` not importing `ui` or `web`, and
`apps/web` importing from `apps/api` only type-only) are already owned by the
`lint-max-strictness-standard` spec and MUST NOT be re-declared here. Each new zone
MUST ship ratcheted: existing violations are allowlisted, new ones error, and the
api cross-module zone flips its allowlist to error only in the final migration
slice.

#### Scenario: A cross-module internal import is rejected once the zone flips to error

- **GIVEN** the api cross-module zone (`import-x/no-restricted-paths`) enforced as
  error
- **WHEN** `apps/api/src/modules/weekly-report/*` imports
  `apps/api/src/modules/period/period.prisma-repository.ts`
- **THEN** eslint reports the import as a boundary violation
- **AND** importing the sibling's facade service through
  `apps/api/src/modules/period/index.ts` is allowed
- **AND** importing `apps/api/src/modules/period/module.ts` from that sibling is
  rejected
- **AND** an `eslint-disable` comment on the violating import is itself reported,
  not honoured

#### Scenario: API bootstrap imports an explicit module composition entry

- **GIVEN** `apps/api/src/app.module.ts` composes the Nest module graph
- **WHEN** it imports `PeriodModule` from `apps/api/src/modules/period/module.ts`
- **THEN** eslint accepts the public composition entry
- **AND** importing any other period internal path remains an error

#### Scenario: A new zone lands green by grandfathering existing violations

- **GIVEN** a newly added boundary zone with N pre-existing violations
- **WHEN** the zone is introduced in the enforcement-ratchet slice
- **THEN** those N sites are allowlisted in the zone's config-level allowlist and
  `pnpm lint` stays green
- **AND** any new import of a non-grandfathered internal path is reported as an error
- **AND** grandfathered paths are scoped per target-module zone entry and shrink
  monotonically; entries are only ever removed as violations are fixed, never added
  or broadened

#### Scenario: A domain file importing an adapter dependency is rejected

- **GIVEN** the api domain-purity zone
- **WHEN** a file under `period/domain/**` imports `@prisma/client` or
  `@nestjs/common`
- **THEN** eslint reports it, enforcing that deleting Nest/Prisma leaves the domain
  compiling
