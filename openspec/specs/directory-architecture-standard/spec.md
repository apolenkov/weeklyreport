# directory-architecture-standard Specification

## Purpose

Machine-enforced placement rules for the repo source tree. API modules keep
domain/application/infrastructure splits only where the module invariants justify
them; web domain slices live under `features/<domain>` behind per-slice import
boundaries; business-agnostic web primitives live under `shared/`; and legacy flat
`components/` folders do not survive relocation. Grown one requirement per landed
restructure slice (parent change: restructure-directory-architecture).

## Requirements

### Requirement: Every source file's home MUST be a deterministic function of two axes

Every file under `apps/*/src` and `packages/*/src` MUST have exactly one correct
location, computed as a pure function of two ordered axes: domain first, then
layer/segment. Axis 1 (domain) MUST use the canonical domain vocabulary in
`docs/architecture/TARGET-STRUCTURE-2026-07-02.md` (Grouping rules): the finer,
overlapping catalog labels (`lead-form`, `report`, `report-sections`, `period`)
MUST be collapsed to their canonical domain (for example, `report-sections` /
`period`), never lifted as-is. Ambiguous cases MUST resolve via the five
determinism knobs (shared/slice promotion: web rule-of-2, api rule-of-3; api
internal-split trigger; contracts-vs-presentation; routing-vs-feature;
pure-vs-adapter), so two reviewers independently place the same file identically.
On the web, rule-of-2 is forced rather than stylistic: cross-slice imports
(`features/A` to `features/B`) are banned, so a helper needed by a second slice has
no legal home inside either slice and MUST graduate to `src/shared/` at that
second consumer. An api helper graduates to `src/lib/` only at the third module
consumer, because two api modules may lawfully meet through a facade barrel.

#### Scenario: A finer catalog label collapses to its canonical domain

- **GIVEN** a component whose catalog `domain` column reads `lead-form`
- **WHEN** it is assigned a home under the two-axis rule
- **THEN** it lands in the `report-sections` slice, not a new `lead-form` slice
- **AND** a file labelled `periods` lands in `period`, and `reopen` lands in `review`

#### Scenario: A web helper graduates to shared at its second slice consumer

- **GIVEN** a web helper living in `features/landing/` that a second slice
  (`features/search/`) now needs
- **WHEN** its home is decided
- **THEN** it graduates to `src/shared/`
- **AND** importing it across `features/A` to `features/B` is rejected as a
  cross-slice dependency

#### Scenario: An api helper stays in its module until a third module consumer

- **GIVEN** an api helper imported by exactly two modules
- **WHEN** its home is decided
- **THEN** it stays in its origin module, with the second module reaching it through
  the origin module's facade barrel
- **AND** it graduates to `src/lib/` only when a third module needs it

### Requirement: Layer and domain placement MUST follow the per-app target tree

`apps/api` MUST keep the `modules/<domain>/` plus top-level `infrastructure/`
shape. The `domain/`, `application/`, and `infrastructure/` sub-split MUST appear
only inside invariant-bearing modules (`period`, `report-sections`, `review`,
`publication`) or a module exceeding roughly six files. Moderate modules
(`admin`, `auth`, `carry-over`, `weekly-report`, `archive`, `reminders`,
`pdf-export`) MUST stay flat with an explicit port where a repository exists. Thin
CRUD modules (`activity`, `project-activity`, `email`, `observability`, `search`,
`telemetry`, `organization`, `analytics`, `telegram`) MUST stay flat with
`X.service.ts` and `X.prisma-repository.ts` at the module root.

`apps/web` MUST split into three zones: `app/` holds routing only; `features/<domain>/`
holds slices with colocated `ui/`, `model/`, and `api/`; and `shared/` holds the
business-agnostic web layer. A web slice `index.ts` barrel is optional and minimal:
added only when another slice or route consumes the slice, with few real entry
exports and type-only type exports. App-level and repo-root mega-barrels are
forbidden; api module facade barrels remain mandatory. The web MUST NOT introduce
an `entities/` layer nor a web-side `shared/ui` re-implementation, because
`packages/shared` and `packages/ui` already own those; there MUST remain exactly
two packages.

#### Scenario: An invariant module carries the full internal split

- **GIVEN** the `period` module, which bears the atomic dual-state period write
- **WHEN** its files are placed under the layer axis
- **THEN** pure `period-transition.ts` lands in `domain/`, `period.service.ts` and
  its `PeriodRepository` port land in `application/`, and
  `period.prisma-repository.ts` lands in `infrastructure/`

#### Scenario: A thin module stays flat

