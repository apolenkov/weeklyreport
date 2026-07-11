# architecture-refactor-backlog Delta

## MODIFIED Requirements

### Requirement: The traffic-light value is a recorded single-source-of-truth target

The backlog MUST record that the traffic-light status value is unified behind
one source of truth: `trafficLightStatusSchema` and its inferred
`TrafficLightStatus` type in `packages/shared`
(`report-primitives.schema.ts`), landed by `unify-traffic-light-status-type`
on 2026-07-10, consistent with `schema-conventions` and pinned by the
`traffic-light-status-type` spec. The original "~33 files re-typing
(green/amber/red)" phrasing is corrected by the landed inventory: 18 source
files and 6 test files re-declared the `green/yellow/red` union ("amber"
occurs in the workspace only as Tailwind CSS classes, never as a status
value); all now import the shared type. The TARGET IS CLOSED. The lint
regression gate for literal-union re-declaration is ALSO CLOSED — landed by
`add-status-ssot-lint-gate` (the `status-type-ssot-gate` spec). Remaining
named follow-ups stay open as separate future changes: consolidating the
presentation vocabulary's triple declaration (owned by
`status-presentation-model`) and deduplicating `TRAFFIC_RANK` /
`statusSeverity` ranking logic.

#### Scenario: the traffic-light SSOT is discoverable

- **WHEN** a maintainer searches for the traffic-light status contract
- **THEN** the backlog names `packages/shared` `report-primitives.schema.ts`
  as the single home, records the target as closed by
  `unify-traffic-light-status-type`, and links the
  `traffic-light-status-type` spec
- **AND** it records the lint gate as closed by `add-status-ssot-lint-gate`
  and names the remaining deferred follow-ups (presentation-vocabulary
  consolidation, ranking-logic dedup) as future changes

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
and infrastructure internals. The remaining named follow-up stays open as a
separate future change: the cross-module
`as unknown as PrismaReportSectionWithRelations` infrastructure cast
coupling. This requirement relates to `repository-scope-guard` only
thematically — that spec governs group-scope authorization, not types.

#### Scenario: the boundary closure is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog records the corrected inventory, names
  `unify-report-status-type` and the `report-status-type` spec, and records
  the target as closed
- **AND** it records the port-type invariant and lint gate as closed by
  `add-status-ssot-lint-gate` and names the one remaining deferred follow-up
  (infrastructure cast coupling) as a future change
