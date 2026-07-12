## 1. Freeze owner-group onto the snapshot's project entries

- [ ] 1.1 `packages/shared/src/schemas/section.schema.ts`: add
      `ownerGroupId: z.uuid().nullable().optional()` to
      `projectReadModelSchema`, next to `ownedStages`/`stageSet`; document
      that it is optional so pre-existing frozen snapshots and fixtures
      still parse, and that missing means "unknown owner", never
      cross-group
- [ ] 1.2 `apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts`:
      extend `reportSectionFullInclude.author.stageAssignments.project`'s
      include to also select `lead: { select: { reportingGroupId: true } }`
- [ ] 1.3 Same file, `mapPrismaToReportSection`: stamp each `projects[]`
      entry's `ownerGroupId` from `project.lead?.reportingGroupId ?? null`
- [ ] 1.4 Confirm the include addition does not change any other consumer
      of `reportSectionFullInclude` / `PrismaReportSectionWithRelations`
      (it is additive — a new selected column, no removed field)

## 2. Snapshot-sourced cross-group signal

- [ ] 2.1 `apps/api/src/modules/weekly-report/cross-group-signal.ts`: add
      `computeCrossGroupSignalFromSnapshotProjects(session, projects:
{ projectId: string; ownerGroupId: string | null | undefined }[])`
      mirroring `computeCrossGroupSignal`'s admin/empty-scope short
      circuits and per-request dedupe, but reading `ownerGroupId` directly
      instead of a `lead` relation
- [ ] 2.2 `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`:
      on the published branch, replace
      `projects.filter((project) => surfacedProductIds.has(project.id))` + `computeCrossGroupSignal` with
      `computeCrossGroupSignalFromSnapshotProjects`, fed from
      `leadSections.flatMap((section) => section.projects)` (their
      `projectId` + snapshot-frozen `ownerGroupId`) — drop the now-unused
      `surfacedProductIds` intersection on this branch
- [ ] 2.3 Confirm the live (non-published) branch is untouched: it keeps
      calling `computeCrossGroupSignal(session, projects)` against the
      live-queried `projects`, unchanged

## 3. Spec delta

- [ ] 3.1 `openspec/specs/scope-accessed-audit/spec.md`: ADD a
      requirement that published-snapshot reads compute the cross-group
      signal from the snapshot's own frozen owner-group data, with
      scenarios covering a product archived after publish and a
      `GroupProduct` edge removed after publish

## 4. Tests

- [ ] 4.1 `weekly-report.prisma-repository.test.ts` (or nearest existing
      suite covering the published branch): a published report whose
      snapshot carries a cross-group product that has since been
      archived still yields a non-null `crossGroup` signal naming it
- [ ] 4.2 Same suite: a published report whose snapshot carries a
      cross-group product whose `GroupProduct` edge has since been
      removed still yields a non-null `crossGroup` signal naming it
- [ ] 4.3 `cross-group-signal.test.ts`: unit-test
      `computeCrossGroupSignalFromSnapshotProjects` directly — admin
      session returns null, empty scope returns null, own-group product
      is excluded, multiple cross-group products in one section dedupe
      into one signal with all ids listed
- [ ] 4.4 Regression: an unrelated published read (no cross-group
      product) still emits no `scopeAccessed` event, and the returned
      read model (`portfolioOverview`, `leadSections`, `escalations`) is
      byte-for-byte unchanged from before this change

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `openspec validate fix-published-crossgroup-audit --strict`
- [ ] 5.4 Adversarial review of the diff before archiving
