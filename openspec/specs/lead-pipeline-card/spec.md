# lead-pipeline-card Specification

## Purpose

TBD - created by archiving change rethink-pipeline-state-vs-completeness. Update Purpose after archive.

## Requirements

### Requirement: The pipeline card separates product health from own-input completeness

The lead SDLC pipeline product card MUST encode two orthogonal signals with two
distinct affordances, so "is this product healthy?" and "did I finish my input?"
never share one cue.

1. The product **health** signal (left edge) MUST reflect risk/blocker severity
   contributed by any stage owner: when a covering risk or blocker exists for
   the product, the left edge MUST show that severity (at-risk / blocked) and
   MUST NOT read as healthy/green.
2. The **own-input completeness** signal MUST be a separate affordance (not the
   health color) indicating whether the responsible person has completed their
   input for the product.

(Direction captured from live-walk feedback; the exact completeness rule and
the completeness affordance are open design questions in proposal.md.)

#### Scenario: a stage owner flagged a blocker on an otherwise-filled product

- **WHEN** a product has a covering blocker raised by a stage owner and the
  lead has filled all their input
- **THEN** the left edge shows the blocked severity (not green)
- **AND** the completeness affordance shows the input as complete — the two
  signals are independent

#### Scenario: a healthy product with incomplete input

- **WHEN** a product has no covering risk but the lead has not finished their
  input
- **THEN** the left edge reads healthy
- **AND** the completeness affordance shows the input as incomplete

### Requirement: Stage status is derived from one source — the covering risks

The displayed stage/product status MUST be derived from the risks that cover the
stage, so the Risks section and the status display can never disagree. There is
no separate manual status that can drift from the risks.

1. Adding or removing a covering risk MUST immediately update the stage chip,
   the left edge, and any slide/preview view — with no manual re-sync step.
2. A stage MAY be covered by multiple risks (one-to-many). The displayed status
   MUST collapse to the HIGHEST covering severity (blocker > at-risk >
   on-track); all covering risks remain listed.
3. Because status is derived, the legacy "stage marked at-risk/blocked without a
   backing risk" warning MUST be removed — it can no longer occur.

#### Scenario: a risk is added in the Risks section

- **WHEN** a lead adds a blocker covering the Development stage
- **THEN** the Development chip and the product left edge show blocked
  immediately, with no separate sync action

#### Scenario: a stage is covered by both a risk and a blocker

- **WHEN** one stage is covered by an at-risk AND a blocker risk
- **THEN** the displayed stage status is blocked (highest severity)
- **AND** both covering risks remain visible in the Risks section

### Requirement: Own-input completeness counts only stages the lead explicitly set

Own-input completeness (D1) MUST count a stage as addressed when EITHER
the lead set an explicit non-empty status on it OR the stage is covered
by the current lead's OWN non-empty staged risk. A risk is the lead's
input about that stage, so a stage the lead never explicitly set still
counts when their own risk covers it. The counter MUST be derived from a
`coveredByOwnRisk` annotation placed on the raw stage by the read-model
mapper (`mapLeadProducts` in `apps/web/src/lib/mappers/lead-form.ts`),
where `computeCompleteness` counts a stage when
`status !== "empty" || coveredByOwnRisk`. Two cases MUST NOT inflate the
counter:

1. A foreign or cross-author covering risk MAY color the chip (display
   floor) but MUST NOT set `coveredByOwnRisk` and MUST NOT count toward
   this lead's completeness — another lead's risk never finishes this
   lead's input.
2. A stage-less legacy risk (empty `stageIds`) MUST contribute ZERO. The
   annotation MUST NOT reuse the display-floor `riskCoversStage`
   predicate that treats an empty `stageIds` as covering all stages; a
   stage-less risk covers no stage for completeness.

This MUST hold on reload: `coveredByOwnRisk` is derived from the
persisted own risks plus the raw per-stage status, never from transient
floored display state.

#### Scenario: an untouched stage covered by the lead's own staged risk counts

- **WHEN** the lead owns three stages with no explicit status set, and
  saves one own risk that explicitly covers all three stages
- **THEN** the three stage chips render at the risk severity (display floor)
- **AND** the completeness counter reads 3 of 3 because each stage is
  `coveredByOwnRisk`
- **AND** after a page reload the counter still reads 3 of 3 — derived
  from the persisted risk plus raw status

#### Scenario: a foreign covering risk colors but does not count

- **WHEN** an untouched stage the lead owns is covered only by another
  author's risk
- **THEN** the chip renders at the covering severity (display floor)
- **AND** the completeness counter does NOT count that stage —
  `coveredByOwnRisk` is false for a foreign risk

#### Scenario: a stage-less legacy own risk counts zero

- **WHEN** the lead has an own risk with an empty `stageIds` array and no
  explicit status is set on any of the lead's stages
- **THEN** the legacy risk contributes zero to completeness
- **AND** the counter does not treat the empty `stageIds` as covering
  every stage

### Requirement: The pipeline chip distinguishes risk-covered from explicit status

A stage chip MUST visually distinguish risk-covered from explicit
status. The chip in `SdlcPipeline`
(`apps/web/src/components/lead/sdlc-pipeline.tsx`) MUST visually
distinguish a stage that is addressed because it is `coveredByOwnRisk`
from a stage that is addressed because the lead set an explicit status,
even when both render at the same severity color. The distinction MUST
also be exposed non-visually through the chip's `aria-label` and tooltip
text (e.g. "Blocked by risk" versus "Blocked — status set"), so a
non-visual user gets the same distinction as a sighted one.

#### Scenario: a risk-covered chip is distinguishable from a status-set chip

- **WHEN** one chip is addressed only via the lead's covering risk and
  another chip at the same severity is addressed via an explicit status
- **THEN** the two chips are visually distinguishable
- **AND** each chip's `aria-label` and tooltip name whether it is covered
  by a risk or has an explicit status set
