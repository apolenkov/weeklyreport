## Why

Live page feedback on `/admin?tab=products`: if nobody is assigned to an SDLC
stage on a product, that stage should be treated as **out of reporting** — as if
it does not exist for the product — not shown as a grey "unassigned" chip the
lead can neither fill nor act on. This lets an org drop stages it has no one to
report (e.g. a product with no DevOps owner simply has no DevOps stage), instead
of every product always carrying all seven stages with greyed gaps.

The grey "unassigned" chips are a web-only synthesis: `buildStageGrid` maps over
all seven canonical stage names and marks any non-owned stage `unassigned`. The
backend already never sends vacant stages, and the slides, head portfolio
(`stageCount = stageAssignments.length`), product-health roll-up, and own-input
completeness are ALL already assignment/owned-scoped. So no traffic-light number
changes — this brings the lead pipeline card into parity with every other
surface and removes a misleading affordance.

## What Changes

- **An unassigned stage is excluded from a product's stage set.** A stage with
  no assignment on a product is not rendered (Mine or Everyone), not counted, and
  not awaited — as if the stage does not exist for the product. No exception:
  exclusion is purely assignment-driven.
- **Health stays traceable without keeping the stage.** Today a risk only floors
  product health through OWNED stages, so a risk on a stage nobody owns never
  drove the traffic light — excluding such a stage changes no health number. The
  covering risk itself is always listed in the risk section (it names the stage),
  so any severity stays explained by a visible object.
- **Foreign-owned stays.** A stage assigned to ANOTHER lead is not unassigned —
  it remains a (hidden-in-Mine, locked-in-Everyone) part of the pipeline. The
  change removes only the truly-unassigned render category.
- **The product's stage set is sourced from assignments across all leads**, so
  the web no longer synthesizes a chip per canonical stage name. This needs the
  per-product assigned-stage set on the read model — the lead's own `ownedStages`
  is not enough to tell "vacant" from "owned by someone else". The `stageSet` is
  READ-ONLY display metadata: the write path stays `ownedStages`-only, so a lead
  can never persist a status for a stage they do not own.
- **Published snapshots are frozen.** This governs the live/draft pipeline only;
  a published report's snapshot is not retroactively changed by later assignment
  edits.
- **`lead-pipeline-card` spec amended** — the requirements that mandate rendering
  vacant/unassigned chips (Everyone mode, the collapsed-indicator "unassigned"
  rows and grey severity) are updated: the "unassigned" render category is gone.

## Capabilities

- `lead-pipeline-card` — the stage-set membership rule and the pipeline /
  collapsed-indicator rendering of non-owned stages (ADDED + MODIFIED).

## Impact

- Shared/API: expose a per-product **assigned stage set** (union of all leads'
  assignments on the product) on the lead read model as READ-ONLY display
  metadata — `report-sections.prisma-repository.ts` (+ the read-model schema).
  The writable `ownedStages` is unchanged; `stageSet` never feeds the save path.
- Web: `apps/web/src/lib/mappers/lead-form.ts` (`buildStageGrid` builds the grid
  from the product's stage set, not all seven names),
  `apps/web/src/lib/mappers/lead-cross-author.ts` (foreign-owned stages now
  inserted, not upgraded-from-unassigned),
  `apps/web/src/components/lead/sdlc-pipeline.tsx`, `sdlc-hidden-stages.ts`,
  `sdlc-collapsed-indicator.tsx`, `stage-chip.tsx` (retire the `unassigned`
  render path; `LeadStageOwnership` may drop `"unassigned"`).
- No traffic-light / health / completeness number changes (all already
  assignment/owned-scoped). No schema migration for the rule itself; the only
  data question is the read-model shape (additive field).
- Open forks recorded in design.md: inactive-user assignments still count as
  "assigned"; persisted `StageStatus` for a now-unassigned stage is preserved.
