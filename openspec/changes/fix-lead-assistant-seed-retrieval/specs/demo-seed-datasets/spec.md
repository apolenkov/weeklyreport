## ADDED Requirements

### Requirement: Supported demo seeds expose assistant-readable current and published sources

The supported `db:seed:small`, `db:seed:middle`, and `db:seed:huge` commands MUST leave `ReportSearchPrismaRepository` with a populated canonical current live source for the canonical primary Lead and populated immutable snapshot sources for every published period advertised by that tier. Applying the Lead assistant's default source selection, authorization, and candidate projection MUST yield at least one authorized candidate without weakening ACL or reading live rows for a published report.

#### Scenario: Primary Lead searches the freshly seeded current report

- **WHEN** any supported demo tier finishes and default current-period retrieval runs for the canonical primary Lead
- **THEN** the selected live report contains that Lead's section
- **AND** authorization and candidate projection produce at least one candidate

#### Scenario: Primary Lead searches seeded published history

- **WHEN** a supported demo tier advertises a published period with seeded report-section content
- **THEN** that report has a schema-valid `publishedSnapshot` with at least one section and at least one candidate visible to the canonical primary Lead
- **AND** `ReportSearchPrismaRepository` reads the frozen snapshot rather than mutable live rows

#### Scenario: A preview period becomes eligible as time advances

- **WHEN** the controlled server clock advances to the start of the latest scheduled/future period created by a demo tier
- **THEN** canonical current source selection does not resolve to a section-less or candidate-less fixture for the canonical primary Lead
- **AND** the assistant does not return `no_results` solely because the demo database aged across weeks

### Requirement: Seeded published snapshots use the canonical publication representation

Supported seed orchestration MUST materialize published snapshots after relational section content exists and MUST use the API publication module's canonical include, Prisma mapper, assembled-report validation, deterministic ordering, and JSON serializer. Prisma seed files MUST NOT maintain hand-written empty snapshot objects or use a null snapshot to make a populated published fixture fall back to mutable live rows.

#### Scenario: Snapshot is frozen after relational seeding

- **WHEN** a supported seed creates a published report and its section records
- **THEN** snapshot materialization runs after those records exist
- **AND** the stored snapshot parses through `parsePublishedSnapshot` and contains the seeded sections

#### Scenario: Live published rows drift after seeding

- **WHEN** a seeded published report's live child row is modified after snapshot materialization
- **THEN** Lead Chat and published-report readers continue to return the original frozen snapshot content

#### Scenario: Snapshot materialization fails

- **WHEN** canonical snapshot mapping, validation, or persistence fails for any advertised published report
- **THEN** the supported seed command exits non-zero and identifies the affected report
- **AND** it does not report the environment as ready for use
