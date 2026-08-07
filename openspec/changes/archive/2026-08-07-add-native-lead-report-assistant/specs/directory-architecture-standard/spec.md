## MODIFIED Requirements

### Requirement: Layer and domain placement MUST follow the per-app target tree

`apps/api` MUST keep the `modules/<domain>/` plus top-level `infrastructure/`
shape. The `domain/`, `application/`, and `infrastructure/` sub-split MUST appear
only inside invariant-bearing modules (`period`, `report-sections`, `review`,
`publication`, `search`) or a module exceeding roughly six files. `search` is
invariant-bearing once the report assistant lands because it owns Lead ACL
parity, mutually exclusive live/snapshot selection, and structured-before-vector
retrieval; its pre-existing full-text `search.query` use case remains inside the
same canonical domain. Moderate modules (`admin`, `auth`, `carry-over`,
`weekly-report`, `archive`, `reminders`, `pdf-export`) MUST stay flat with an
explicit port where a repository exists. Thin CRUD modules (`activity`,
`project-activity`, `email`, `observability`, `telemetry`, `organization`,
`analytics`, `telegram`) MUST stay flat with `X.service.ts` and
`X.prisma-repository.ts` at the module root.

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

#### Scenario: Search gains report-assistant invariants

- **GIVEN** the `search` module owns authorization-first live/snapshot retrieval
  and semantic ranking that may never widen the structured candidate set
- **WHEN** its report-assistant files are placed
- **THEN** pure planning/projection/filtering rules land in `domain/`, the use-case
  service and owned ports land in `application/`, and Prisma/Mistral/pgvector/
  BullMQ adapters land in `infrastructure/`
- **AND** no sibling top-level `ai` or `assistant` domain is created

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