- **GIVEN** the `activity` module, which bears no load-bearing invariant and is
  under roughly six files
- **WHEN** its files are placed
- **THEN** it keeps `activity.service.ts` and `activity.prisma-repository.ts` at
  the module root
- **AND** it grows no `domain/application/infrastructure` subfolders

#### Scenario: A web feature slice colocates its segments while app stays routing-only

- **GIVEN** the lead report-sections feature
- **WHEN** its files are placed
- **THEN** its components land in `features/report-sections/ui/`, its
  autosave/visibility hooks and view-mappers in `features/report-sections/model/`,
  and its tRPC call wrappers in `features/report-sections/api/`, exposed through
  `features/report-sections/index.ts`
- **AND** the corresponding `app/` route stays a thin `page.tsx` that imports the
  slice and holds no data logic

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
Slices meet only in `app/` or `shared/`. Suppressing any boundary-zone rule via
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
  `apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`
- **THEN** eslint reports the import as a boundary violation
- **AND** importing the sibling's facade service through
  `apps/api/src/modules/period/index.ts` is allowed
- **AND** an `eslint-disable` comment on the violating import is itself reported,
  not honoured

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

### Requirement: Each migration slice MUST be behavior-neutral and gated on a clean target folder

The migration MUST proceed as ordered, independently shippable OpenSpec changes:
enforcement baseline, pinned `landing` leaf web slice, remaining web slices, api
internal hexagon slice covering `period`, `report-sections`, `review`, and
`publication`, api infra ports, then api cross-module facade reroute. Every slice
MUST be behavior-neutral: no product-logic change, only relocation, import fixes,
eslint-exemption edits, and barrels where the standard requires one. Every slice
MUST land with the full unit gate green; the api cross-module slice additionally
MUST pass the single-thread integration gate (`pnpm test:integration`, with
postgres and redis up). Because folders are frequently dirty under parallel
sessions, each slice MUST verify a clean `git status` for its target folder before
moving any file, and stage only its own paths.

#### Scenario: A slice is deferred when its target folder is dirty

- **GIVEN** the `landing` slice is next but `apps/web/src/components/landing/` has
  uncommitted changes from a parallel session
- **WHEN** the slice would begin
- **THEN** it is deferred until `git status` for that folder is clean
- **AND** no file is relocated while the folder is dirty

#### Scenario: The cross-module reroute slice runs the integration gate

- **GIVEN** the final api slice, which reroutes deep cross-module imports to facades
  and flips the cross-module zone to error
- **WHEN** it is validated as done
- **THEN** the full unit gate and `pnpm test:integration` are green
- **AND** the atomic dual-state period write is exercised through a
  `withTransaction`/UnitOfWork seam, not a leaked `Prisma.TransactionClient`

### Requirement: The web analytics domain MUST live in the `features/analytics` slice

The three analytics chart components MUST reside in
`apps/web/src/features/analytics/ui/` (filenames unchanged from the legacy
`apps/web/src/components/charts/` tree), and the legacy `components/charts/`
directory MUST NOT survive the relocation. Each chart's data-shaping builder
(`buildLeadVelocityChartData`, `buildTrafficLightHistoryChartData`) MUST travel
co-located with its component in the slice `ui/` segment — the rule-of-2 (web)
promotion to `src/shared/` is unmet (no second-slice consumer), so nothing
graduates. The Trends route is the slice's only consumer and its `next/dynamic`
loaders MUST import concrete chart modules directly, as owned by
`web-loading-performance`; an unused public barrel MUST NOT be kept solely for a
hypothetical static consumer. If an ordinary static consumer is introduced, the
optional slice barrel rule applies at that point. The `analytics` slice MUST be listed in the
`webSlices` array in `eslint.config.ts` so its cross-slice import boundary is
machine-enforced, and the relocation MUST be behavior-neutral (no component
logic, props, or rendered output change).

#### Scenario: Analytics charts land in the slice ui segment

- **WHEN** the analytics relocation slice is applied
- **THEN** `apps/web/src/features/analytics/ui/` contains
  `lead-velocity.chart.tsx`, `period-comparison.chart.tsx`, and
  `traffic-light-history.chart.tsx` with their co-located `charts.test.tsx`
- **AND** `apps/web/src/components/charts/` no longer exists
- **AND** each chart-data builder lives beside its component (not in `src/shared/`)

#### Scenario: Code-split consumers reach concrete chart modules

- **WHEN** the Trends route loads chart components
- **THEN** it imports concrete chart modules only inside its
  `next/dynamic` code-split loaders
