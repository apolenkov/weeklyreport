## ADDED Requirements

### Requirement: Application effects are expressed through application-owned ports

The API application layer MUST declare and consume narrow telemetry and enqueue ports instead of importing Prometheus registries, BullMQ types, `JobEnqueuer`, or worker-observability infrastructure directly. This applies to the admin, period, publication, report-sections, pdf-export, and reminders modules.

#### Scenario: A service records telemetry

- **WHEN** an application service records an existing counter or timing observation
- **THEN** it calls its module-owned telemetry port
- **AND** the Nest composition root supplies an adapter that preserves the existing metric name, labels, value, and call timing

#### Scenario: A service enqueues work

- **WHEN** pdf-export or reminders application code schedules a job
- **THEN** it calls an application-owned enqueue port with the existing payload and options
- **AND** a Nest-bound infrastructure adapter delegates to BullMQ

### Requirement: Published lineage keeps database orchestration outside application rules

The report-sections module MUST keep Prisma reads for published lineage in infrastructure and MUST keep snapshot parsing, stable-ID collection, union, and candidate intersection as pure application/domain rules.

#### Scenario: Published lineage is queried for a section

- **WHEN** a report-sections Prisma repository resolves published lineage
- **THEN** infrastructure reads the own snapshot, other published/archived rows, and reopened snapshots
- **AND** pure rules return only candidate item and decision stable IDs proven published by those sources
- **AND** no application/domain lineage file imports `PrismaService` or a Prisma delegate

#### Scenario: No lineage candidates exist

- **WHEN** both candidate ID lists are empty
- **THEN** the lineage result is empty without issuing database reads

### Requirement: Infrastructure consumes modules through curated public APIs

API infrastructure and bootstrap consumers MUST import module services, DI tokens, port types, and domain errors through each module's curated `index.ts` public API and MUST NOT import module-internal service/error files directly.

#### Scenario: A tRPC router consumes a module service

- **WHEN** `trpc.router.ts` or a child router declares a module dependency
- **THEN** the dependency is imported from that module's public barrel
- **AND** the barrel exports only externally supported contracts rather than using `export *`

#### Scenario: The error mapper recognizes a domain error

- **WHEN** `trpc.error-mapper.ts` maps a module error
- **THEN** the error class is imported through the owning module's public barrel
- **AND** client error code/message behavior is unchanged

### Requirement: The import ratchet rejects infrastructure bypasses

The repository lint ratchet MUST reject imports from API infrastructure/bootstrap roots into `modules/<name>/<internal-file>` while allowing imports from `modules/<name>/index` and documented unavoidable exceptions only.

#### Scenario: Infrastructure imports an internal service file

- **WHEN** a file under `apps/api/src/infrastructure` imports `modules/admin/admin.service` or another module-internal path
- **THEN** lint fails with the public-barrel boundary violation

#### Scenario: Infrastructure imports the public API

- **WHEN** the same consumer imports a supported contract from `modules/admin/index`
- **THEN** the boundary rule accepts the import
