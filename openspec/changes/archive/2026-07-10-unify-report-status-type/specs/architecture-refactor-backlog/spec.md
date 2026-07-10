## MODIFIED Requirements

### Requirement: The repository Prisma-type leak is a recorded boundary target

The backlog MUST record that the repository/domain type boundary was audited
and closed by `unify-report-status-type` on 2026-07-10: the boundary was
already near-universally clean (of ~16 prisma-repositories, five touch
`@prisma/client` and four keep it strictly internal behind read-model
mappers); the ONE port-interface leak — Prisma's `ReportStatus` in the admin
repository port — is fixed by the shared `ReportStatus` type
(`report-status-type` spec), together with the two inline
`"draft" | "published"` re-declarations (archive service filter, period
domain transition), all pinned by a Prisma-to-shared identity test and an
ESLint restricted-import entry on the port file. The TARGET IS CLOSED. Named
follow-ups stay open as separate future changes: (i) a general repository
port-return-type invariant with a literal-union lint regression gate (merged
with the gate follow-up named by `traffic-light-status-type`), worded to
exempt the sanctioned Prisma-typed transaction applicators in `application/`
and infrastructure internals; (ii) the cross-module
`as unknown as PrismaReportSectionWithRelations` infrastructure cast
coupling. This requirement relates to `repository-scope-guard` only
thematically — that spec governs group-scope authorization, not types.

#### Scenario: the boundary closure is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog records the corrected inventory, names
  `unify-report-status-type` and the `report-status-type` spec, and records
  the target as closed
- **AND** it names the two deferred follow-ups (port-return-type invariant +
  lint gate; infrastructure cast coupling) as future changes