- **AND** no unused `features/analytics/index.ts` barrel exists
- **AND** no code outside the slice imports `components/charts/*`

#### Scenario: The analytics slice boundary is machine-enforced

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** `analytics` appears in the `webSlices` array
- **AND** an import from `features/analytics` into another web slice's internals
  is reported as an error by the cross-slice zone

### Requirement: App-wide navigation chrome MUST live in the `shared/ui/navigation` layer

Business-agnostic, app-wide web chrome MUST reside in `apps/web/src/shared/`, not
in any `features/<domain>` slice. Concretely, the navigation bar and its
hydration skeleton MUST reside in `apps/web/src/shared/ui/navigation/`
(`nav-bar.tsx`, `nav-bar-skeleton.tsx`, filenames unchanged from the legacy
`apps/web/src/components/navigation/` tree), and the legacy
`components/navigation/` directory MUST NOT survive the relocation. Because nav
chrome is mounted app-wide (`app/(app)/layout.tsx`) and owned by no single domain
slice, it graduates to `shared/ui/` rather than `features/<domain>/ui/`; no
feature slice may claim it. A consumer MUST import the components directly from
`shared/ui/navigation/*` — no public-API barrel is introduced, as
`TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`. `shared/` is not
a feature slice, so the `webSlices` cross-slice boundary in `eslint.config.ts`
MUST NOT gain a navigation entry. The relocation MUST be behavior-neutral (no
component logic, props, or rendered output change).

#### Scenario: Navigation chrome lands in the shared ui layer

- **WHEN** the navigation relocation is applied
- **THEN** `apps/web/src/shared/ui/navigation/` contains `nav-bar.tsx`,
  `nav-bar-skeleton.tsx`, and the co-located `nav-bar.test.tsx`
- **AND** `apps/web/src/components/navigation/` no longer exists
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: The layout consumer imports nav chrome directly from shared

- **WHEN** the `app/(app)/layout.tsx` root layout renders the nav chrome
- **THEN** it imports `NavBar` and `NavBarSkeleton` from
  `shared/ui/navigation/*` directly (no barrel)
- **AND** no code outside `shared/ui/navigation/` imports `components/navigation/*`

#### Scenario: The shared layer is not registered as a feature slice

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `navigation` entry
- **AND** the two path-pinned lint exemptions for `nav-bar.tsx` reference the
  `shared/ui/navigation/` path, not the legacy `components/navigation/` path

### Requirement: The web dashboard domain MUST live in the `features/dashboard` slice with real model ownership

The maintained dashboard UI and its presentation models MUST reside under
`apps/web/src/features/dashboard/ui/` and
`apps/web/src/features/dashboard/model/`. The legacy
`apps/web/src/components/dashboard/` tree and the former
`apps/web/src/shared/lib/dashboard-mock-data.ts` module MUST NOT exist. Dashboard
types and mappings MUST derive from the real query read models inside the
dashboard slice rather than from a shared mock-data contract. A route or
other-slice consumer MUST reach the slice only through
`apps/web/src/features/dashboard/index.ts`, whose public surface for route
composition is `DashboardPage`; intra-slice sibling imports MUST stay relative
and MUST NOT round-trip through the barrel. The `dashboard` slice MUST remain in
the enforced web-slice boundary set.

#### Scenario: Dashboard UI and models stay in their owned segments

- **WHEN** the maintained dashboard source inventory is checked
- **THEN** dashboard presentation components are under `features/dashboard/ui/`
- **AND** dashboard mappings and presentation types are under `features/dashboard/model/`
- **AND** the legacy `components/dashboard/` directory does not exist

#### Scenario: Dashboard contracts come from real models

- **WHEN** dashboard UI code imports its display types and mappings
- **THEN** it resolves them from the dashboard model segment or canonical shared API contracts
- **AND** no dashboard or weekly-report consumer imports a dashboard mock-data module

#### Scenario: Consumers reach the slice through the barrel

- **WHEN** the `/head/dashboard` route loads the dashboard composition root
- **THEN** it imports `DashboardPage` from `features/dashboard`
- **AND** the dashboard barrel exports the route composition root without exposing slice internals

#### Scenario: The dashboard slice boundary is machine-enforced

- **WHEN** the web import-boundary configuration is evaluated
- **THEN** `dashboard` is part of the enforced feature-slice set
- **AND** an import from another web slice into dashboard internals is rejected

### Requirement: Report-shell UI primitives MUST live in the `shared/ui/report-shell` layer

