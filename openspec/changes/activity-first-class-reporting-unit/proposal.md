# Activity as a First-Class Reporting Unit Beside a Product

## Why

Today a `ProjectActivity` is a thin status row: the lead sets one traffic light
per activity per section (`ActivityStatus`), and the activity links to at most
ONE product through the label-only `ProjectActivity.projectId String?`. It
carries no items, risks, blockers, decisions, or priorities. Both live
walkthroughs on 2026-07-02 converged on the same direction:

- Lead surface (`docs/feedback/lead-surface-annotations-2026-07-02.md`, cluster
  D + A3): the item dialog must let the lead scope a record to an ACTIVITY, not
  only a product (D1); the activity↔product link must become many-to-many with
  the linked products shown on each activity row (D3); and activities must join
  the slides, grouped by status (A3).
- Head surface (`docs/feedback/head-surface-walkthrough-2026-07-02.md`,
  HF2/HF4/HF5): "Activities are missing from the head report; show them like
  products. Products and activities are the SAME positions model with the same
  records/risks/blockers; the only differences are that an activity has NO SDLC
  stage and it links to product(s) rather than stages."

This is the biggest, most blocking item in both triage docs. It is a schema
change (1:N label link → M:N join), a shared-contract change (a record's parent
becomes a product OR an activity), and a cross-surface render change (lead form,
lead slides, head report). It also introduces a load-bearing invariant the
stakeholder stated explicitly: an activity's status is derived from its own
risks and blockers, never from SDLC stages (it has none).

## What Changes

- **A record's parent may be a product OR an activity.** `Item`, `Risk`, and
  `Decision` gain a nullable `activityId` beside their product FK (which becomes
  nullable), governed by a hand-written XOR CHECK so exactly one parent is set.
  The whole positions machinery is reused unchanged — `stableId` lineage,
  carry-over, `RecordComment` anchors, `searchTsv`, and the `saveSection`
  delete-recreate — rather than duplicated into parallel activity tables.
- **Activity↔product is many-to-many.** A new `ProjectActivityProduct` join
  replaces `ProjectActivity.projectId`; an activity links to 0..N products and
  each activity row shows its linked product(s). The link stays label-only.
- **Activity-parented records carry no SDLC stage.** The stage-required write
  schemas (`riskInputSchema`, `itemInputSchema`, `decisionInputSchema` via
  `requiredStageIdsField`) accept an empty/absent `stageIds` when the parent is
  an activity; an activity record never renders the "No stage set" warning.
- **The record dialog gains a parent picker.** `item-edit-dialog.tsx`'s
  `ProductPicker` becomes a parent picker offering products AND activities; when
  the parent is an activity the SDLC Stages selector is hidden and the
  stage-required rule is skipped. The same UX applies to risks and blockers.
- **An activity's traffic light is derived from its own risks/blockers.** A
  blocked item on the activity forces red; an at-risk/blocked risk floors the
  pill to that severity; the lead cannot lower it manually and sees "remove the
  risk/blocker first" — the activity-level analogue of the stage-chip severity
  floor in `status-risk-unification`.
- **Activities render like products on all three surfaces**, minus the stage
  lane: `activity-status-section.tsx` (lead form) grows into a full activity
  card; `slide-activity-pills.tsx` groups the lead's activities by status on the
  slides; `activity-status-strip.tsx` / `weekly-report-page.tsx` render each
  activity in the head report body with its records and linked products.
- **Product health stays independent of activities.** An activity's risk or
  blocker floors only the ACTIVITY's own status; it never changes a linked
  product's traffic light, `worstStatus`, or the product-level flagged-red
  escalation roll-up.
- **A section attached only to activities can submit.** `submitSectionSchema`'s
  `projectStatuses.min(1)` no longer blocks a lead who owns activities but no
  products.
- **Migration + backfill.** Additive-then-drop: create the join, backfill one
  row per existing activity with a non-null `projectId`, then drop the column;
  existing `ActivityStatus` rows are preserved. Under the MVP disposable-DB rule
  the init migration is reshaped and reseeded; the backfill logic is specified
  for the eventual production path.

Out of scope (Phase 1): activity risks/blockers do NOT feed the head-dashboard
Blocked-&-At-Risk escalation table or the portfolio KPI roll-up. Activities are
first-class in the report SURFACES and carry their own derived status; wiring
their risks into the department escalation feed is deferred (see the top open
question in `design.md`).

## Capabilities

### New Capabilities

- `activity-reporting-unit`: an activity carries the same records as a product
  (minus the SDLC stage), links to products many-to-many, derives its status
  from its own risks/blockers, renders on all three surfaces like a product,
  and never entangles a linked product's health.

### Modified Capabilities

- `risk-stage-integrity`: the stage-required rule and the "No stage set" loud
  marker are scoped to PRODUCT-parented records; an activity-parented record
  legitimately carries no stage. Two requirement headers modified verbatim.
- `record-dialog-layout`: the CLASSIFICATION panel's Product picker becomes a
  parent picker (product OR activity), and the SDLC Stages selector is hidden
  when the parent is an activity. One requirement header modified verbatim.

## Impact

- `prisma/schema.prisma` — `ProjectActivity` (drop `projectId`), new
  `ProjectActivityProduct`, nullable `activityId`/product-FK + XOR CHECK on
  `Item` / `Risk` / `Decision`, `Project` inverse relation swap.
- `prisma/migrations/**` (hand-edited init SQL: the XOR CHECK and join backfill)
  and `prisma/seed*` (seed activity-parented records + join rows).
- `packages/shared/src/schemas/section.schema.ts` — `itemInputSchema`,
  `riskInputSchema`, `decisionInputSchema`, `sectionActivitySchema`,
  `submitSectionSchema`, and the read models (nullable parent, linked products,
  activity records).
- `apps/api` — the section read-model builder, `saveSection` write path, the
  activity-status derived floor, and carry-over (preserve `activityId`).
- `apps/web/src/components/lead/item-edit-dialog.tsx`,
  `product-picker.tsx` (→ parent picker), `activity-status-section.tsx`,
  `unified-activity-section.tsx`, `item-card.tsx`.
- `apps/web/src/components/slides/slide-activity-pills.tsx`,
  `lead-unified-slide.tsx`, `status-slide-deck.tsx`, `section-slide-utils.ts`.
- `apps/web/src/components/weekly-report/activity-status-strip.tsx`,
  `weekly-report-page.tsx`, `product-accordion.tsx`.
- Specs: new `activity-reporting-unit`; modified `risk-stage-integrity`,
  `record-dialog-layout`. Cross-references `status-risk-unification`,
  `status-color-semantics`, `period-dual-state`, `role-coverage-gate`.
