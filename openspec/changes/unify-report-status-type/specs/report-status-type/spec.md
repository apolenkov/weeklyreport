## ADDED Requirements

### Requirement: The report status type has one source of truth

The workspace MUST expose exactly one report-status contract: the
`reportStatusSchema` Zod enum and its inferred `ReportStatus` type, exported
from `packages/shared`. The `"draft" | "published"` literal union MUST NOT be
re-declared elsewhere in workspace source; consumers MUST import the shared
type. Repository PORT interfaces MUST NOT type this value with
`@prisma/client`'s enum; infrastructure internals and the sanctioned
Prisma-typed transaction applicators in `application/` remain free to handle
Prisma types before mapping.

#### Scenario: ports speak the shared type

- **WHEN** a repository port interface types a report status
- **THEN** it uses the shared `ReportStatus`
- **AND** the port file imports nothing from `@prisma/client`

#### Scenario: no inline re-declaration

- **WHEN** api or web code needs the report-status type
- **THEN** it imports `ReportStatus` from `@customreport/shared` instead of
  writing the two-literal union inline

### Requirement: The shared contract matches the database enum

The shared `ReportStatus` type MUST stay value-identical to the Prisma
`ReportStatus` enum; drift MUST fail the build via a type-identity test.

#### Scenario: drift fails loudly

- **WHEN** either the shared schema or the Prisma enum changes members
- **THEN** the identity test in the api package fails at typecheck/test time
