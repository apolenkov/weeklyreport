## ADDED Requirements

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
