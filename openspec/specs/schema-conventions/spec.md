# schema-conventions Specification

## Purpose

TBD - created by archiving change modernize-zod-string-formats. Update Purpose after archive.

## Requirements

### Requirement: Shared Schemas MUST Use Top-Level Zod String-Format Validators

Zod string-format validation in the shared schemas, the tRPC router, and the API env schema MUST use the top-level validators (`z.uuid()`, `z.email()`, `z.url()`, `z.iso.datetime()`) rather than the deprecated method-style forms (`z.string().uuid()`, `z.string().email()`, `z.string().url()`, `z.string().datetime()`). The change is API-surface only and MUST preserve each validator's accept/reject behavior.

#### Scenario: No deprecated method-style string-format validator remains

- **WHEN** the schema surface (`packages/shared/src/**/*.schema.ts`, `apps/api/src/infrastructure/trpc/trpc.router.ts`, `apps/api/src/infrastructure/config/env.schema.ts`) is scanned for `z.string().uuid(`, `z.string().email(`, `z.string().url(`, or `z.string().datetime(`
- **THEN** zero matches are found
- **AND** the equivalent top-level validator is used at every former call site

#### Scenario: Migration preserves validation behavior

- **WHEN** a top-level validator replaces its method-style predecessor
- **THEN** it accepts and rejects exactly the same inputs (e.g. `z.uuid()` rejects non-RFC-4122 literals just as `z.string().uuid()` did, and `z.url().startsWith("postgresql://")` validates `DATABASE_URL` exactly as before)
- **AND** the full test suite and `pnpm typecheck` pass with no behavior regression
