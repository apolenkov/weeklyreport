# Design — activity-first-class-reporting-unit

## Locked decisions (resolved BEFORE implementation — tasks 1–8 depend on these)

The four questions the walkthroughs left open are RESOLVED here and hard-coded in
the specs; task group `0. Decisions to lock` in `tasks.md` gates the
implementation tasks on them. No implementation task may proceed on an unresolved
answer.

1. **Escalation / KPI parity — LOCKED: no, Phase 1.** Activity risks/blockers do
   NOT enter the head-dashboard Blocked-&-At-Risk escalation table or the
   portfolio KPI roll-up. HF2 frames product and activity as the SAME positions
   model, which hints at full parity, but `buildEscalationsFromReadSections`
   (`apps/api/src/modules/published-report-snapshot.ts`) is keyed on `projectId`
   with product-level dedup, and the durable invariant is "activity status never
   feeds portfolio totals, escalations, or product health"
   (`activity-status-strip.tsx`). Phase-1 keeps activities first-class on the
   report SURFACES with their own derived status while the escalation builder
   skips null-`projectId` records — a one-line guard, zero product-health blast
   radius. Enforced by the `status-risk-unification` MODIFIED delta (per-item
   `blocked` / per-risk `unresolved_risk` escalations narrowed to
   product-parented rows). Escalation parity is a deferred, separately-tracked
   change.

2. **Activity-only reachability — LOCKED: yes, and it must be seeded.** A lead may
   be attached to activities with zero products; seed/real data MUST include such
   a lead so the activity-only-submit relaxation is an exercised path, not dead
   code (task 7.1).

3. **Carry-over on archive — LOCKED: skip the clone when the activity is not
   re-attached.** The carry-over clone preserves `activityId` and re-parents the
   record only when the activity is re-attached in the new period. When an
   activity is archived (or otherwise not re-attached) between periods, its
   records are NOT carried forward — the dup-lineage skip, the activity analogue
   of the existing product skip (task 3.5).

4. **Decision parent — LOCKED: activities own decisions too (full parity).** The
   XOR parent applies to `Item`, `Risk`, AND `Decision`; an activity-parented
   decision persists with `productId` null and `activityId` set (which forces the
   `decisionsToSave` filter fix, Decision 6).

## Decision 1 — Polymorphic XOR parent, not parallel activity tables

`Item`, `Risk`, and `Decision` gain a nullable `activityId` beside their existing
product FK (`Item.projectId`, `Risk.projectId`, `Decision.productId`), and that
product FK becomes NULLABLE. A record's parent is EXACTLY ONE of the two,
enforced by a hand-written CHECK constraint:

```
CHECK ( (("projectId" IS NOT NULL)::int + ("activityId" IS NOT NULL)::int) = 1 )
```

(Decision uses `productId` in place of `projectId`.) Prisma's DSL cannot express
a table CHECK, so it is hand-written into the init migration SQL — the same
mechanism the repo already uses for `Report_one_open_per_boundary`
(`prisma/migrations/20260530162224_init/migration.sql`); it lands only via
`prisma migrate reset`, not `deploy`.

**Rejected alternative — parallel `ActivityItem` / `ActivityRisk` /
`ActivityDecision` tables.** This would leave the product tables untouched, but it
duplicates the ENTIRE positions machinery: `stableId` lineage, carry-over
cloning, `RecordComment` FK anchors, `searchTsv` generated columns, the
`saveSection` delete-recreate, the section read model, the slides mapper, and
every consumer. The stakeholder's ask is explicitly "the SAME records" — one
shared shape reused, not a second parallel one. XOR-parent reuses all of it; the
only cost is that the product FK becomes nullable.

**Cost of the nullable product FK (accepted, bounded).** Every read path that
dereferences `item.projectId` / `decision.productId` must tolerate null. The
mitigation: the record's parent is derived once (product vs activity) in the read
model, and product-only code paths (stage floor, product health, escalations)
filter to product-parented rows up front. `@@unique([reportSectionId, stableId])`
is unaffected; the existing `@@index([projectId])` / `@@index([productId])` stay
valid (Postgres indexes nulls). No new discriminator column is added — a
`parentType` enum would be redundant persisted state (a lint/`enum-state-hygiene`
smell); parentType is derived from which FK is non-null.

## Decision 2 — `ProjectActivityProduct` join replaces `ProjectActivity.projectId`

M:N via a dedicated join, named to match the existing `ProjectActivityLead`:

