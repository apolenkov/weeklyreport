## MODIFIED Requirements

### Requirement: One stored progress vocabulary independent of week placement

Current and Next Items MUST share one stored progress vocabulary: `planned | in_progress | paused | postponed | done`, independent of placement, derived alarm, and carried confirmation. Current `planned` MUST mean Not started. Rollover MUST preserve explicit-commitment precedence and lead confirmation: an eligible commitment becomes Current `planned`; fallback Current `in_progress` stays `in_progress`; both remain carried and unconfirmed.

#### Scenario: In-progress work moves to Next without changing progress

- **WHEN** an authorized lead saves `Move to next week` for an eligible Current `in_progress` item without a separate next commitment
- **THEN** validation, persistence, and projection accept the same occurrence as Next `in_progress`
- **AND** it no longer occupies Current, retains its text and `stableId`, clears `carriedOver`, and creates no duplicate
- **AND** `nextStepText` remains empty; the move does not record a Current result or choose a continuation verdict

#### Scenario: next item accepts only its vocabulary

- **WHEN** a save payload carries a Next item status
- **THEN** validation accepts exactly `planned`, `in_progress`, `paused`, `postponed`, or `done`
- **AND** it rejects alarms and unknown values

#### Scenario: paused work does not escalate

- **WHEN** a section contains only paused or postponed items and no risks
- **THEN** dashboard and product health show no escalation caused by those items

#### Scenario: carry-over stays planned until progress is confirmed

- **WHEN** automatic carry-over consumes an eligible Next item or Current next commitment
- **THEN** the created Current item is `planned`, carried, and unconfirmed
- **AND** it is not automatically changed to `in_progress`

#### Scenario: fallback continuation retains in-progress without confirming a result

- **WHEN** automatic carry-over continues a Current `in_progress` item that has no next commitment
- **THEN** the created Current item remains `in_progress`, carried, and unconfirmed
- **AND** the copied text is not counted as a confirmed result until the lead updates it

#### Scenario: Paused work keeps its reason across placement

- **WHEN** a paused item with a valid pause reason is moved explicitly between Current and Next
- **THEN** its status and pause reason are preserved

#### Scenario: Postponed work can be moved to Current explicitly

- **WHEN** an authorized lead moves a Next postponed item to Current
- **THEN** its postponed status is preserved until explicitly changed

#### Scenario: Risk-derived alarms do not become stored status

- **WHEN** an item with a covering risk moves between Current and Next
- **THEN** stored progress remains unchanged and the displayed alarm is derived again

#### Scenario: an explicit Next prevents a duplicate placement

- **GIVEN** a Current item and an explicit Next occurrence already share a `stableId`
- **WHEN** a placement-only move to Next is requested
- **THEN** the move cannot create or overwrite another Next occurrence
- **AND** at rollover the eligible explicit commitment wins over fallback Current continuation, producing at most one target occurrence

#### Scenario: stored progress cannot encode alarms or a separate completion flag

- **WHEN** an Item is validated or persisted
- **THEN** no stored `blocked` status or separate completion flag is accepted
- **AND** paused progress requires a nonblank pause reason while every non-paused status clears it
- **AND** no progress other than an eligible explicit commitment or fallback in-progress continuation is automatically activated at rollover

## ADDED Requirements

### Requirement: Move to next week MUST change placement without asserting continuation

In Lead Report Overview, Save for Move to next week on an eligible Current item without a separate next commitment MUST move that occurrence to Next, preserving stored progress, text, and stable identity while clearing `carriedOver`. This action MUST remain distinct from Continue next week and MUST NOT create another occurrence for the same placement.

#### Scenario: postponement changes placement only

- **WHEN** the lead saves Move to next week for an eligible Current occurrence without a separate commitment
- **THEN** that occurrence is Next and no longer Current
- **AND** progress and text are preserved, `carriedOver` is cleared, and no `nextStepText` or Current result is synthesized
- **AND** progress is not set to `postponed` merely because the action means postponement

#### Scenario: cancelling a move leaves placement unchanged

- **WHEN** the lead cancels the move editor under the existing discard rules
- **THEN** no move is written and the occurrence remains Current
- **AND** focus returns to the triggering item control

#### Scenario: existing commitments keep their existing handling

- **WHEN** a placement-only move would collide with an explicit Next of the same stable identity
- **THEN** it cannot create or overwrite a second Next
- **AND** the existing continuation/promotion branch for stored `nextStepText` and the separate Continue next week verdict remain unchanged
