# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

Prerequisite: `migrate-to-biome` is landed; `pnpm lint` runs the final
toolchain before any file in this change is touched.

## packages/shared — schema split (low risk, do first)

- [ ] Split `packages/shared/src/schemas/report.ts` into domain-scoped files:
      `report.schema.ts` (`ReportSectionReadModel`, `ReportStatus`),
      `section.schema.ts` (section/item/risk/decision/priority validators),
      `period.schema.ts` (`PeriodStatus`, `reportPeriodSchema`,
      lifecycle fields), `stage.schema.ts` (`StageAssignment`, `stageIds`).
- [ ] Keep `report.ts` (or a barrel `index`) re-exporting every previously
      exported symbol so all existing import paths resolve unchanged. Do NOT
      rename any symbol (the legacy-misnamed `stageIds` keeps its name).
- [ ] Run `packages/shared/src/schemas/report.test.ts` (and any split-out test
      files) green with no behavioral change.

## apps/web — small cleanups (low risk)

- [ ] `apps/web/src/components/admin/action-log-tab.tsx`: type the
      `trpc.admin.actionLog.list` infinite-query call properly and delete the
      `eslint-disable-next-line @typescript-eslint/no-explicit-any` at line ~83.
- [ ] Consolidate `apps/web/src/hooks/use-status-risk-sync.ts` and
      `use-status-risk-coupling.ts` into a single composable (or a shared
      factory the two call). Update call sites to the consolidated API.
- [ ] Keep `use-status-risk-coupling.test.ts` and `use-status-risk-sync.test.tsx`
      green; adjust only for the consolidated entry point, not behavior.

## apps/api — admin decomposition (medium risk, NOT HOT ZONE)

- [ ] Decompose `apps/api/src/modules/admin/admin.service.ts` (967 LOC) into
      `period-admin.service.ts`, `reminder-admin.service.ts`,
      `project-admin.service.ts`, `snapshot-admin.service.ts`, each owning its
      slice (period creation + `AdminPeriodOverlapError` + grace-period calc;
      reminders; projects; snapshot capture/restore).
- [ ] Wire the new services through `apps/api/src/modules/admin/admin.module.ts`;
      keep the tRPC procedure surface and every public method signature/behavior
      identical (thin delegating facade if a single injection point is needed).
- [ ] Run `apps/api/src/modules/admin/admin.integration.test.ts` green
      unchanged; add focused unit tests per new service if coverage gaps appear.

## apps/api — report-sections extraction (HIGH risk, HOT ZONE)

- [ ] FIRST: write a NEW characterization test
      (`apps/api/src/modules/report-sections/version-snapshot.characterization.integration.test.ts`)
      that pins current observable behavior for section submission, version
      history, fill-from semantics, version retention, and snapshot capture —
      including OCC and `lifecycle-write-gate-allow` paths. It MUST be green
      against the code BEFORE any extraction.
- [ ] Extract `VersionHistoryService` and `SnapshotService` boundaries out of
      `report-sections.service.ts` / `lead-form.service.ts`, moving logic only —
      no query-semantics change, no change to `reportSectionFullInclude`.
- [ ] Re-run the new characterization test PLUS all existing report-sections
      tests (`*.contract.test.ts`, `*.integration.test.ts`, `*.service.test.ts`,
      `fill-from.integration.test.ts`, `version-history.integration.test.ts`,
      `version-retention.integration.test.ts`) — every one MUST stay green.

## Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] `pnpm lint:md`.
- [ ] Confirm no public tRPC contract, DB schema, Prisma migration, or
      production UI string changed (diff review).
- [ ] `openspec validate code-quality-modernization --strict` passes.
