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
ESLint restricted-import entry on the port file. The TARGET IS CLOSED. The
general repository port-return-type invariant with its literal-union lint
regression gate is ALSO CLOSED — landed by `add-status-ssot-lint-gate` (the
`repository-port-type-boundary` and `status-type-ssot-gate` specs), worded to
exempt the sanctioned Prisma-typed transaction applicators in `application/`
and infrastructure internals. The cross-module
`as unknown as PrismaReportSectionWithRelations` infrastructure cast
coupling is ALSO CLOSED — landed by `unify-report-section-prisma-payload`
(2026-07-11): the corrected inventory is ten production sites (not five —
two direct `report-sections.prisma-repository.ts` casts, two `carry-over`
casts, one `pdf-export` nested cast, three `lead-form` casts routed through
`Parameters<typeof mapPrismaToReportSection>[0]`, one
`published-report-snapshot.ts` cast behind its own underspecified hand
types, and one `weekly-report.prisma-repository.ts` `any[]` erasure), all
resolved by deriving `mapPrismaToReportSection`'s parameter from
`Prisma.ReportSectionGetPayload<{include: typeof reportSectionFullInclude}>`
instead of a hand-written mirror (`report-section-prisma-payload` spec). The
investigation also surfaced and closed one reachable correctness bug the
casts had been hiding: `saveSection`'s post-save re-read cast a nullable
Prisma result straight into the mapper with no null guard, unlike every
other call site — a concurrent report deletion could crash it; the re-read
now happens inside the write transaction, closing the race structurally.
This requirement relates to `repository-scope-guard` only thematically —
that spec governs group-scope authorization, not types.

#### Scenario: the boundary closure is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog records the corrected inventory, names
  `unify-report-status-type` and the `report-status-type` spec, and records
  the target as closed
- **AND** it records the port-type invariant and lint gate as closed by
  `add-status-ssot-lint-gate`
- **AND** it records the infrastructure cast coupling as closed by
  `unify-report-section-prisma-payload`, names the corrected ten-site
  inventory and the `report-section-prisma-payload` spec, and notes the
  concurrent-deletion hardening found and fixed along the way
