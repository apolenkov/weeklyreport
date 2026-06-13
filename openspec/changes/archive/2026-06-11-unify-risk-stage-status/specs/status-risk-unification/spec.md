## ADDED Requirements

### Requirement: Risks are the single source of truth for at-risk/blocked

At-risk and blocked states MUST be authored only as risk rows in the
Risks section of the lead report. Stage chips (`SdlcPipeline` in
`apps/web/src/components/lead/sdlc-pipeline.tsx`) MUST NOT create an
at-risk/blocked state that is not backed by a risk row; chip
interactions that imply such a state route through risk creation or
deletion instead.

#### Scenario: a chip click is never the only record of a risk

- **WHEN** the lead attempts to set a stage chip to at-risk or blocked
  and no covering risk row exists
- **THEN** the stage status is not applied directly
- **AND** the risk edit dialog opens in create mode prefilled with the
  product, the clicked stage, and the clicked severity

#### Scenario: cancelling the prefilled dialog leaves the chip unchanged

- **WHEN** the lead cancels the risk edit dialog opened by a chip
  interception
- **THEN** the chip keeps its previous status and no risk row is
  created

### Requirement: Covering risks force a severity floor on stage chips

A stage chip MUST render at least at the highest covering risk's
severity when its stage is covered by at least one non-empty own risk
(precedence: blocked > at-risk). The chip MUST NOT show on-track or
empty while covering risks exist. The floor MUST apply consistently in
the live lead form and in the read-model mapper (`mapLeadProducts` in
`apps/web/src/lib/mappers/lead-form.ts`), so the head review surface
and PDF export agree with the lead form. This supersedes the PRJ-2
decision that disconnected risk-derived status in `mapLeadProducts`.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked
  covering the Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra
  confirmation

#### Scenario: a stale persisted on-track status is floored on load

- **WHEN** a draft loads whose persisted explicit stage status is
  on-track while a non-empty covering risk with severity at-risk
  exists
- **THEN** the chip renders at-risk on the lead form, head review, and
  export surfaces

### Requirement: Lowering a covered chip requires confirmed risk removal

Setting a covered chip to on-track MUST ask for confirmation that
names the consequence before any state changes. On confirm, each
covering own risk MUST either be deleted (the clicked stage was its
only stage) or have the clicked stage removed from its `stageIds`
(it covers other stages — surviving risks keep at least one stage).
On cancel, chip and risks MUST be unchanged. If any covering risk
belongs to another author, the lowering MUST be blocked with an
explanatory message instead of deleting foreign data.

#### Scenario: confirming the lowering deletes the covering risk

- **WHEN** the lead sets a chip to on-track whose stage is covered by
  one single-stage own risk and confirms the dialog
- **THEN** that risk row is deleted and the chip flips to on-track

#### Scenario: a multi-stage risk survives with the stage stripped

- **WHEN** the lead confirms lowering a chip covered by a risk that
  also covers another stage
- **THEN** the risk row survives with the clicked stage removed from
  its `stageIds`
- **AND** the other covered chip keeps its severity floor

#### Scenario: cancelling the confirmation changes nothing

- **WHEN** the lead cancels the deletion confirmation
- **THEN** the chip keeps its at-risk/blocked status and all risk rows
  are unchanged