Business-agnostic report-shell UI primitives MUST reside in
`apps/web/src/shared/ui/report-shell/`, not in any `features/<domain>` slice and
not in the legacy flat `apps/web/src/components/report-shell/` tree. The whole
legacy folder is flat-renamed: every source file — the eleven mapped primitives
(`accordion-section`, `agent-review-coming-soon`, `archive-toggle`, `lock-badge`,
`meta-row`, `report-toolbar`, `save-now-button`, `scope-toggle`,
`segmented-toggle`, `toolbar-icon-button`, `view-mode-toggle`) plus the
post-catalog additions `rotating-chevron` and `use-report-shell-url-state` — its
co-located tests, and the `__snapshots__/` directory MUST move together, filenames
unchanged, and the legacy `components/report-shell/` directory MUST NOT survive
the relocation. Because these primitives are consumed across lead, head, viewer,
weekly-report, slides, and the dashboard slice and are owned by no single domain,
they graduate to `shared/ui/` rather than `features/<domain>/ui/`; no feature
slice may claim them, and the `webSlices` cross-slice boundary in
`eslint.config.ts` MUST NOT gain a report-shell entry. Consumers MUST import the
primitives directly from `shared/ui/report-shell/*` — no public-API barrel is
introduced, as `TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`.
The relocation MUST be behavior-neutral (no component logic, props, or rendered
output change).

#### Scenario: Report-shell primitives land in the shared ui layer

- **WHEN** the report-shell relocation is applied
- **THEN** `apps/web/src/shared/ui/report-shell/` contains all thirteen source
  files (the eleven mapped primitives plus `rotating-chevron.tsx` and
  `use-report-shell-url-state.ts`), every co-located `*.test.tsx`/`*.test.ts`, and
  the `__snapshots__/` directory
- **AND** `apps/web/src/components/report-shell/` no longer exists
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: Consumers import report-shell primitives directly from shared

- **WHEN** any surface (lead, head, viewer, weekly-report, slides, dashboard, or a
  route) renders a report-shell primitive
- **THEN** it imports the component from `shared/ui/report-shell/*` directly (no
  barrel), with the relative path recomputed from the consumer's own location
- **AND** no code outside `shared/ui/report-shell/` imports the legacy
  `components/report-shell/*` path

#### Scenario: Moved files' cross-directory imports are recomputed, not merely deepened

- **WHEN** `lock-badge.tsx` and `save-now-button.tsx` are relocated
- **THEN** `lock-badge.tsx` imports `sdlc-tooltip` from
  `../feedback/sdlc-tooltip`
- **AND** `save-now-button.tsx` declares the minimal structural state contract
  required by the shared primitive instead of importing a feature-owned type
- **AND** intra-folder `./`-relative imports between the moved files stay valid
  unchanged

#### Scenario: The shared layer is not registered as a feature slice and needs no lint exemption

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `report-shell` entry
- **AND** no path-pinned size/complexity exemption references any report-shell
  file (none existed for the legacy path, and the flat rename introduces none)

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

### Requirement: Rule-of-2 leaf UI components MUST live in `shared/ui`, not a feature slice

A business-agnostic web UI component consumed by more than one domain MUST reside
in `apps/web/src/shared/ui/`, not in any `features/<domain>` slice — the web
rule-of-2. Concretely, the global search box `search-input.tsx` (consumed by the
`reports` route and the `admin` slice) and the role-guard render wrapper
`if-role.tsx` (consumed by the `dashboard` slice beside the `auth` domain) MUST
reside at `apps/web/src/shared/ui/search/search-input.tsx` and
`apps/web/src/shared/ui/auth-runtime/if-role.tsx` (filenames unchanged from the legacy
`components/search/` and `components/auth/` trees), and those legacy directories
MUST NOT survive the relocation. Consumers MUST import each component directly
from `shared/ui/*` — no public-API barrel is introduced, as
`TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`. Because `shared/`
is not a feature slice, the `webSlices` cross-slice boundary in `eslint.config.ts`
MUST NOT gain a `search` or `auth` entry, and promoting these leaves to `shared/`
removes the admin→search and dashboard→auth cross-slice imports rather than
allowlisting them. The relocation MUST be behavior-neutral.

