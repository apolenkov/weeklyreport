# Tasks — activity-first-class-reporting-unit

## 0. Decisions to lock (BLOCKS tasks 1–8 — resolve first)

These four resolutions are hard-coded in the specs and `design.md` "Locked
decisions"; they are listed here as an explicit gate so no implementation task
proceeds on an unresolved answer.

- [x] 0.1 Escalation / KPI parity — LOCKED **no, Phase 1**: activity
      risks/blockers do NOT feed the head-dashboard escalation table or portfolio
      KPI roll-up. Enforced by the `status-risk-unification` MODIFIED delta +
      the `buildEscalationsFromReadSections` null-`projectId` skip (task 3.4).
- [x] 0.2 Activity-only reachability — LOCKED **yes, seeded**: seed a lead
      attached to activities with zero products so the submit relaxation is a live
      path (task 7.1).
- [x] 0.3 Carry-over on archive — LOCKED **skip the clone when not re-attached**:
      preserve `activityId`, re-parent only when the activity is re-attached; an
      archived/not-re-attached activity's records are not carried forward
      (task 3.5).
- [x] 0.4 Decision parent — LOCKED **activities own decisions too (full parity)**:
      XOR covers `Item`/`Risk`/`Decision`; forces the `decisionsToSave` filter fix
      (task 3.8).

## 1. Schema + migration

- [ ] 1.1 Add `ProjectActivityProduct` join model (`activityId`, `productId`,
      `@@unique([activityId, productId])`, `@@index([productId])`, Cascade on the
      activity side) to `prisma/schema.prisma`.
- [ ] 1.2 Drop `ProjectActivity.projectId` and its `@@index([projectId])`; replace
      the `Project.projectActivities` relation with
      `Project.activityProducts ProjectActivityProduct[]`.
- [ ] 1.3 Add nullable `activityId String?` to `Item`, `Risk`, `Decision`; make the
      product FK nullable (`Item.projectId?`, `Risk.projectId?`,
      `Decision.productId?`); add the inverse `ProjectActivity` relations.
- [ ] 1.4 Hand-write the XOR CHECK constraint per table into the init migration SQL
      (`(("projectId" IS NOT NULL)::int + ("activityId" IS NOT NULL)::int) = 1`,
      `productId` for Decision) — Prisma DSL cannot express it (mirrors the
      `Report_one_open_per_boundary` partial index).
- [ ] 1.5 Write the backfill: one `ProjectActivityProduct` row per existing
      `ProjectActivity` with a non-null `projectId`, BEFORE the column drop.