```
model ProjectActivityProduct {
  id         String          @id @default(uuid())
  activityId String
  productId  String
  createdAt  DateTime        @default(now())
  activity   ProjectActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  product    Project         @relation(fields: [productId], references: [id])

  @@unique([activityId, productId])
  @@index([productId])
}
```

`ProjectActivity.projectId` and its `@@index([projectId])` are dropped;
`Project.projectActivities` is replaced by `Project.activityProducts
ProjectActivityProduct[]`. The link stays label-only — no `onDelete: Cascade` on
the product side (a product is retired via `archived`, matching
`StageStatus`/`Decision`), Cascade on the activity side (mirrors
`ProjectActivityLead`).

**Admin contract switch (finding 4).** Dropping the scalar `projectId` forces the
admin activity CRUD contract off it: `projectActivityCreateSchema` /
`projectActivityUpdateSchema` replace the single `projectId` with a
`linkedProductIds: string[]` (0..N), and the read/list `projectActivitySchema`
replaces `projectId` with `linkedProducts` (id + name per link). The
`project-activity` admin service/repository reconciles the
`ProjectActivityProduct` join rows to the submitted `linkedProductIds` on
create/update. The admin UI product picker becomes multi-select.

## Decision 3 — Migration + backfill

Production-safe order (documented for the eventual prod path; under the MVP
disposable-DB rule the init migration is reshaped and reseeded instead):

1. Create `ProjectActivityProduct`.
2. Backfill: `INSERT INTO "ProjectActivityProduct" (id, "activityId", "productId")
SELECT gen_random_uuid(), id, "projectId" FROM "ProjectActivity"
WHERE "projectId" IS NOT NULL;`
3. Drop `ProjectActivity.projectId` and its index.
4. Add nullable `activityId` to `Item` / `Risk` / `Decision`; make the product FK
   nullable; add the XOR CHECK (all existing rows are product-parented, so the
   CHECK holds on backfill with `activityId` null).
5. `ActivityStatus` rows are untouched — the derived floor is applied at READ
   time, never by rewriting the stored status.

Seed data gains: activity-parented items/risks/decisions on a demo activity, and
`ProjectActivityProduct` rows so the linked-product label is visible (extends the
C3 activity seed noted in recent commits).

## Decision 4 — Shared-schema changes

`itemInputSchema`, `riskInputSchema`, `decisionInputSchema`
(`packages/shared/src/schemas/section.schema.ts`):

- product FK field (`projectId` / `productId`) becomes nullable/optional; add
  `activityId: z.uuid().nullable().optional()`.
- a `.superRefine` enforces the XOR (exactly one parent) AND makes
  `requiredStageIdsField` conditional in BOTH directions: `stageIds` is required
  and non-empty when the parent is a product, and MUST be empty/absent when the
  parent is an activity — a non-empty `stageIds` on an activity parent is
  REJECTED (an activity owns no stage; a stage name there can only be spoofed or
  stale). The READ models stay tolerant on the product side (they already accept
  empty `stageIds` for the "No stage set" legacy path).
- **Read-model shape stays FLAT (finding 6).** Activity-parented records ride the
  existing top-level `items`/`risks`/`decisions` arrays on
  `reportSectionReadModelSchema`, discriminated by `activityId` (product FK
  null) — exactly as product-parented records ride those same flat arrays
  discriminated by their product FK. The shared read model does NOT nest records
  under `activities[]`; product records are not nested under `projects[]` either.
  The presentation mappers (`mapLeadProducts` and the activity analogue) do the
  grouping-under-parent for rendering. This keeps read/write symmetry: the write
  payload (`draftSaveSchema`) is flat, the `activityId` write guard (Decision 7)
  and the `decisionsToSave` filter (Decision 6) iterate the flat arrays, and a
  grouped read model would create an asymmetry products never had.
- `submitSectionSchema.projectStatuses.min(1)` is relaxed: a section with
  activities but no products submits (validation ranges over product statuses ∪
  activity statuses). Keep the per-product status requirement for products that
  ARE present, AND add its activity analogue. Enforce it in `validateSubmitInput`
  (the server-authoritative check that already loops `section.projects`) by
  looping `section.activities` and requiring each attached activity to carry a
  non-null status — schema tightening alone cannot catch an OMITTED attached
  activity. The schema tightening of `activityStatusInputSchema.status`
  (nullable/optional on draft → non-null at submit, mirroring how
  `submitSectionSchema` tightens `projectStatuses.status`) is a complement, not
  the whole enforcement.
