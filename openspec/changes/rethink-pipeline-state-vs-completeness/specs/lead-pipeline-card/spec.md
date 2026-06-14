## ADDED Requirements

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

Own-input completeness (D1) MUST count a stage as "filled" only when the lead
set an explicit status on it. The risk-derived severity floor is a DISPLAY
concern and MUST NOT make an untouched stage count toward completeness — a stage
the lead never set stays uncounted even while a covering risk shows it at a
severity in the pipeline. This MUST hold on reload (a persisted covering risk
must not inflate the counter), so completeness reads the raw per-stage status,
not the floored display status.

#### Scenario: a covering risk floors an untouched stage for display only

- **WHEN** the lead owns three stages with no explicit status set, and adds one
  risk that covers all three
- **THEN** the three stage chips render at the risk severity (display floor)
- **AND** the completeness counter still reads 0 of 3 (none explicitly set)
- **AND** after a page reload the counter still reads 0 of 3 — the persisted
  covering risk does not inflate it to complete
