# Design — activity-first-class-reporting-unit

## Top open question (decide before implementation locks)

**Do activity risks/blockers feed the head-dashboard escalation roll-up and KPIs,
or only the activity's own pill?** HF2 frames product and activity as the SAME
positions model ("the only differences: no SDLC stage, and M:N link"), which
hints at full escalation parity. But `buildEscalationsFromReadSections`
(`apps/api/src/modules/published-report-snapshot.ts`) is keyed on `projectId`
with product-level dedup, and the current activity invariant is explicitly
"activity status never feeds portfolio totals, escalations, or product health"
(`activity-status-strip.tsx`).

**Phase-1 default taken here (conservative, bounded):** activities are
first-class in the report SURFACES (lead form, slides, head report body) and
carry their own derived status, but activity risks/blockers do NOT enter the
head-dashboard Blocked-&-At-Risk escalation table or the portfolio KPI roll-up.
The escalation builder simply skips null-`projectId` records — a one-line guard,
zero product-health blast radius. This preserves the durable half of the old
invariant (product health independent of activities) while delivering the
render-parity both walkthroughs asked for. Escalation parity for activities is
deferred; the stakeholder should confirm whether Phase 2 wires it in.

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
  `requiredStageIdsField` conditional: required when the parent is a product,
  accepted empty when the parent is an activity. The READ models stay tolerant
  (they already accept empty `stageIds` for the "No stage set" legacy path).
- `submitSectionSchema.projectStatuses.min(1)` is relaxed: a section with
  activities but no products submits (validation ranges over product statuses ∪
  activity statuses). Keep the per-product status requirement for products that
  ARE present.
- `sectionActivitySchema` grows: `linkedProducts` (id + name array) and the
  activity's derived status; the activity's records ride the existing
  `items`/`risks`/`decisions` arrays on the section read model, discriminated by
  `activityId`. `.default([])` / `.optional()` on every new field so frozen
  published snapshots and legacy fixtures keep parsing.

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
  default, surfaced as the top open question.
- Reusing the product record tables couples activity records to product-record
  migrations forever — accepted; the alternative (parallel tables) is worse.

## Open questions for a human

1. **Escalation/KPI parity** (top question above) — Phase 2 or never?
2. **Can a lead be attached to activities with zero products today?** The schema
   allows it; confirm the config is reachable in seed/real data so the
   activity-only-submit relaxation is exercised, not dead code.
3. **Carry-over of activity records** — the carry-over clone must preserve
   `activityId` and skip when the activity is not re-attached in the new period
   (mirrors the product dup-lineage skip). Confirm the desired behaviour when an
   activity is archived between periods.
4. **Decision parent** — a decision can currently only be product-parented
   (`productId`). Confirm activities should own decisions too (this change assumes
   yes, for full parity); if not, restrict the XOR to items and risks.