- `sectionActivitySchema` grows: `linkedProducts` (id + name array) and the
  activity's derived status. `.default([])` / `.optional()` on every new field so
  frozen published snapshots and legacy fixtures keep parsing.

## Decision 5 — Activity-level derived-status floor

The activity pill is the analogue of the stage-chip severity floor in
`status-risk-unification`, but on a single pill with no stages. At read time the
activity's status is floored by its OWN records: a blocked item → red; a risk of
severity blocked → red; a risk of severity at-risk → at least at-risk; else the
stored/lead-chosen status (default on-track). The lead-form picker
(`activity-status-section.tsx`) renders the floored value and refuses a manual
lower with a "remove the risk/blocker first" message — the pill analogue of the
chip-click interception. The stored `ActivityStatus.status` is preserved; the
floor is a render/derive layer, never a rewrite (so lowering the floor by
removing the risk restores the lead's stored choice).

## Decision 6 — `saveSection` must persist activity-parented decisions

`saveSection` today drops any decision without a `productId`: the `decisionsToSave`
filter is `section.decisions.filter((d): d is typeof d & { productId: string } =>
Boolean(d.productId))` (`report-sections.prisma-repository.ts`). Since Decision 4
(locked) gives activities their own decisions, an activity-parented decision
(`productId` null, `activityId` set) would be SILENTLY DROPPED by that filter. The
filter MUST be adjusted to persist a decision when it carries EITHER a `productId`
OR an `activityId` (the XOR guarantees exactly one), writing `productId` null and
`activityId` set for the activity case. A regression test MUST cover an
activity-parented decision surviving `saveSection`.

## Decision 7 — Server-side `activityId` write guard

The record write path validates a client-supplied `projectId`/`stageIds` against
the section author's owned data (`validateStageOwnership`) and validates
`activityStatuses` against seeded activities (`validateActivityStatuses`), but a
record's `activityId` is currently unchecked. A new guard —
`validateRecordActivityIds` in `section-validation.schema.ts`, mirroring
`validateActivityStatuses` — MUST reject any `items`/`risks`/`decisions` payload
row whose `activityId` is not in the section author's seeded `section.activities`,
returning `ACTIVITY_NOT_ATTACHED`. It runs in BOTH `saveDraft` and `submitSection`
before the delete-recreate, closing the same client-trust gap the stage guard
closes.

## Load-bearing invariants (no DB constraint enforces these — code review + CI)

- **XOR parent.** Every `Item`/`Risk`/`Decision` has exactly one parent (product
  XOR activity). Enforced by the hand-written CHECK; the write schema mirrors it.
- **Product health independence.** An activity's risks/blockers floor only the
  activity's own pill; they never change a linked product's traffic light,
  `worstStatus`, or the product-level escalation roll-up.
- **Activity status is risk/blocker-derived, never stage-derived.** An activity
  has no SDLC stage; its status comes from its own records only.
- **Period dual-state.** Activity records are section children under the same
  optimistic lock and delete-recreate as product records; concurrent leads write
  both period states atomically, unchanged.
- **Role-coverage gate.** Any new/changed tRPC procedure (activity attach, linked
  products) uses one of the 9 canonical middleware-chain builders by reference
  identity — no hand-rolled chain.

## Tradeoffs

- Nullable product FK ripples through read paths — accepted, bounded by deriving
  parentType once and filtering product-only logic up front.
- Phase-1 escalation asymmetry (product blockers escalate, activity blockers do
  not) is a real gap versus "same positions model" — accepted as the conservative
  default (Locked decision 1); parity is a deferred, separately-tracked change.
- Reusing the product record tables couples activity records to product-record
  migrations forever — accepted; the alternative (parallel tables) is worse.

## Resolved questions (were open; now LOCKED — see "Locked decisions" above)

All four questions that gated implementation are resolved and hard-coded in the
specs:

1. **Escalation/KPI parity** — resolved: no, Phase 1 (`status-risk-unification`
   MODIFIED delta + null-`projectId` escalation skip). Parity is a deferred,
   separately-tracked change.
2. **Activity-only reachability** — resolved: yes; seed a lead attached to
   activities with zero products (task 7.1) so the submit relaxation is exercised.
3. **Carry-over on archive** — resolved: preserve `activityId`; skip the clone
   when the activity is not re-attached in the new period (task 3.5).
4. **Decision parent** — resolved: activities own decisions too (full parity); the
   XOR covers `Item`/`Risk`/`Decision` and forces the `decisionsToSave` filter fix
   (Decision 6).
