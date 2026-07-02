# Tasks — activity-first-class-reporting-unit

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
      `requiredStageIdsField` (required for a product parent, accepted empty for an
      activity parent).
- [ ] 2.3 Relax `submitSectionSchema.projectStatuses.min(1)` so an activity-only
      section submits; keep the per-product status requirement for present products.
- [ ] 2.4 Extend `sectionActivitySchema` with `linkedProducts` (id + name) and the
      derived status; keep new fields `.optional()`/`.default([])` for snapshot +
      fixture compatibility. Export any new inferred types.

## 3. Backend (read model, write path, derived status)

- [ ] 3.1 Section read-model builder: derive each record's parentType, group
      activity records under their activity, join `linkedProducts`.
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

## 4. Lead dialog — parent picker

- [ ] 4.1 Turn `product-picker.tsx` into a parent picker offering products AND the
      section author's attached activities (grouped), returning the chosen
      parent's id + kind.
- [ ] 4.2 `item-edit-dialog.tsx`: hide the `StageMultiSelect` and skip the
      stage-required validation when the parent is an activity; clear the stage
      selection on a product→activity switch; re-show it on activity→product.
- [ ] 4.3 Wire the same parent picker into the risk and blocker entry paths (a
      blocker is an item with `workflowStatus=blocked`).

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

- [ ] 8.1 Shared: XOR refine, conditional stage rule, activity-only submit
      (`packages/shared` vitest).
- [ ] 8.2 API: read-model grouping + derived-status floor + escalation skip +
      carry-over parent preservation (unit + integration).
- [ ] 8.3 Web: parent picker hides stages on an activity; activity pill floor
      refuses manual lower; head report renders an activity card
      (`item-edit-dialog`, `activity-status-section`, `activity-status-strip`).

## 9. Specs + docs

- [ ] 9.1 Confirm the new `activity-reporting-unit` capability and the modified
      `risk-stage-integrity` / `record-dialog-layout` requirements match the
      shipped behaviour; update the deltas if implementation diverges.
- [ ] 9.2 Resolve the four open questions in `design.md` with the stakeholder
      (escalation parity, activity-only reachability, carry-over-on-archive,
      decision parent) before implementation locks.

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
