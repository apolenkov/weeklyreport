# status-risk-unification — delta

## MODIFIED Requirements

### Requirement: Risks are the single source of truth for at-risk/blocked

At-risk and blocked states MUST be authored only as risk rows in the Risks
section of the lead report. Stage chips (`SdlcPipeline` in
`apps/web/src/components/lead/sdlc-pipeline.tsx`) MUST NOT author an
at-risk/blocked state at all: a chip has no status menu and offers no
At Risk/Blocked option. An editable chip is a plain toggle between unset (empty)
and On Track. A covering risk floors the chip's DISPLAYED severity at render;
while a covering risk exists the chip MUST NOT be settable to On Track — clicking
it leaves the status unchanged and directs the lead to resolve the risk in the
Risks section. Removing every covering risk returns the chip to its stored On
Track or unset status.

#### Scenario: a chip click toggles On Track, never a severity

- **WHEN** the lead clicks an editable, uncovered stage chip
- **THEN** the chip toggles between unset and On Track only
- **AND** no status menu is shown and no at-risk/blocked option exists

#### Scenario: a covered chip cannot be set on-track from the chip

- **WHEN** the lead clicks a stage chip that a covering risk floors to
  at-risk or blocked
- **THEN** the status is unchanged and the lead is directed to resolve the
  risk in the Risks section

#### Scenario: removing the covering risk un-floors the chip

- **GIVEN** a chip floored to blocked by a single covering risk
- **WHEN** the lead deletes that risk in the Risks section
- **THEN** the chip returns to its stored On Track or unset status without any
  chip interaction

### Requirement: Covering risks force a severity floor on stage chips

A stage chip, AS DISPLAYED, MUST render at least at the highest covering risk's
severity when its stage is covered by at least one non-empty own risk
(precedence: blocked > at-risk). The DISPLAYED chip MUST NOT show on-track or
empty while covering risks exist. This DISPLAY floor is applied at RENDER time —
by the live lead form (`applyRiskSeverityFloor` in `lead-form-sync-bridge.tsx`)
and the slides/head-review surface (`floorSlideStageStatus` in
`section-slide-utils.ts`), both deriving the severity through the shared
`deriveEffectiveStageStatus`.

The render floor MUST also COLLAPSE a stale unbacked severity: a stage whose raw
status is at-risk/blocked but which has NO covering risk MUST render as On Track
on the live form, matching the read-model mapper. `applyRiskSeverityFloor` MUST
route every own stage through `deriveEffectiveStageStatus` (not only stages with
a covering risk), so the live form and read model never disagree on an orphan
explicit severity. This also serves as the migration for legacy explicit
at-risk/blocked stage rows — they render On Track on next load with no backfill.

The RAW read-model status is a SEPARATE layer from the displayed chip. The
mapper (`mapLeadProducts` in `apps/web/src/lib/mappers/lead-form.ts`) applies the
floor to a NON-EMPTY stage (via `deriveEffectiveStageStatus`: floor up to a worse
covering risk, collapse a stale unbacked severity down) but PRESERVES an EMPTY
stage's raw status as empty — the empty→empty guard. It records coverage
separately via the `coveredByOwnRisk` annotation for the completeness counter.

#### Scenario: saving a risk raises the covered chip

- **WHEN** the lead saves a non-empty risk with severity blocked covering the
  Development stage whose chip shows on-track
- **THEN** the Development chip renders blocked without any extra confirmation

#### Scenario: an orphan explicit severity collapses on the live form

- **WHEN** a draft loads whose persisted explicit stage status is blocked while
  no covering risk exists
- **THEN** the chip renders On Track on the live lead form, matching the read
  model, and no chip interaction is needed to correct it

#### Scenario: the read-model mapper preserves raw status and annotates coverage

- **WHEN** the read-model mapper builds the view of a product whose stage has an
  empty status but a non-empty covering own risk
- **THEN** the mapper keeps the stage's raw status empty and sets
  `coveredByOwnRisk` to true (it does NOT floor the raw status)
- **AND** the live lead form and the slides/head-review surface re-floor the
  chip to the risk severity at render

## ADDED Requirements

### Requirement: Unset stages auto-promote to On Track at submit after a warning

At submit, any of the lead's own stages left unset (empty) MUST be promoted to
On Track in the submitted section, mirroring the existing null→green coercion for
project and activity statuses. The submit-confirm dialog MUST warn the lead
first, stating how many stages will be marked On Track; the promotion MUST NOT
block submit. While editing (before submit) an unset stage remains a valid state.

#### Scenario: the submit-confirm dialog warns about unset stages

- **GIVEN** a section with two of the lead's own stages left unset
- **WHEN** the lead opens the submit confirmation
- **THEN** the dialog states that 2 stages are not set and will be marked On
  Track

#### Scenario: confirming submit promotes unset stages to On Track

- **WHEN** the lead confirms submit with unset own stages
- **THEN** those stages are submitted as On Track and submit proceeds

#### Scenario: no unset stages shows no warning

- **GIVEN** a section where every own stage has a status
- **WHEN** the lead opens the submit confirmation
- **THEN** no unset-stage warning is shown

## REMOVED Requirements

### Requirement: Lowering a covered chip requires confirmed risk removal

**Reason**: The chip no longer authors or lowers at-risk/blocked. With the chip
reduced to a plain On Track/unset toggle and alarms owned solely by the Risks
section, there is no chip gesture that lowers a covered stage — the lead removes
the covering risk in the Risks section and the chip un-floors automatically. The
confirmation dialog, `pendingLower`/`confirmLower`, and the cross-author
lower-block message are removed with it.

**Migration**: To clear a risk-floored chip, delete or re-scope the covering
risk in the Risks & Blockers section; the chip returns to its stored On Track or
unset status at render. No data migration is required.
