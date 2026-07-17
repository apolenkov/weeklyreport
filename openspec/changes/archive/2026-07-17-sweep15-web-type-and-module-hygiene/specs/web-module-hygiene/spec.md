## ADDED Requirements

### Requirement: Web period status uses the shared contract

Web production and mock modules MUST import `PeriodStatus` from `@customreport/shared` and MUST NOT redeclare the `open | published | reopened` union locally.

#### Scenario: PeriodStatus occurrences are inspected

- **WHEN** the web source is searched for a local `PeriodStatus` union
- **THEN** `admin-mock-data.ts`, `admin-types.ts`, and `weekly-report-page-helpers.ts` contain no redeclaration
- **AND** their values and mapped outputs typecheck against the shared contract

### Requirement: Weekly report projection is pure and single-source per product

`mapWeeklyReport` MUST derive portfolio and product report rows from one pure per-product projection, MUST NOT mutate accumulator arrays, and MUST keep each production function at or below 50 lines.

#### Scenario: One overview row is projected

- **WHEN** an overview row and grouped record lookups are mapped
- **THEN** one projection provides the shared identity, status, lead label, counts, and record slices used by both output shapes
- **AND** neither output is assembled with `push`, reassignment, or an in-place mutation

#### Scenario: Existing report fixtures are mapped

- **WHEN** the refactored mapper receives existing weekly report fixtures, including empty groups and attention signals
- **THEN** its complete `MapWeeklyReportResult` equals the pre-refactor contract

### Requirement: Print report responsibilities live in bounded modules

The print route MUST separate query/outcome control, portfolio table, lead section, executive summary, and print styles into cohesive modules that satisfy the repository line/function budgets without a `max-lines` disable.

#### Scenario: The print controller renders a successful report

- **WHEN** the print query resolves successfully
- **THEN** the controller composes the extracted print sections
- **AND** the existing machine-readable ready marker and representative print DOM/styles are preserved

#### Scenario: Print loading or error occurs

- **WHEN** the print query is pending or fails
- **THEN** the controller emits the same mutually exclusive loading/error outcome contract used by PDF readiness

### Requirement: Slide model jobs are separated without semantic drift

The slide model MUST separate section composition, activity projection, pagination, foreign merge, and product-scoped transformation into independently testable modules, and `section-slide-utils.ts` MUST no longer require an ESLint size/complexity exemption.

#### Scenario: A section with activities and foreign content is projected

- **WHEN** the split model processes own product/activity records plus Everyone-mode foreign content
- **THEN** product scope, author attribution, status folding, order, and pagination match the existing integrated output

#### Scenario: The lint configuration is inspected

- **WHEN** the module split is complete
- **THEN** `eslint.config.ts` has no exemption entry for `section-slide-utils.ts`
- **AND** no replacement extracted production file requires a new exemption