#### Scenario: Both leaves land in the shared ui layer

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/shared/ui/search/` and `apps/web/src/shared/ui/auth-runtime/`
  contain `search-input.tsx`, `if-role.tsx`,
  and their co-located `*.test.tsx`
- **AND** `apps/web/src/components/search/` and `apps/web/src/components/auth/`
  no longer exist
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: Consumers import the leaves directly from shared

- **WHEN** the `reports` route, the `admin` products tab, or the `dashboard`
  alert bar renders these components
- **THEN** it imports `SearchInput` / `IfRole` from `shared/ui/*` directly (no barrel)
- **AND** no code imports `components/search/*` or `components/auth/*`

#### Scenario: The shared layer is not registered as a feature slice

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `search` or `auth` entry
- **AND** no cross-slice allowlist entry is added for admin→search or dashboard→auth

### Requirement: Review comment UI MUST form one cohesive review-owned family

The display-only review comment list and its two consumers MUST reside together
under `apps/web/src/features/review/ui/comments/`. The legacy
`components/review/` directory MUST NOT survive the relocation. This keeps the
review vocabulary in its owning feature and avoids a generic shared bucket for
domain-specific UI. The relocation MUST be behavior-neutral.

#### Scenario: The comment family lands in the review slice

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/features/review/ui/comments/review-comment-list.tsx` exists
- **AND** `record-comments.tsx` and `lead-review-feedback.tsx` are co-located with it
- **AND** `apps/web/src/components/review/` no longer exists
- **AND** no review-comment implementation is duplicated under `shared/`

#### Scenario: Both consumers use the co-located review implementation

- **WHEN** `record-comments` or `lead-review-feedback` renders the comment list
- **THEN** it imports `ReviewCommentList` within the review comments family
- **AND** no code imports `components/review/*`

### Requirement: The lead domain MUST dissolve into its canonical slices, not a `features/lead` slice

The legacy `apps/web/src/components/lead/` tree MUST NOT survive as a single
`features/lead` slice. Page-level lead form composition MUST live under
`features/report-pages/ui/lead/`. Reusable report-section UI primitives and
domain model MUST live under `features/report-sections/{ui,model}`; period
navigation and SDLC-pipeline files MUST live under `features/period/{ui,model}`;
risk/review files under `features/review/ui`; `pdf-export-coming-soon` under
`features/pdf-export/ui`; `version-coming-soon` under `features/admin/ui`; and
the generic `confirm-delete-dialog` under `shared/ui/dialogs/` (rule-of-2). The
relocation MUST be behavior-neutral.

The kernel files with wide external fan-in (`stage-tags`, `stage-chip-config`)
MUST reside in `features/report-sections/model/`, not `shared/`, because they
encode report-section domain logic rather than business-agnostic helpers.
Consumers outside the slice MUST use the `features/report-sections` facade
rather than importing its internals.

#### Scenario: components/lead no longer exists

- **WHEN** the lead relocation is applied
- **THEN** `apps/web/src/components/lead/` no longer exists
- **AND** every former lead file resides under `features/<domain>/{ui,model}/` or
  `shared/ui/` per the mapping, with its filename unchanged

#### Scenario: report-sections becomes a slice, unblocking dependents

- **WHEN** the relocation is applied
- **THEN** `features/report-sections/` owns reusable report-section model and UI
  primitives behind its facade
- **AND** lead, weekly, and Head page assemblies live in `features/report-pages`
- **AND** `viewer-report-shell` lives in `features/viewer`

#### Scenario: kernel files are report-sections model, not shared

- **WHEN** a consumer outside the report-sections slice uses `stage-tags` or
  `stage-chip-config`
- **THEN** the implementations reside in `features/report-sections/model/*`
- **AND** the consumer reaches the required export through the
  `features/report-sections` facade
- **AND** none of these kernel files resides under `shared/`

### Requirement: The viewer report shell MUST form its own `features/viewer` slice

`viewer-report-shell.tsx` MUST reside at `apps/web/src/features/viewer/ui/`
(filename unchanged from `components/viewer/`), as `viewer` is a standalone
canonical domain in the grouping rules. The legacy `components/viewer/` directory
MUST NOT survive. Its route consumer under `app/(app)/reports/[reportId]/` MUST
import it through the `features/viewer` public facade. The relocation MUST be
behavior-neutral.

#### Scenario: The viewer shell forms the viewer slice

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/features/viewer/ui/viewer-report-shell.tsx` exists
- **AND** `apps/web/src/components/viewer/` no longer exists
- **AND** the reports viewer route imports it from the `features/viewer` facade

### Requirement: The weekly-report tree MUST dissolve into its canonical slices

The legacy `apps/web/src/components/weekly-report/` tree MUST NOT survive as a
`features/weekly-report` slice. Page-level weekly report composition — including
`weekly-report-page`, `weekly-report-skeleton`, and `product-accordion` — MUST
live under `features/report-pages/ui/`. Reusable assembled-report primitives
such as `activity-status-strip` and `portfolio-overview-table` MUST live under
`features/report-sections/ui/`; their pure projection and grouping model MUST
live under `features/report-sections/model/`. Export, period-lifecycle, and
review-owned controls MUST live under their respective feature slices. The
relocation MUST be behavior-neutral, and the legacy tree MUST NOT survive it.

#### Scenario: components/weekly-report no longer exists

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/components/weekly-report/` no longer exists
- **AND** each former file resides under its canonical feature owner

#### Scenario: consumers import the assembled report from report-pages

- **WHEN** the Head or viewer report shell renders the weekly report page
- **THEN** the Head same-slice composition imports `WeeklyReportPage` through a
  relative module path within `features/report-pages`
- **AND** the viewer shell imports `WeeklyReportPage` from the
  `features/report-pages` facade
- **AND** `features/report-pages` consumes report-section model and primitives
  through the `features/report-sections` facade
- **AND** no code imports `components/weekly-report/*`

### Requirement: Business-agnostic web primitives MUST live in `shared/`, not the `components/` root

The flat `apps/web/src/components/` root MUST NOT hold business-agnostic UI
primitives. `error-boundary`, `forbidden-page`, `role-gate`, `agentation-devtools`,
the `coming-soon-style` source-scan test, and the former `components/ui/` bucket
(`confirmation-dialog`, `sdlc-tooltip`) MUST reside under their cohesive
`apps/web/src/shared/ui/dialogs/` and `apps/web/src/shared/ui/feedback/` families.
`web-vitals-reporter` MUST reside in its own `features/telemetry/ui/` slice. The
`components/ui/` and `components/__snapshots__/` directories MUST NOT survive. After
this change, `components/` retains only the deferred `slides/` tree and the `dev/`
tooling (its own later slice). The relocation MUST be behavior-neutral.

#### Scenario: Primitives graduate to shared

- **WHEN** the relocation is applied
- **THEN** `error-boundary`, `forbidden-page`, `role-gate`, and `agentation-devtools`
  reside under `apps/web/src/shared/ui/auth-runtime/`
- **AND** `confirmation-dialog` and `sdlc-tooltip` reside under
  `apps/web/src/shared/ui/dialogs/` and `apps/web/src/shared/ui/feedback/`
- **AND** `web-vitals-reporter` resides under `apps/web/src/features/telemetry/ui/`
- **AND** `apps/web/src/components/ui/` no longer exists
- **AND** consumers import each from its new home, with no `components/` root primitive left

#### Scenario: A relocated source-scan test keeps scanning the whole tree

- **WHEN** `coming-soon-style.test.tsx` runs from its new `shared/ui/` home
- **THEN** its filesystem `repoRoot` and control-file path anchors account for the
  deeper location, so it still scans `apps/web/src` + `packages/ui/src`

### Requirement: The dev role-switcher MUST live in the shared auth-runtime family

`role-switcher.tsx` MUST reside at `apps/web/src/shared/ui/auth-runtime/` (filename unchanged
from `components/dev/`). It MUST NOT land in `features/auth/`: its consumer
`shared/ui/navigation/nav-bar.tsx` is in the `shared/` layer, and `shared/` MUST
NOT depend on a `features/` slice, so an `auth`-slice home would create a forbidden
`shared → features` backward import. The `components/dev/` directory MUST NOT
survive. The relocation MUST be behavior-neutral.

#### Scenario: The role-switcher lands in shared, leaving only slides in components

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/shared/ui/auth-runtime/role-switcher.tsx` exists
- **AND** `apps/web/src/components/dev/` no longer exists
- **AND** `nav-bar.tsx` imports it from `../auth-runtime/role-switcher` (a same-layer import,
  not a `shared → features` edge)

### Requirement: The lib/mappers tree MUST dissolve into each slice's model dir

The legacy `apps/web/src/lib/mappers/` tree MUST NOT survive as a shared mapper
barrel. Each mapper file MUST relocate to the `model/` dir of the domain that owns
it, per the 2026-07-02 relocation mapping (archived out of the repo): the admin mappers
(`admin`, `admin-form-inputs`, `admin-types`) under `features/admin/model`; the
dashboard mappers (`dashboard`, `dashboard-counts`, `dashboard-escalations`,
`dashboard-kpi`, `dashboard-leads`) under `features/dashboard/model`; and the
report-translation core (`item-status`, `lead-cross-author`, `lead-form`,
`lead-history`, `lead-status`, `report-content`, `traffic-light`, `weekly-report`,
`weekly-report-groupers`, `weekly-report-types`) under
`features/report-sections/model`. The `index.ts` barrel MUST be deleted and each
consumer MUST import from the concrete owning `model/` file. The relocation MUST be
behavior-neutral, and the `lib/mappers/` tree MUST NOT survive it.

#### Scenario: lib/mappers no longer exists

- **WHEN** the dissolution is applied
- **THEN** `apps/web/src/lib/mappers/` no longer exists
- **AND** each former mapper resides under `features/<domain>/model/` per the mapping

#### Scenario: consumers import mappers from the owning slice, not a barrel

- **WHEN** any file consumes a mapper symbol
- **THEN** it imports that symbol from the concrete `features/<domain>/model/*` file
- **AND** no code imports `lib/mappers` or a `lib/mappers/*` path

### Requirement: Every populated web slice MUST be enforced in `webSlices`

Once the FSD-lite relocation has settled, EVERY populated `features/<slice>` MUST
appear in the `webSlices` array in `eslint.config.ts`, so that a slice reaching
into another slice's internals is a lint error. The enforced set MUST cover all
populated slices. Cross-slice consumers MUST use the sibling's public `index.ts`
facade or its explicit client-only `client.ts` entrypoint; server entrypoints are
not valid feature-to-feature dependencies. No slice-pair grandfathering is allowed.

#### Scenario: an unlisted cross-slice import is rejected

- **WHEN** a file under `features/analytics` imports from another slice's internals
  (e.g. `features/admin/ui/admin-panel`)
- **THEN** `import-x/no-restricted-paths` reports a web-slice-boundary error

#### Scenario: an explicit sibling facade is permitted

- **WHEN** a file under `features/viewer` imports from `features/report-sections`
  or `features/report-sections/client`
- **THEN** no boundary error is reported
- **AND** an import from any deeper report-sections path is rejected

#### Scenario: the enforced set is complete

- **WHEN** the boundary is flipped
- **THEN** every populated `features/<slice>` appears in `webSlices`
- **AND** no populated slice is left unenforced

### Requirement: The slide deck MUST form the `features/slides` slice and `components/` MUST NOT survive

The status-slide presentation deck MUST live in a `features/slides` slice, NOT
under `apps/web/src/components/`. Pure grid/view-model files MUST sit in
`features/slides/model/` and the rendering components in `features/slides/ui/`. The
`slides` slice MUST be registered in the `webSlices` enforcement array with its
cross-slice edges grandfathered. After this relocation the
`apps/web/src/components/` directory MUST NOT exist — every web domain lives in a
`features/` slice or `shared/`.

#### Scenario: components/ no longer exists

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/components/` no longer exists
- **AND** the former slide files reside under `features/slides/{ui,model}/`

#### Scenario: consumers import the deck from the slides slice

- **WHEN** the head/lead/viewer report shells render the slide deck
- **THEN** they import it from `features/slides/ui/*`
- **AND** no code imports `components/slides/*`

#### Scenario: the slides slice boundary is enforced

- **WHEN** a file outside `features/slides` imports a slides internal, or slides
  imports another slice's internal, without a grandfathered `except` entry
- **THEN** `import-x/no-restricted-paths` reports a web-slice-boundary error

### Requirement: The runtime import graph MUST be acyclic and gated

The module graph of `apps/api/src`, `apps/web/src`, `packages/shared/src`, and `packages/ui/src` MUST contain zero runtime circular dependencies (`pnpm depcruise` — type-only imports excluded by config), and the check MUST run as part of `pnpm lint` so a new cycle fails the active gate.

#### Scenario: A new runtime cycle is introduced

- **WHEN** a change adds a value import that closes a cycle between two modules
- **THEN** `pnpm lint` (via depcruise) fails locally and in pre-push before the change can land

### Requirement: Page assemblies live in `features/report-pages`; `report-sections` stays a pure lower floor

`features/report-sections` MUST export only report-domain model and primitive UI with no runtime imports of sibling slices; page-level compositions (lead form family, weekly report page family, head report shell, product accordion) MUST live in `features/report-pages`, which MAY depend on admin/period/report-sections/review/slides but MUST NOT be imported by them.

#### Scenario: A base slice reaches into report-pages

- **WHEN** a file under `features/{admin,period,report-sections,review,slides}` imports from `features/report-pages`
- **THEN** the depcruise/eslint boundary gate fails the change

### Requirement: Published report-section projections MUST be owned behind the report-sections facade

The published snapshot builder, snapshot parser/filter, portfolio projection, and escalation projection MUST reside inside the `apps/api/src/modules/report-sections/` boundary. API modules outside `report-sections` MUST consume these projections only through `apps/api/src/modules/report-sections/index.ts`. No root-level projection exception under `apps/api/src/modules/` MAY remain in the cross-module boundary configuration.

#### Scenario: A publication consumer reaches the snapshot through the facade

- **WHEN** the publication repository builds or persists a published snapshot
- **THEN** it imports the required projection from `modules/report-sections/index.ts`
- **AND** it does not import a report-sections internal file or a loose module-root projection

#### Scenario: All temporary projection exceptions are removed

- **WHEN** the API cross-module boundary configuration is evaluated
- **THEN** no exception names `published-report-snapshot.ts` or `report-escalations.ts`
- **AND** archive, PDF export, period, publication, and weekly-report pass strict ESLint through facade imports

### Requirement: The reports route MUST compose period-owned history behavior

Report-history query/state and presentation MUST reside under `apps/web/src/features/period/model/` and `apps/web/src/features/period/ui/`. The `/reports` route MAY compose the feature and route metadata, but MUST NOT own history tRPC queries, role-view derivation, toolbar behavior, or panel presentation.

#### Scenario: The reports page is routing composition only

- **WHEN** `apps/web/src/app/(app)/reports/page.tsx` renders report history
- **THEN** it imports the history entry points from the period feature facade
- **AND** no `history-panel`, `history-toolbar`, `history-role-view`, or `use-history-data` implementation remains beside the route

#### Scenario: Period history segments remain colocated and bounded

- **WHEN** report-history source placement is enumerated
- **THEN** query/state and role derivation reside in `features/period/model/`
- **AND** the panel and toolbar reside in `features/period/ui/`
- **AND** external consumers reach only the minimal exports in `features/period/index.ts`

### Requirement: Auxiliary repository roots MUST use deterministic concern ownership

Every maintained file under `scripts/` and `prisma/` MUST have exactly one
owner in a checked ownership catalogue. Its home MUST be a deterministic
function of concern first and role second. Executable entrypoints,
implementation, tests, and owned baseline/ledger data MUST remain inside the
owning concern boundary; a generic flat root or generic repository-wide `data/`
bucket MUST NOT be used as an ownership substitute.

#### Scenario: An ownership map is incomplete

- **WHEN** a tracked file in a migrated root has zero or multiple ownership entries
- **THEN** the directory-architecture gate fails
- **AND** no move is accepted until exactly one target owner is recorded

### Requirement: Large direct-file inventories MUST split or carry a shrinking exception

A maintained directory containing more than 30 direct files MUST split along
catalogued concern boundaries unless the durable standard explicitly declares
it as a single-concern bounded-flat exception. Every exception MUST record its
exact current direct-file count as a non-increasing baseline. New files MUST NOT
be added to an over-threshold exception without first splitting or lowering the
count elsewhere in the same concern.

#### Scenario: A flat tooling directory grows beyond the threshold

- **WHEN** a change leaves more than 30 direct maintained files in a directory with no bounded-flat exception
- **THEN** the structural gate fails with the directory and count
- **AND** adding a filename prefix does not satisfy the requirement

#### Scenario: A declared flat API module does not grow

- **WHEN** an intentionally flat module is listed with a baseline of N direct files
- **THEN** the gate accepts a current count at or below N
- **AND** rejects N+1 until the module is split or the durable architecture decision is explicitly changed

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
cross-slice imports. Remaining page composition MUST be grouped into cohesive
`lead/{shell,bridges,chrome}`, `weekly`, `head`, and `product` families; no
`report-pages/ui` directory may retain more than 30 direct files.

#### Scenario: A report-specific hook is classified

- **WHEN** a root hook is consumed only by report-section behavior
- **THEN** it moves to the report-sections model segment
- **AND** it is not placed in `shared/hooks` merely because it began in the root hooks directory

#### Scenario: Cross-slice edges are remeasured

- **WHEN** the web migration completes
- **THEN** production deep cross-slice import count remains zero
- **AND** the prior test-only viewer deep import is removed rather than grandfathered

#### Scenario: Page composition remains readable after domain extraction

- **WHEN** domain-owned report-page files have moved to their canonical slices
- **THEN** the remaining source and co-located tests are grouped by page-composition family
- **AND** the flat `report-pages/ui` root contains no production implementation files
- **AND** every direct report-pages directory is at or below the 30-file density floor

#### Scenario: A client-only cross-slice dependency is required

- **WHEN** one feature consumes a hook from another feature
- **THEN** it imports the hook through that feature's explicit `client.ts` entrypoint
- **AND** the pure `index.ts` facade remains free of client-only exports
