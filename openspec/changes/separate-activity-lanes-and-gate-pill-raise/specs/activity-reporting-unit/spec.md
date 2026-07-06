# activity-reporting-unit — delta

## MODIFIED Requirements

### Requirement: An activity's status is derived from its own risks and blockers

An activity's traffic-light status MUST be derived from the activity's OWN risks
and blockers, never from SDLC stages (it has none) and never from a linked
product. When the activity owns a blocked item its status MUST be floored to red
(blocked); when it owns an at-risk or blocked risk its status MUST be floored to
at least that severity (precedence: blocked > at-risk). The lead MUST NOT be able
to lower the pill below the floor manually; the surface MUST explain the floor
with a message telling the lead to remove the risk/blocker first.

A manual raise MUST NOT be the only record of an alarm: clicking At Risk or
Blocked without a sufficient covering risk (blocked requires a covering blocked
risk; at-risk accepts any covering risk) MUST NOT persist the status and MUST
instead open the risk entry in create mode with the activity preselected as the
parent and the clicked severity prefilled — the pill analogue of the stage-chip
raise interception. On-track remains directly settable whenever no floor holds
the pill up. The interactive pill MUST derive its alarm floor from the live
draft risks so a just-created activity risk floors the pill without a
save/refetch round-trip.

#### Scenario: a blocked item forces the activity red

- **GIVEN** an activity that owns one item with `workflowStatus=blocked`
- **WHEN** the lead tries to set the activity's pill to on-track (green)
- **THEN** the pill stays red and the manual change is refused with a
  remove-the-blocker-first message

#### Scenario: an at-risk risk floors the activity to at-risk

- **GIVEN** an activity that owns one risk of severity at-risk and no blocker
- **WHEN** the activity status renders
- **THEN** the pill shows at least at-risk (yellow) and cannot be manually
  lowered to on-track

#### Scenario: no risk or blocker leaves the manual on-track choice intact

- **GIVEN** an activity with no risks and no blockers
- **WHEN** the lead sets the pill to on-track
- **THEN** the on-track status is accepted and persisted

#### Scenario: an unbacked raise routes through activity-scoped risk creation

- **GIVEN** an activity with no covering risk or blocker
- **WHEN** the lead clicks the pill's At Risk (or Blocked) option
- **THEN** the status is not applied
- **AND** the risk entry opens in create mode with the activity preselected as
  the parent and the clicked severity prefilled

#### Scenario: cancelling the prefilled risk entry leaves the pill unchanged

- **GIVEN** the risk entry opened by an unbacked pill raise
- **WHEN** the lead cancels it
- **THEN** the pill keeps its previous status and no risk row is created

#### Scenario: a saved activity risk floors the pill immediately

- **GIVEN** the risk entry opened by an unbacked Blocked click on an activity
- **WHEN** the lead saves the risk
- **THEN** the activity's pill renders blocked (red) without a reload
