# status-risk-unification Specification

## ADDED Requirements

### Requirement: Item cards derive at-risk/blocked from covering risks

An item's at-risk/blocked alarm MUST be derived from a covering risk row, never
set as a free workflow choice, exactly as the stage chip is — the item card is a
governed surface under the single-source-of-truth rule. This extends the
"Risks are the single source of truth for at-risk/blocked" requirement from the
stage chip (`SdlcPipeline`) to the item card
(`apps/web/src/components/lead/item-card.tsx`). The detailed derivation,
locked-alarm UX, route-through-blocker-creation, and stored-representation rules
live in the `record-status-derivation` capability; this requirement fixes the
invariant so the two surfaces cannot drift.

#### Scenario: an item card never authors an unbacked alarm

- **GIVEN** an item with no covering risk row
- **WHEN** the lead attempts to set it to at-risk or blocked
- **THEN** the alarm is not stored on the item directly
- **AND** the gesture routes through risk (blocker) creation, mirroring the stage-chip interception

#### Scenario: a covered item card is floored to the covering severity

- **GIVEN** an item whose product and stage are covered by an own risk of severity blocked
- **WHEN** the item card renders
- **THEN** the item pill shows Blocked, floored from the covering risk
- **AND** the alarm cannot be cleared from the item without resolving the covering risk
