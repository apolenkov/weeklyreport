# status-risk-unification

## ADDED Requirements

### Requirement: Published product status is floored by the author's own covering risks

The published product-level traffic-light status MUST reflect the section author's
own at-risk/blocked covering risks, so a product where the section author's only
non-green signal is an **owned stage with no submitted status** (raw
`StageStatus.status = null`) covered by an own risk MUST NOT publish as green.
The floor is applied at the read/aggregation layer where the product-level status
is derived (`mapPrismaToReportSection` in
`apps/api/src/modules/report-sections/report-sections.prisma-repository.ts`),
producing a **derived, aggregation-only effective product status**
(`effectiveWorstStatus`) that is consumed by every published reader but never
stored as a new persisted field. Every published reader inherits it — the
head/weekly view (`buildPortfolioProductsFromSnapshotSections` →
`computeWorstStatus`), the portfolio overview
(`computePortfolioOverviewFromReadSections`), and the PDF export
(`pdf-export.prisma-repository.ts`). Unowned (unassigned) empty stages are a
separate concern addressed in the `realistic-small-demo-seed` change and are out
of scope here.

For each owned stage the effective status is the worse of the raw stage status and
the highest covering own-risk severity, with precedence blocked > at-risk >
on-track > empty, mirroring the canonical `riskCoversStage` and
`deriveEffectiveStageStatus`. A risk with an empty or absent `stageNames` array
covers every stage the author owns on that product (covers-all). The product
status is the worst effective stage status across the product's owned stages. The
floor only raises severity; it never lowers a stage that is already worse. The
raw persisted `StageStatus.status` column MUST NOT be mutated; only the
derived product-level effective status changes.

The fold MUST be scoped to the product before matching by stage. A risk floors a
product's status only when `risk.projectId` equals that product, because
`riskCoversStage` matches on stage NAME only and the SDLC stage names are shared
across products. A covers-all risk therefore covers all stages of ITS OWN product,
never other products.

This closes the gap the existing "Covering risks force a severity floor on stage
chips" requirement assumed away: that requirement states the head-form, preview,
and PDF surfaces reflect the risk through the product-level `worstStatus`, but
`worstStatus` was NOT risk-aware for an owned stage with no submitted status
covered by an own risk. The slide deck (`floorSlideStageStatus`) already floors
correctly and is unchanged.

#### Scenario: an owned stage with no submitted status covered by a covers-all own blocked risk floors to red

- **WHEN** the section author owns a stage with no submitted status (raw `StageStatus.status = null`) and has filed an own blocked risk whose `stageNames` is empty (covers-all)
- **THEN** the published product traffic-light / `worstStatus` reads red
- **AND** the head view, the portfolio overview, and the PDF export all read red, not the green `ProjectStatus` fallback

#### Scenario: an owned stage with no submitted status covered by a covers-all own at-risk risk floors to yellow

- **WHEN** the section author owns a stage with no submitted status (raw `StageStatus.status = null`) and has filed an own at-risk risk whose `stageNames` is empty (covers-all)
- **THEN** the published product traffic-light / `worstStatus` reads yellow
- **AND** the head view, the portfolio overview, and the PDF export all read yellow, not the green `ProjectStatus` fallback

#### Scenario: an owned stage with no submitted status covered by a stage-named own at-risk risk floors to yellow

- **WHEN** the section author owns a stage with no submitted status and has filed an own at-risk risk whose `stageNames` names exactly that stage
- **THEN** the published product traffic-light / `worstStatus` reads yellow
- **AND** a sibling owned stage the risk does not name keeps its own status

#### Scenario: the raw stage status and completeness counter are unchanged

- **WHEN** the published product status is floored up by an own covering risk on an owned stage with no submitted status
- **THEN** the stage's raw persisted `StageStatus.status` stays null/empty (the empty→empty guard)
- **AND** the X/7 own-input completeness counter and the `coveredByOwnRisk` annotation keep their existing semantics — the floor changes only the derived product-level effective status, not the per-stage raw persisted status

#### Scenario: an own risk never lowers a worse stage status

- **WHEN** an owned stage already reads red from a worse signal and the author has an own at-risk risk covering it
- **THEN** the published product status stays red
- **AND** the milder risk does not lower the product below the existing severity

#### Scenario: a covers-all risk floors only its own product

- **WHEN** a section owns two products and the author files one covers-all (empty `stageNames`) blocked risk on Product A only, with Product B all green
- **THEN** Product A's published product status reads red
- **AND** Product B stays green — the risk does not floor Product B's same-named stages

## MODIFIED Requirements

### Requirement: Covering risks force a severity floor on stage chips

A stage chip, AS DISPLAYED, MUST render at least at the highest covering
risk's severity when its stage is covered by at least one non-empty own
risk (precedence: blocked > at-risk). The DISPLAYED chip MUST NOT show
on-track or empty while covering risks exist. This DISPLAY floor is
applied at RENDER time — by the live lead form (`applyRiskSeverityFloor`
in `lead-form-sync-bridge.tsx`) and the slides/head-review surface
(`floorSlideStageStatus` in `section-slide-utils.ts`), both deriving the
severity through the shared `deriveEffectiveStageStatus`.

The RAW read-model status is a SEPARATE layer from the displayed chip. The
mapper (`mapLeadProducts` in `apps/web/src/lib/mappers/lead-form.ts`)
applies the floor to a NON-EMPTY stage (via `deriveEffectiveStageStatus`:
floor up to a worse covering risk, collapse a stale unbacked severity
down) but PRESERVES an EMPTY stage's raw status as empty — the empty→empty
guard. It MUST NOT floor an EMPTY stage's RAW status up to a covering
severity; it records that coverage separately via the `coveredByOwnRisk`
annotation. This raw empty is NOT what the chip displays — the render
floor above already prevents an empty-looking covered chip — it is what
the X/7 completeness counter (which must not count foreign-covered stages)
and the chip's risk-covered-vs-status-set distinction rely on.

The head-form, preview, and PDF/print surfaces carry no per-stage grid —
they render the product-level `worstStatus`. That product-level status is
made risk-aware at the read/aggregation layer by the "Published product
status is floored by the author's own covering risks" requirement, INCLUDING
the empty-stage covered-by-own-risk case that the raw per-stage status leaves
empty. This supersedes the PRJ-2 decision that disconnected risk-derived
status in `mapLeadProducts`.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked
  covering the Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra
  confirmation

#### Scenario: a stale persisted on-track status is floored on load

- **WHEN** a draft loads whose persisted explicit stage status is
  on-track while a non-empty covering risk with severity at-risk
  exists
- **THEN** the chip renders at-risk on the lead form and the head-review
  slides (a non-empty status is floored by the mapper too — only an empty
  status is preserved)
- **AND** the head-form and PDF/print surfaces (which carry no per-stage
  grid) reflect the risk through the product-level `worstStatus`

#### Scenario: the read-model mapper preserves raw status and annotates coverage

- **WHEN** the read-model mapper builds the view of a product whose owned stage has no submitted status (raw `StageStatus.status = null`) but a non-empty covering own risk
- **THEN** the mapper keeps the stage's raw persisted `StageStatus.status` null/empty and sets `coveredByOwnRisk` to true (it does NOT floor the raw status)
- **AND** the live lead form and the slides/head-review surface re-floor the chip to the risk severity at render, while the head-form, preview, and PDF export surfaces (which have no per-stage grid) reflect the risk through the derived product-level effective status (`effectiveWorstStatus`) made risk-aware at aggregation — so no surface shows an un-floored empty
