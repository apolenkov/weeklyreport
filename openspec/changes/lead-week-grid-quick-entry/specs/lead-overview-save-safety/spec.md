## Purpose

Keep every Overview change undoable by one rule, keep typed input from being lost, and gather every submit blocker in one list.

## ADDED Requirements

### Requirement: Overview undo follows one rule

Undo MUST be offered only after the save of an answer to a plan, a week move, a deletion, a cleared entry or a cancelled draft is confirmed. It MUST be refused with a stated reason while the item is saving, after a later change, while it is being edited, or while its discussion holds typed text, and it MUST NOT overwrite newer text. A refusal that can still pass leaves Undo on offer. Undo MUST NOT be offered for in-place text edits.

#### Scenario: Undo after a confirmed save

- **WHEN** a change to a record is confirmed and the lead activates Undo
- **THEN** the record returns to its previous value, the restore is saved too, and the change is announced

#### Scenario: Undo while the item is saving

- **WHEN** the lead activates Undo while the record is still saving
- **THEN** Undo is refused with `Still saving. Try Undo in a moment.` and nothing changes

#### Scenario: Undo while the item is being edited

- **WHEN** the lead activates Undo while the item has an open editor or unsaved input
- **THEN** Undo is refused with `Can’t undo while this item is being edited. Save or cancel first.` and the input is kept

#### Scenario: Undo after a later change

- **WHEN** the record changed after the change being undone
- **THEN** Undo is refused with `Can’t undo: this item changed after that.` and the record is unchanged, and Undo is no longer offered

#### Scenario: Undo while a discussion holds a draft

- **WHEN** the record's discussion holds typed or saved-draft reply text
- **THEN** Undo is refused with `Can’t undo while a reply is being written in its discussion. Send or clear it first.`

#### Scenario: Undo into an occupied week

- **WHEN** an Undo would put a record back into a week that now holds a record of the same work
- **THEN** it is refused with `Can’t undo: <week> already has this item.` and nothing is written

#### Scenario: Restoring text never overwrites newer text

- **WHEN** restoring a cleared entry, a cancelled draft or a cancelled reason would replace text typed since
- **THEN** the restore is refused with `Can’t put it back now: save or cancel <what is being typed> first.` and the typed text is kept

### Requirement: Unsaved input blocks Submit and is never lost

An entry line or editor holding typed text, a stage-only change, a typed reason or a risk or decision draft, and every record with a pending save, MUST block Submit and be listed in `Before you submit`, counted per record. Typed text MUST never be lost by a tab switch, a Sheet, a failed save or a refetch. After a failed save, Discard MUST restore exactly the last confirmed state, including a Next step present or absent then.

#### Scenario: Typed text blocks submission instead of being lost

- **WHEN** an entry line or editor holds any unsaved change and the Lead activates Submit
- **THEN** submission is blocked, the list names the unsaved entry with a link to it, and the input is kept
- **AND** an empty entry line is not unsaved work

#### Scenario: A pending save blocks Submit per record

- **WHEN** two records are saving and one of them has two saves in flight
- **THEN** the list counts two records, not three saves, and Submit stays blocked until each has finished

#### Scenario: A failed save keeps the text

- **WHEN** a save fails
- **THEN** the record shows `Not saved. The connection dropped. Your text is kept here.` with Retry and Discard, and the header shows `Some changes are not saved`
- **AND** Retry sends the same change again without a duplicate record

#### Scenario: Discard restores the last confirmed state

- **WHEN** the lead activates Discard after a failed save
- **THEN** the record returns exactly to its last confirmed fields, a newly added Next step is removed or a deleted one is restored, and a record that was never confirmed is removed
- **AND** the discarded text is not part of any later autosave payload

#### Scenario: Two saves in a row

- **WHEN** a second save starts before the first finishes and the first later fails
- **THEN** the outcome of the last save decides the record's state, a success of the first moves the confirmed state forward, and Discard goes back no further than the last success

#### Scenario: A conflict keeps the text

- **WHEN** a save conflicts with a newer server version
- **THEN** the row says `Changed elsewhere while you were typing`, keeps the lead's text unsaved, and offers `Save my text` and `Use server version`
- **AND** the retained text is governed by `lead-form-draft-orchestration`

#### Scenario: Leaving the page asks first

- **WHEN** unsaved text or an unsent reply exists and the lead leaves the page, including by a browser Back shortcut from a field
- **THEN** a confirmation is requested before anything is lost

### Requirement: Before you submit lists every blocker once

The Overview MUST show one `Before you submit` list at the end of the report, naming each blocker once and linking it to its unit or record, which expands the unit and focuses the item. Blockers are unsaved entries, carried plans that need a status, `<unit>: no update this week` for a Product, risk or decision drafts that need details, and changes not saved. Submit shows `N to fix`. No second blocker line may exist.

#### Scenario: Blockers are listed once

- **WHEN** the report has items that block submission
- **THEN** `Before you submit` names each blocker once and `N to fix` equals the number of its lines
- **AND** activating a line opens the right tab, expands the owning unit and focuses that record or field

#### Scenario: Unanswered plans are a note, not a blocker

- **WHEN** a prior-week plan has no answer and no carried record
- **THEN** `Before you submit` states that unanswered plans are sent as Not answered, and the plan does not count in `N to fix`

#### Scenario: Submit moves focus to the list

- **WHEN** Submit is aria-disabled with blockers and the Lead activates it
- **THEN** focus moves to `Before you submit` and it states `Not submitted. Finish these N things first.`

#### Scenario: Clearing the blockers allows one submission

- **WHEN** every blocker is resolved
- **THEN** Submit is enabled and sends one consistent report, with nothing sent before it is pressed

#### Scenario: Header and unit stay in view

- **WHEN** the Lead scrolls a long report
- **THEN** week, save state, Submit, column headers and the current unit name remain visible

### Requirement: Details, discussion and risks open as modal Sheets and confirmations as alert dialogs

The detailed record form, the discussion and risk or decision details MUST open as modal Sheets. Discard, Delete, bringing a plan into This week, and a refusal that needs an answer MUST be AlertDialogs. While a layer is open the page behind it MUST be inert, Tab MUST cycle inside it, Escape MUST close the top layer, and focus MUST return to the control that opened it. A message over a Sheet MUST NOT cover its Save, Cancel, Delete or Send.

#### Scenario: A Sheet isolates the page

- **WHEN** the lead opens the detailed form, the discussion or a risk's details
- **THEN** the page behind is inert and Tab cycles only among the Sheet's controls, at phone and desktop widths alike

#### Scenario: An alert dialog sits above a Sheet

- **WHEN** Discard, Delete or a refusal is asked while a Sheet is open
- **THEN** the Sheet also becomes inert, Escape cancels the dialog first, and an outside click does not close it

#### Scenario: Focus returns to the opener

- **WHEN** a Sheet or dialog closes
- **THEN** focus returns to the control that opened it, or to the Overview heading when that control is gone

#### Scenario: A message does not cover the footer actions

- **WHEN** a message with Undo or Show appears while a Sheet or dialog is open
- **THEN** it rests above the footer actions and its Undo stays operable
