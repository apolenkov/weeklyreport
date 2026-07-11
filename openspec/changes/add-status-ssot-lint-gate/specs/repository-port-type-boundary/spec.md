# repository-port-type-boundary Delta

## ADDED Requirements

### Requirement: Port-declaring files do not import Prisma

Port-contract files MUST NOT import `@prisma/client` — value or type; this
covers every file that declares a repository or persistence port contract
(the interfaces domain code and routers consume). Enforcement is the ESLint
Zone 4 restricted-import ban
(`eslint.config.ts`), extended from the four hexagon `domain/**` trees and
`admin-shared.ts` to the explicit inventory of port-declaring files across
modules. Sanctioned Prisma users are exempt by wording and stay outside the
inventory: `infrastructure/**` internals, `*.prisma-repository.ts` adapters,
Prisma-typed transaction applicators in `application/` (they receive the
client through a port), module query internals, and `apps/api/src/lib`
helpers.

#### Scenario: a port file grows a Prisma import

- **WHEN** a file in the Zone 4 inventory adds an `@prisma/client` import
  (value or type)
- **THEN** ESLint fails with the domain-purity message

#### Scenario: sanctioned applicators keep their access

- **WHEN** a transaction applicator in `application/` or an
  `infrastructure/**` internal types against Prisma
- **THEN** no gate fires — the exemption is part of the invariant's wording

#### Scenario: the inventory is explicit

- **WHEN** a maintainer asks which files the boundary protects
- **THEN** the Zone 4 `files` list in `eslint.config.ts` names every
  port-declaring file explicitly (no vague glob), and a new port file is
  added to the list in the same change that creates it
