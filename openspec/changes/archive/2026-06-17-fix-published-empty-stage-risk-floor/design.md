# Design: fix-published-empty-stage-risk-floor

## Context

Confirmed by audit. Three layers cooperate to hide an owned at-risk/blocked risk
behind a green published product. The bug case is an **owned stage with no
submitted status** (raw `StageStatus.status = null`, i.e. the author owns the
stage but has not yet set a status) covered by the section author's **own risk**.
An unowned (unassigned) stage is a separate concern and is out of scope here.

1. `buildStageGrid` (`apps/web/src/lib/mappers/lead-form.ts:383-390`) applies the
   risk floor only to a NON-EMPTY stage. An owned stage with no submitted status
   keeps raw `status: empty` (the empty→empty guard from W11 — it protects the
   X/7 completeness counter and the risk-covered-vs-status-set chip distinction).
   This is the read model the lead form consumes; the floor it skips is re-applied
   at render by `applyRiskSeverityFloor` and `floorSlideStageStatus`.
2. On the API read path, `aggregateStageTraffic`
   (`report-sections.prisma-repository.ts:121-140`) folds only non-null stage
   statuses. An all-empty product gives `null`, so
   `trafficLight = aggregateStageTraffic(ownedStages) ?? projectStatus ?? null`
   falls back to the explicit `ProjectStatus` — typically green.
3. The published rollups (`published-report-snapshot.ts`) read that raw
   `trafficLight` into `worstStatus` / portfolio totals and never look at
   `section.risks`.

The slide deck does NOT have this gap: `floorSlideStageStatus`
(`status-risk-unification` spec) floors slide chips from risks at render. So the
slide surface already reads red while the published product status reads green —
the two disagree on the same data.

The `status-risk-unification` spec already claims the head-form, preview, and PDF
surfaces "reflect the risk through the product-level `worstStatus`". That claim is
false for an empty covered stage. This change makes it true.

## Decisions

### D1 — Fold own covering risks into the product status at the read layer

The product-level traffic-light/`worstStatus` MUST reflect the section author's
own covering risks. For each owned stage, the **effective per-stage status** is the
worse of the raw stage status and the highest covering own-risk severity
(blocked > at-risk). The **product status** is the worst effective stage status
across all owned stages of that product. This computation produces a
**derived, aggregation-only effective product status** (referred to as
`effectiveWorstStatus` in this change); it is consumed at the read layer by all
published readers and is NOT a new persisted field. This mirrors the canonical
`deriveEffectiveStageStatus` precedence and the `riskCoversStage` matcher.

CRITICAL — scope risks to the product FIRST. `riskCoversStage(risk, stageName)`
matches on stage NAME only; it has no `projectId` check, and the 7 SDLC stage
names are shared across every product. `section.risks` / `row.risks` is a FLAT
list spanning all of the section's products. So the fold for product P MUST
consider only `section.risks` where `risk.projectId === P.id`, and only THEN apply
`riskCoversStage` per owned stage. This mirrors the existing `buildStageGrid` call
site (`lead-form.ts:438-445`), which pre-filters
`section.risks.filter(r => r.projectId === p.projectId)` before passing risks in.
Without this filter, a "Testing" risk on Product A would floor Product B's Testing
stage, and a covers-all (empty `stageNames`) risk on any product would floor EVERY
product in the section red.

### D2 — Empty `stageNames` means "covers all assigned stages"

A risk with an empty/absent `stageNames` array covers every stage the author owns
on that product (the `riskCoversStage` `stageIds.length === 0 → true` rule). The
covers-all case is the one that most often slips through, because it names no
stage explicitly. It MUST floor the product status. A stage-named risk floors only
the stages it names. Covers-all is "all stages of THE SAME PRODUCT", not all
products — the product-scoping filter in D1 bounds it (an empty-`stageNames` rule
returns `true` unconditionally, so without the `projectId` filter it would floor
every product).

### D3 — Apply the floor at aggregation/read, so ALL published readers inherit it

There are TWO product-status source shapes on the published path. The mapper fix
covers the first; the second needs an explicit re-route.

Shape A — `ReportSectionReadModel.projects[].trafficLight` (floored by the mapper):

- `buildPortfolioProductsFromSnapshotSections` → `computeWorstStatus` — head /
  weekly view (`weekly-report.prisma-repository.ts:188`).
- `computePortfolioOverviewFromReadSections` — portfolio status from
  `project.trafficLight` (snapshot scoping path).
