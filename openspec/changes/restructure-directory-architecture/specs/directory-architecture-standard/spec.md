## ADDED Requirements

### Requirement: Every source file's home MUST be a deterministic function of two axes

Every file under `apps/*/src` and `packages/*/src` MUST have exactly one correct
location, computed as a pure function of two ordered axes — **domain first, then
layer/segment** — with no discretionary judgement. Axis 1 (domain) MUST use the
CANONICAL domain vocabulary in `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`
(§Grouping rules): the finer, overlapping catalog labels (`lead-form`, `report`,
`report-sections`, `period`) MUST be **collapsed** to their canonical domain
(e.g. all four → `report-sections` / `period`), never lifted as-is. Ambiguous
cases MUST resolve via the five determinism knobs (shared/slice promotion — web
**rule-of-2**, api rule-of-3; api internal-split trigger; contracts-vs-presentation;
routing-vs-feature; pure-vs-adapter), so two reviewers independently place the same
file identically. On the web the rule-of-2 is forced, not stylistic: cross-slice
imports (`features/A → features/B`) are banned, so a helper needed by a **second**
slice has no legal home inside either slice and MUST graduate to `src/shared/` at
that second consumer. An api helper graduates to `src/lib/` only at the **third**
module consumer, because two api modules may lawfully meet through a facade barrel.

#### Scenario: A finer catalog label collapses to its canonical domain

- **GIVEN** a component whose catalog `domain` column reads `lead-form`
- **WHEN** it is assigned a home under the two-axis rule
- **THEN** it lands in the `report-sections` slice, not a new `lead-form` slice
- **AND** a file labelled `periods` lands in `period`, and `reopen` lands in `review`

#### Scenario: A web helper graduates to shared at its second slice consumer (rule-of-2)

- **GIVEN** a web helper living in `features/landing/` that a second slice (`features/search/`) now needs
- **WHEN** its home is decided
- **THEN** it graduates to `src/shared/` — importing it across `features/A → features/B` is banned, so no two-slice home inside a slice is legal

#### Scenario: An api helper stays in its module until a third module consumer (rule-of-3)

- **GIVEN** an api helper imported by exactly two modules
- **WHEN** its home is decided
- **THEN** it stays in its origin module (the second module reaches it through the module's facade barrel)
- **AND** it graduates to `src/lib/` only when a third module needs it

### Requirement: Layer and domain placement MUST follow the per-app target tree

`apps/api` MUST keep the `modules/<domain>/` + top-level `infrastructure/` shape;
the `domain/`, `application/`, and `infrastructure/` sub-split MUST appear **only**
inside invariant-bearing modules (`period`, `report-sections`, `review`,
`publication`) or a module exceeding ~6 files; moderate modules (`admin`, `auth`,
`carry-over`, `weekly-report`, `archive`, `reminders`, `pdf-export`) MUST stay flat
with an explicit port where a repository exists, and thin CRUD modules (`activity`,
`project-activity`, `email`, `observability`, `search`, `telemetry`, `organization`,
`analytics`, `telegram`) MUST stay flat (`X.service.ts` + `X.prisma-repository.ts`
at the module root). `apps/web` MUST split into three zones: `app/` holds routing only (thin
`page.tsx`/`layout.tsx` that import a slice), `features/<domain>/` holds slices with
colocated `ui/` + `model/` + `api/` (a slice `index.ts` barrel is OPTIONAL and
minimal — added only when another slice or route consumes the slice, few real
entry exports, types type-only; app/repo-root mega-barrels are forbidden; api
module facade barrels remain mandatory), and `shared/` holds the
business-agnostic web layer. The web MUST NOT introduce an `entities/` layer nor a
web-side `shared/ui` re-implementation, because `packages/shared` and `packages/ui`
already own those; there MUST remain exactly two packages.

#### Scenario: An invariant module carries the full internal split

- **GIVEN** the `period` module, which bears the atomic dual-state period write
- **WHEN** its files are placed under the layer axis
- **THEN** pure `period-transition.ts` lands in `domain/`, `period.service.ts` and its
  `PeriodRepository` port land in `application/`, and `period.prisma-repository.ts`
  lands in `infrastructure/`

#### Scenario: A thin module stays flat

- **GIVEN** the `activity` module, which bears no load-bearing invariant and is under ~6 files
- **WHEN** its files are placed
- **THEN** it keeps `activity.service.ts` + `activity.prisma-repository.ts` at the module root
- **AND** it grows NO `domain/application/infrastructure` subfolders

#### Scenario: A web feature slice colocates its segments while app/ stays routing-only

- **GIVEN** the lead report-sections feature
- **WHEN** its files are placed
- **THEN** its components land in `features/report-sections/ui/`, its autosave/visibility
  hooks and view-mappers in `features/report-sections/model/`, its tRPC call wrappers in
  `features/report-sections/api/`, exposed through `features/report-sections/index.ts`
- **AND** the corresponding `app/` route stays a thin `page.tsx` that imports the slice and holds no data logic

### Requirement: Import boundaries MUST be machine-enforced, each new zone ratcheted

The target structure MUST be locked in `eslint.config.ts` by two mechanisms, chosen
by what a zone matches on. Package-name zones MUST extend the existing
`@typescript-eslint/no-restricted-imports` block: (b) an invariant module's
`domain/**` MUST NOT import `@prisma/client`, `@nestjs/*`, `ioredis`, `bullmq`, or
`nodemailer`; (d) `packages/ui/**` MUST NOT import `@customreport/shared` domain
schemas. Relative-path zones MUST use the resolver-aware
`import-x/no-restricted-paths` rule from `eslint-plugin-import-x` (because
`no-restricted-imports` matches only import specifiers and has no per-site
allowlist, it cannot express these), with the rule's native `except` option carrying
the ratchet allowlist: (a) `apps/api/src/modules/A/**` MUST NOT import from
`apps/api/src/modules/B/**` except the sibling module's `index.ts` barrel — the
machine-checkable facade convention: each module re-exports its module class +
facade service from `index.ts`, and that barrel is the zone's sole `except` pattern
(never `*.prisma-repository` or any other internal path); (c)
`apps/web/src/features/A/**` MUST NOT import `apps/web/src/features/B/**` (slices
meet only in `app/` or `shared/`). Suppressing any boundary-zone rule via
`eslint-disable` comments MUST be forbidden; the config-level `except` allowlist is
the ONLY grandfathering mechanism. The package-level boundaries
(`packages/* ✗→ apps/*`, `shared`/`ui` never each other, `apps/api ✗→ ui`/`web`,
`apps/web → apps/api` type-only) are ALREADY owned by the
`lint-max-strictness-standard` spec and MUST NOT be re-declared here — verify, do
not re-add. Each NEW zone MUST ship **ratcheted** — existing violations
allowlisted, new ones error — so the gate never goes red on day one; the api
cross-module zone (~40 existing violations) flips its allowlist to error only in
the final migration slice.

#### Scenario: A cross-module internal import is rejected once the zone flips to error

- **GIVEN** the api cross-module zone (`import-x/no-restricted-paths`) enforced as error
- **WHEN** `apps/api/src/modules/weekly-report/*` imports `apps/api/src/modules/period/period.prisma-repository.ts`
- **THEN** eslint reports the import as a boundary violation
- **AND** importing the sibling's facade service through `apps/api/src/modules/period/index.ts` (the barrel, the zone's sole `except` pattern) is allowed
- **AND** an `eslint-disable` comment on the violating import is itself reported, not honoured