- [ ] 1.6 MVP path: reshape the init migration and `prisma migrate reset`
      (pass `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); regenerate the client
      (`pnpm --filter @customreport/api db:generate`).

## 2. Shared schemas + contracts

- [ ] 2.1 `packages/shared/src/schemas/section.schema.ts`: make the product FK
      nullable/optional and add `activityId` to `itemInputSchema`,
      `riskInputSchema`, `decisionInputSchema`.
- [ ] 2.2 Add a `.superRefine` enforcing XOR parent AND conditional
      `requiredStageIdsField` in BOTH directions: required/non-empty for a product
      parent, and REJECTED when non-empty on an activity parent (an activity owns
      no stage; empty/absent is accepted).
- [ ] 2.3 Relax `submitSectionSchema.projectStatuses.min(1)` so an activity-only
      section submits; keep the per-product status requirement for present
      products; AND add its activity analogue. Enforce it SERVER-side by extending
      `validateSubmitInput` to loop `section.activities` (the way it already loops
      `section.projects`) and require each attached activity to carry a non-null
      status — schema tightening alone can't catch an OMITTED attached activity, so
      the schema change (`activityStatusInputSchema.status` non-null at submit) is a
      complement, not the whole enforcement.
- [ ] 2.4 Extend `sectionActivitySchema` with `linkedProducts` (id + name) and the
      derived status; keep new fields `.optional()`/`.default([])` for snapshot +
      fixture compatibility. Export any new inferred types.
- [ ] 2.5 Admin activity contract (`project-activity.schema.ts`): replace the
      scalar `projectId` with `linkedProductIds` (create/update) and
      `linkedProducts` id+name (read/list); update the inferred types.

## 3. Backend (read model, write path, derived status)

- [ ] 3.1 Section read-model builder: keep records in the FLAT top-level
      `items`/`risks`/`decisions` arrays discriminated by `activityId` (product FK
      null), the same as product-parented rows; derive each record's parentType;
      join `linkedProducts`. Grouping-under-activity is a presentation-mapper
      concern (task 5.x), NOT a read-model reshape.
- [ ] 3.2 Apply the activity-level derived-status floor at read time (blocked item →
      red; risk severity floor; else stored/default). Never rewrite the stored
      `ActivityStatus.status`.
- [ ] 3.3 `saveSection`: persist activity-parented records (activityId set, product
      FK null) through the existing delete-recreate + `stableId` + comment-transfer;
      accept activity records with empty `stageIds`.
- [ ] 3.4 Guard `buildEscalationsFromReadSections` to skip null-`projectId` records
      (Phase-1: activity risks do not feed the product-level escalation roll-up).
- [ ] 3.5 Carry-over: preserve `activityId` on the cloned record; skip the clone
      when the activity is not re-attached in the new period (dup-lineage skip).
- [ ] 3.6 Any new/changed tRPC procedure uses a canonical middleware-chain builder
      by reference identity (role-coverage gate).
- [ ] 3.7 Add `validateRecordActivityIds` (`section-validation.schema.ts`),
      mirroring `validateActivityStatuses`: reject any `items`/`risks`/`decisions`
      row whose `activityId` is not in the section author's seeded
      `section.activities` with `ACTIVITY_NOT_ATTACHED`; wire it into BOTH
      `saveDraft` and `submitSection` before the delete-recreate.
- [ ] 3.8 Fix the `decisionsToSave` filter in
      `report-sections.prisma-repository.ts`: persist a decision when it carries a
      `productId` OR an `activityId` (write `productId` null / `activityId` set for
      the activity case), instead of dropping every `productId`-less decision.
- [ ] 3.9 Admin `project-activity` service/repository: reconcile the
      `ProjectActivityProduct` join rows to the submitted `linkedProductIds` on
      create/update; return `linkedProducts` (id + name) on read/list.

## 4. Lead dialog — parent picker

- [ ] 4.1 Turn `product-picker.tsx` into a parent picker offering products AND the
      section author's attached activities (grouped), returning the chosen
      parent's id + kind.
- [ ] 4.2 `item-edit-dialog.tsx`: hide the `StageMultiSelect` and skip the
      stage-required validation when the parent is an activity; clear the stage
      selection on a product→activity switch; re-show it on activity→product.
- [ ] 4.3 Wire the same parent picker into the risk and blocker entry paths (a
      blocker is an item with `workflowStatus=blocked`).
- [ ] 4.4 Admin activity form: swap the single product select for a multi-select
      bound to `linkedProductIds`; render the activity's `linkedProducts` in the
      admin list. UI strings stay English.

## 5. Lead form + slides rendering

- [ ] 5.1 Grow `activity-status-section.tsx` / `unified-activity-section.tsx` into a
      full activity card: records/risks/blockers + derived status, no stage
      pipeline; show linked product(s). Floor the pill and refuse a manual lower
      with the "remove the risk/blocker first" message.
- [ ] 5.2 `slide-activity-pills.tsx` / `lead-unified-slide.tsx` /
      `section-slide-utils.ts`: render the lead's activities on the slides grouped
      by traffic-light status, with linked product(s); keep sr-only status labels.

## 6. Head report rendering

- [ ] 6.1 `activity-status-strip.tsx` / `weekly-report-page.tsx`: render each
      activity in the report body like a product (records + linked products), minus
      the stage lane, instead of a status-only strip; keep the submitted-only §7
      filter parity with `product-accordion.tsx`.

## 7. Seed data

- [ ] 7.1 Seed activity-parented items/risks/decisions and `ProjectActivityProduct`
      links on a demo activity so all three surfaces render populated activities and
      the linked-product label is visible.

## 8. Tests

- [ ] 8.1 Shared: XOR refine, conditional stage rule (accept empty AND reject
      non-empty on an activity parent), activity-only submit + activity-status
      required-at-submit, admin contract `linkedProductIds`/`linkedProducts`
      (`packages/shared` vitest).
- [ ] 8.2 API: read-model flat-array discrimination by `activityId` +
      derived-status floor + escalation null-`projectId` skip + carry-over parent
      preservation + `activityId` write guard rejects a spoofed id + activity
      decision survives `saveSection` (`decisionsToSave` fix) + admin join
      reconcile (unit + integration).
- [ ] 8.3 Web: parent picker hides stages on an activity; activity pill floor
      refuses manual lower; head report renders an activity card; admin activity
      form multi-selects linked products
      (`item-edit-dialog`, `activity-status-section`, `activity-status-strip`).

## 9. Specs + docs

- [ ] 9.1 Confirm the new `activity-reporting-unit` capability and the modified
      `risk-stage-integrity` / `record-dialog-layout` requirements match the
      shipped behaviour; update the deltas if implementation diverges.
- [x] 9.2 The four decisions are LOCKED up front in task group 0 and hard-coded in
      the specs (`design.md` "Locked decisions"); no separate stakeholder gate
      remains. Re-confirm only if a stakeholder reopens escalation parity (Phase 2).

## 10. Verification

- [ ] 10.1 `pnpm --filter @customreport/api db:generate` (pnpm ops wipe the client).
- [ ] 10.2 `pnpm typecheck` green.
- [ ] 10.3 `pnpm lint` green (`--max-warnings 0`, no new `eslint.config.ts`
      exemptions).
- [ ] 10.4 `pnpm test` green; `pnpm --filter @customreport/shared test` green.
- [ ] 10.5 `pnpm test:integration` (single-thread) for the API read/write paths.
- [ ] 10.6 `openspec validate activity-first-class-reporting-unit --strict` passes.
- [ ] 10.7 Live-verify from source (docker image is stale): lead form + slides +
      head report render a populated activity; the pill floor refuses a manual lower.
