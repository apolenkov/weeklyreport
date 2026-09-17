# module-import-boundaries Specification

## Purpose

Keep the layered directory architecture enforceable: an API module, a web
slice, a package domain and the shared UI each expose one public surface, and
the ESLint zones in `eslint-config/` are the executable owner of that contract.

## Requirements

### Requirement: API modules reach each other only through their facade

Code under `apps/api/src/modules/<module>` MUST reach a sibling module only
through that module's `index.ts` facade. A deep import into another module's
internal path (`domain/`, `application/`, `infrastructure/`) MUST be reported by
the API module boundary zone in `eslint-config/boundaries.ts`, so the module's
internal structure stays free to change without a cross-module rewrite.

#### Scenario: A deep import into a sibling module

- **WHEN** a file in one API module imports `../<sibling>/infrastructure/<file>`
- **THEN** the boundary zone reports the import and names the facade requirement
- **AND** importing the same symbol through the sibling's `index.ts` reports nothing

### Requirement: Web slices reach each other only through their public entrypoint

Code under `apps/web/src/features/<slice>` MUST reach a sibling slice only
through that slice's public `index.ts` or `client.ts` entrypoint. A deep import
into another slice's `ui/`, `model/` or `api/` path MUST be reported by the web
slice boundary zone.

#### Scenario: A deep import into a sibling slice

- **WHEN** a file in one web slice imports `../<sibling>/ui/<component>`
- **THEN** the boundary zone reports the import and names the entrypoint requirement
- **AND** importing the same symbol through the sibling's public entrypoint reports nothing

### Requirement: API domain stays free of infrastructure dependencies

Files under `apps/api/src/modules/<module>/domain` MUST NOT import
`@prisma/client`, `@nestjs/*`, `ioredis`, `bullmq` or `nodemailer`, as a value
or as a type. A Prisma-typed transaction applicator belongs in `application/`
and receives its client through a port, so the domain stays pure and testable.

#### Scenario: A domain file takes a Prisma type

- **WHEN** a domain module imports a Prisma type or client
- **THEN** the domain purity zone reports it and names the port boundary that belongs in `application/`

### Requirement: Shared UI stays domain-free

`packages/ui` MUST NOT import `@customreport/shared` schemas; data is shaped in
the consuming slice or API and passed to the UI as finished props. The
immutability/UI zone in `eslint-config/immutability.ts` owns this rule.

#### Scenario: A UI package file imports a shared schema

- **WHEN** a file under `packages/ui` imports a schema from `@customreport/shared`
- **THEN** the zone reports the import and names the prop boundary

### Requirement: Each zone names its rule owner and is proven by a real CLI run

Every boundary message MUST cite this spec (`module-import-boundaries`) as the
durable rule owner; citing a change or document that does not exist under
`openspec/` MUST NOT be used as provenance. The zones MUST be exercised by a
test that lints real probe sources with the repository's own ESLint
configuration, both a violating and a compliant probe per zone, and the probe
sources MUST NOT leave residue in the worktree.

#### Scenario: The boundary gate runs

- **WHEN** the boundary test executes
- **THEN** each zone reports its violating probe and stays silent for its compliant probe
- **AND** no probe file remains in the worktree afterwards, including when the run is interrupted