- `mapPrismaToReportSection` `trafficLight` — also consumed by the PDF export
  product mapping (`pdf-export.prisma-repository.ts:163-164`).

Shape B — raw `projectStatuses` (NOT floored by the mapper, must be re-routed):

- `computePortfolioOverviewFromProjectStatuses` (line 248) — called by
  `buildAssembledReportFromPrismaRow` (line 46), the main published-snapshot
  builder used by publication / archive / period. Computes the published top-line
  portfolio totals directly from raw `projectStatuses`, bypassing `trafficLight`.
- `computePortfolioOverview` in `pdf-export.prisma-repository.ts` (line 135) — the
  PDF top-line totals, same raw `projectStatuses` source.

Applying the floor where `trafficLight` is first derived
(`mapPrismaToReportSection`, where `section.risks` and `ownedStages` are both in
scope) fixes every Shape-A reader in one place. For Shape B, the published and PDF
totals MUST be re-routed onto the floored `trafficLight` (i.e. count
`project.trafficLight` per product, as `computePortfolioOverviewFromReadSections`
already does) so the top-line totals agree with the per-product cards inside the
same document. Leaving them on raw `projectStatuses` would publish a red product
card under a green portfolio total — the exact split this change exists to remove.
This is the Codex blind-spot #7 guard: fix every source shape, not one reader.

### D3a — Escalations change too (intended, must be pinned)

`buildEscalationsFromReadSections` (line 223) is a `trafficLight` reader: it emits
an `at_risk` "Project X is flagged red" escalation for each red product. Once the
floor turns the bug case red, a new escalation fires alongside the existing
per-risk `unresolved_risk` one. The product genuinely is red, so the
double-surfacing is acceptable; it MUST be pinned by a test expectation so the
behaviour change is deliberate, not silent.

### D4 — Do NOT mutate the raw persisted stage status

The fix derives a risk-aware effective product status at the read/aggregation
layer only. It MUST NOT write the floored severity back onto a `StageStatus` row's
raw `status` column or onto the read-model per-stage `status` field. The
`effectiveWorstStatus` is computed on read and is never stored. The empty→empty
guard, the X/7 completeness counter (which must not count foreign-covered or
covers-all stages), and the `coveredByOwnRisk` annotation all depend on the raw
empty staying empty. Mutating the persisted `StageStatus.status` would break W11.

### D5 — Cross-app-boundary: mirror or lift the precedence helper

`riskCoversStage` (`apps/web/src/components/lead/stage-tags.ts`) and
`deriveEffectiveStageStatus` (`apps/web/src/lib/stage-status.ts`) live under
`apps/web/**`. The API module cannot import across the app boundary. The
implementer either (a) re-states the small precedence rule (blocked > at-risk,
empty-`stageNames` = covers-all) inside the API module, or (b) lifts a shared
helper into `packages/shared` and has both surfaces use it. Either is acceptable;
(b) is preferred if it does not balloon scope, because it removes the
duplicate-logic drift risk the spec's single-source-of-truth claim depends on.

### D6 — Ownership is the section author's own contribution

`section.risks` on a `ReportSectionReadModel` are the section author's own
contribution — the records that lead authored (the read model is per-section). The
product-status fold uses those own risks. This change does NOT introduce
cross-author risk folding into one section's product status; the published product
status is per-section, and the head rollup already takes the worst across sections
via `computeWorstStatus`. So a co-owner's risk reaches the product through that
co-owner's own section, then the worst-across fold — consistent with today's
portfolio aggregation.

## Edges (resolved)

- An owned stage with no submitted status, one covers-all own **blocked** risk → product red (the headline bug case).
- An owned stage with no submitted status, one covers-all own **at-risk** risk → product yellow.
- All-empty product, one stage-named own at-risk risk → yellow on that stage,
  product yellow.
- Stage already red from a worse explicit status, a milder own risk → stays red
  (worse-wins; the floor never lowers).
- Stage on-track, own at-risk risk → yellow (floor up).
- No covering risk, stale explicit at-risk with nothing backing it → the existing
  derivation already collapses unbacked severity; this change does not change that
  path, it only adds the floor-up from risks. (If parity with
  `deriveEffectiveStageStatus` collapse-down is desired on the published path,
  call that out — but the locked scope is the floor-up for the empty covered case.)
- Decisions / items → unchanged. Items already contribute via the existing
  blocked-item path on the live form; the published product-status fold here is
  risk-driven per the single-source-of-truth rule.

## Open questions

- None blocking. If the implementer chooses helper-lift (D5b), confirm the shared
  helper has no `apps/web` React import that blocks API use.
