# item-progress-lifecycle Specification

## Purpose

Keep one stored item progress vocabulary, pause reasons and inline Overview
status resolutions coherent across week placement and carried work.

## Requirements

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

### Requirement: Pausing an item requires and records a reason

When a lead pauses an item, the UI MUST require a non-blank reason before the pause takes effect, and the reason MUST be persisted as `Item.pausedReason` and surfaced on the item card. Both pause entry points — the quick "Pause" action on a current-week card and the "Paused" status choice in the item edit dialog — MUST enforce the reason. At every write boundary a paused item MUST have a non-blank trimmed `pausedReason`, and every non-paused item MUST have `pausedReason = null` (or omit it before persistence); leaving the paused status clears the reason.

#### Scenario: the quick pause action requires a reason

- **WHEN** the lead clicks Pause on a current-week in-progress item
- **THEN** a reason prompt opens and the item is not paused until a non-blank
  reason is confirmed
- **AND** the confirmed reason is persisted and shown on the card as a
  "Paused: …" line

#### Scenario: the edit dialog requires a reason for the paused status

- **WHEN** the lead selects the Paused status in the item edit dialog
- **THEN** a required reason field appears and the item cannot be saved while it
  is blank

#### Scenario: editing a paused item preserves its reason

- **GIVEN** a paused item with a reason
- **WHEN** the lead opens the edit dialog, changes an unrelated field, and saves
  while keeping the Paused status
- **THEN** the pause reason is preserved, not dropped

#### Scenario: leaving the paused status clears the reason

- **GIVEN** a paused item with a reason
- **WHEN** the item moves to any non-paused status
- **THEN** its pause reason is cleared

### Requirement: Overview Paused and Clear-and-Done MUST resolve inline

The editable Lead Report Overview status menu MUST resolve Paused in an inline one-line reason field with autofocus and Enter-to-save, without opening the full item editor. Done with a stored next step MUST offer inline `Clear and mark done` or Cancel, never a Plan action. Confirmation MUST clear that next step and mark the occurrence done through the canonical status-save path.

#### Scenario: Paused focuses its reason and saves on Enter

- **WHEN** the lead chooses Paused from an eligible item's status menu
- **THEN** a labelled one-line reason field opens below the item and receives focus without opening the full editor
- **AND** the status is not changed until a nonblank valid reason is submitted
- **AND** Enter saves Paused with that reason through the canonical status-save path

#### Scenario: blank or invisible pause reasons cannot write

- **WHEN** the lead submits an empty, whitespace-only, or invisible pause reason
- **THEN** validation explains the error beside the inline field and no status patch is emitted
- **AND** the field remains available for correction under the existing `safeText` contract

#### Scenario: Done clears the next step without offering Plan

- **WHEN** the lead chooses Done for an eligible item with a stored next step
- **THEN** an inline confirmation offers only `Clear and mark done` and Cancel, without opening the full editor
- **AND** `Clear and mark done` receives focus and can be activated with Enter
- **AND** confirming clears the next step and saves done without creating or planning a Next item
- **AND** neither `Plan for next week` nor an instruction to cancel and reopen another editor is shown

#### Scenario: cancelling inline status input leaves the item unchanged

- **WHEN** the lead cancels the pause reason or Clear-and-Done confirmation, including with Escape
- **THEN** no status change or next-step clearing is written
- **AND** focus returns to the item's status control
