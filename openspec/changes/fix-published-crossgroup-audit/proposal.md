## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

On a published report, `getWeeklyReport` builds the read model from the
frozen `publishedSnapshot`, but computes the cross-group audit signal by
intersecting the snapshot-surfaced product ids with a **live** `project`
query (`archived: false` + the current explicit `GroupProduct` edge,
`weekly-report.prisma-repository.ts:180-186, 233-241`). If a product was
delivered to the viewer via the snapshot but has since been archived, or
its `GroupProduct` edge has since been removed, it drops out of that live
query and out of the intersection — so `computeCrossGroupSignal` never
sees it and `AuditLogger.scopeAccessed` never fires, even though
`portfolioOverview` (built straight from the snapshot) still delivers the
product to the caller. `scope-accessed-audit`'s "MUST emit exactly one
`scopeAccessed` event" requirement is violated for every published read
that falls in this window.

This is not an access-control bypass — the viewer's authorization to read
the report is untouched — so it is an audit-trail completeness gap, not a
security hole. The trigger window is narrow (a product archived, or its
`GroupProduct` edge removed, strictly between publish and read), which is
why this is P2, not P1.

## What Changes

- `packages/shared/src/schemas/section.schema.ts`: add an optional,
  nullable `ownerGroupId` field to `projectReadModelSchema` — the
  product's natural owner group (`lead.reportingGroupId`), frozen into
  every section's `projects[]` entry at snapshot-build time. Optional so
  frozen snapshots published before this change, and existing fixtures,
  still parse (missing means "unknown", never treated as cross-group).
- `apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts`:
  extend `reportSectionFullInclude`'s `author.stageAssignments.project`
  include to also select `lead: { select: { reportingGroupId: true } }`;
  `mapPrismaToReportSection` stamps each `projects[]` entry's
  `ownerGroupId` from that relation before the read model is assembled
  (and therefore before it is persisted into `publishedSnapshot` at
  publish time).
- `apps/api/src/modules/weekly-report/cross-group-signal.ts`: add
  `computeCrossGroupSignalFromSnapshotProjects`, a sibling to the existing
  `computeCrossGroupSignal` that takes `{ projectId, ownerGroupId }[]`
  (the snapshot-frozen shape) instead of the live Prisma `project` rows
  with a `lead` relation, so it works without a live query.
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`:
  on the published branch, replace the
  `projects.filter((project) => surfacedProductIds.has(project.id))` +
  `computeCrossGroupSignal` pair with
  `computeCrossGroupSignalFromSnapshotProjects`, fed directly from the
  `ownerGroupId` already carried on `leadSections[].projects[]`. The live
  `project` query (and its `lead` include) is no longer needed to compute
  the published-branch signal; the live branch (which does need the full
  live `projects` list for `portfolioOverview` and its own signal) is
  unchanged.
- `openspec/specs/scope-accessed-audit/spec.md`: add a requirement that
  published-snapshot reads MUST derive the cross-group signal from the
  snapshot's own frozen owner-group data, not from a live re-query.

Non-goals: the live (non-published) read path already computes the
signal from the full live `projects` list and is correct today — no
change to its behavior. No change to `scopeDenied` or to any other
`AuditLogger` method. No change to what data the caller receives —
`portfolioOverview`, `leadSections`, and `escalations` are unchanged; only
the audit signal that gates the `scopeAccessed` emit is corrected.