#### Scenario: A new zone lands green by grandfathering existing violations, path-granularly

- **GIVEN** a newly added boundary zone with N pre-existing violations
- **WHEN** the zone is introduced in the enforcement-ratchet slice
- **THEN** those N sites are allowlisted in the zone's config-level allowlist (`except` for path zones) and `pnpm lint` stays green
- **AND** any NEW import of a non-grandfathered internal path is reported as an error
- **AND** grandfathered paths are scoped per target-module zone entry and shrink monotonically — entries are only ever removed as violations are fixed, never added or broadened

#### Scenario: A domain file importing an adapter dependency is rejected

- **GIVEN** the api domain-purity zone
- **WHEN** a file under `period/domain/**` imports `@prisma/client` or `@nestjs/common`
- **THEN** eslint reports it, enforcing that deleting Nest/Prisma leaves the domain compiling

### Requirement: Each migration slice MUST be behavior-neutral and gated on a clean target folder

The migration MUST proceed as ordered, independently shippable OpenSpec changes —
one slice per change — sequenced by blast radius on the load-bearing invariants,
low→high (enforcement baseline → the pinned `landing` leaf web slice → remaining web
slices → the api internal hexagon slice covering `period`, `report-sections`,
`review`, `publication` → api infra ports → api cross-module facade reroute).
Every slice MUST be behavior-neutral (no product-logic change; a pure relocation +
import-fix + eslint-exemption edit, plus a barrel only where the standard requires
one — api facades always, web slices only when consumed) and MUST land with the full unit gate
green; the api cross-module slice additionally MUST pass the single-thread
integration gate (`pnpm test:integration`, postgres+redis up). Because folders are
frequently dirty under a parallel session, each slice MUST verify a clean `git status`
for its target folder before moving any file, and stage only its own paths.

#### Scenario: A slice is deferred when its target folder is dirty

- **GIVEN** the `landing` slice is next but `apps/web/src/components/landing/` has uncommitted changes from a parallel session
- **WHEN** the slice would begin
- **THEN** it is deferred until `git status` for that folder is clean
- **AND** no file is relocated while the folder is dirty

#### Scenario: The cross-module reroute slice runs the integration gate

- **GIVEN** the final api slice, which reroutes deep cross-module imports to facades and flips the cross-module zone to error
- **WHEN** it is validated as done
- **THEN** the full unit gate AND `pnpm test:integration` (single-thread, postgres+redis up) are green
- **AND** the atomic dual-state period write is exercised through a `withTransaction`/UnitOfWork seam, not a leaked `Prisma.TransactionClient`
