## Purpose

Let a Lead edit a This week or Next week record in a popover anchored under it, without losing work when leaving, and show that the text is clickable.

## ADDED Requirements

### Requirement: Overview records open an editing popover

Activating the text button of a This week or Next week record MUST open a non-modal popover under the record, about 392 px wide, without shifting the table; the open record keeps a thin ring. The popover holds, in order: the text, stage toggles (Product only), Next step (This week only), the icon actions Discussion (N), Move, More details and Delete, then Cancel and Save. Enter saves; Shift+Enter adds a line. An empty text is never saved.

#### Scenario: The text button opens the popover

- **WHEN** the lead activates the text button `Edit text: <text>, This week` of an editable record
- **THEN** a non-modal popover (the shadcn Popover on Radix) opens anchored under the record, about 392 px wide, with no Sheet and no shift of the table or of neighbouring records
- **AND** the open record stays highlighted with a thin ring until the popover closes
- **AND** focus is in the text field, a textarea, and the controls follow the stated order

#### Scenario: Stage toggles are icons with a pressed state

- **WHEN** the record is a Product record whose Product has several owned stages
- **THEN** the popover shows an icon ToggleGroup in which each toggle has the stage name as its accessible name and a pressed state
- **AND** the last pressed toggle cannot be switched off: it stays pressed and the toast `A record needs at least one stage.` appears
- **AND** an Activity record, and a Product record whose Product has one owned stage, show no toggles

#### Scenario: Next step grows with its text

- **WHEN** the record is in This week
- **THEN** the popover shows a Next step field that grows from one to three lines as text is entered
- **AND** a Next week record shows no Next step field

#### Scenario: Icon actions have tooltips and names

- **WHEN** the lead hovers or focuses an icon action of the popover
- **THEN** a tooltip names it, and its accessible name is `Discussion (N)` with the count, `Move to next week` (`Move to this week` for a Next week record), `More details` or `Delete`
- **AND** each action is reachable by keyboard in the stated order

#### Scenario: Enter saves and Escape cancels

- **WHEN** the lead presses Enter in the text or Next step field
- **THEN** the edited text, stages and Next step are saved through the canonical draft path, keeping the record's progress, placement and stable identity, and the popover closes
- **WHEN** the lead presses Shift+Enter, or Enter during IME composition
- **THEN** a line break is inserted and nothing is saved
- **WHEN** the lead presses Escape with no changes
- **THEN** the popover closes and no draft patch is emitted

#### Scenario: Empty text is not saved

- **WHEN** the lead clears the text and activates Save or presses Enter
- **THEN** no draft patch is emitted, the field shows `The text can’t be empty. Press Esc to cancel.` and the record keeps its previous text

#### Scenario: Next step feeds the plan of the next week

- **WHEN** the lead saves a Next step in a This week record
- **THEN** Next week shows it as the derived `Next step` line of the same row and the This week result is kept
- **AND** when Next week already holds a record of the same work, the Next step field is read-only with the reason `Next week already has this item`

#### Scenario: Delete asks first

- **WHEN** the lead activates Delete
- **THEN** an AlertDialog asks `Delete this entry?` and, on confirmation, the record is removed and an Undo is offered under the one Undo rule
- **AND** when the work item was already published in an earlier report, Delete is aria-disabled with `Published in last week’s report. It can’t be deleted`, and the work can only be closed through the Won’t do outcome

#### Scenario: Unavailable actions say why

- **WHEN** the record is foreign, lost or unsaved and the lead opens its popover
- **THEN** the text shows read-only, and Save, More details, Move and Delete that cannot apply stay visible but disabled, still focusable, with their reason in the tooltip and as the accessible description
- **AND** activating one by pointer, Enter or touch announces that reason and changes nothing

### Requirement: Leaving the editing popover never saves

A click outside the popover, or Tab out of its last control, MUST NOT save. With no changes the popover closes. With changes it stays open, its record shows a quiet `Not saved`, and the draft blocks Submit and counts in `N to fix`. Escape or Cancel with changes MUST ask the AlertDialog `Discard changes?`. Desktop has no Tab trap, and focus MUST return to a defined control when the popover closes.

#### Scenario: A click outside with no changes closes the popover

- **WHEN** the lead clicks outside a popover whose text, stages and Next step are unchanged
- **THEN** the popover closes, nothing is saved and no draft patch is emitted

#### Scenario: A click outside with changes keeps the draft

- **WHEN** the lead changed text, stages or Next step and clicks outside the popover or tabs out of its last control
- **THEN** nothing is saved and the popover stays open, and the record shows a quiet `Not saved`
- **AND** `Before you submit` lists the draft and `N to fix` counts it
- **AND** the draft survives a tab switch, and a Sheet or AlertDialog opened from the popover does not count as leaving it

#### Scenario: Tab is not trapped on desktop

- **WHEN** the lead presses Tab in the last control of the popover
- **THEN** focus moves to the next focusable element after the record
- **WHEN** the lead presses Shift+Tab in the first control
- **THEN** focus moves to the record's text button
- **AND** with no changes the popover closes, and with changes it stays open as stated above

#### Scenario: Escape and Cancel ask before discarding changes

- **WHEN** the lead presses Escape or activates Cancel with no changes
- **THEN** the popover closes and no draft patch is emitted
- **WHEN** the lead presses Escape or activates Cancel with changes
- **THEN** an AlertDialog asks `Discard changes?`, and Discard closes the popover and restores the record’s last saved fields
- **AND** Keep editing returns focus to the field with the input intact

#### Scenario: Focus returns to the record

- **WHEN** Save, Cancel or Escape closes the popover
- **THEN** focus returns to the record’s text button
- **WHEN** the lead activates Delete and then Cancel in its AlertDialog
- **THEN** focus returns to the Delete action and the popover stays open

### Requirement: A derived next step opens a reduced popover

Activating the text of a derived `Next step` line MUST open a popover holding only the step text, Discussion (the item’s discussion, with its count), More details (the step only, with no statuses) and Delete, then Cancel and Save. Save changes only the next step. Delete MUST remove only the step, after a confirmation that names the step; the item stays. Leaving the popover follows `Leaving the editing popover never saves`.

#### Scenario: A reduced popover opens

- **WHEN** the lead activates the text of a derived `Next step` line
- **THEN** the popover shows the step text, `Discussion (N)`, `More details`, `Delete`, Cancel and Save, and no stage toggles, no Next step field and no Move
- **AND** Discussion opens the source record’s discussion with its count, and More details opens the Sheet of the source record at its Next step, with no status fields

#### Scenario: Delete removes only the step

- **WHEN** the lead activates Delete in the reduced popover
- **THEN** an AlertDialog `Delete this next step?` names the step, and on confirmation only the step is removed while the item keeps its text, status and stages
- **AND** an Undo is offered under the one Undo rule

### Requirement: Editable records show a hover cue on a fine pointer

On a fine pointer in a window wider than 760 px, hovering an editable This week or Next week record MUST tint its whole cell softly, underline its text and show a pencil in a reserved right slot that never covers text. The cue MUST NOT be the only affordance: the text is a real button reachable by keyboard, and no control exists only on hover. A pointer click on the cell opens the editing popover.

#### Scenario: Hover shows the cue

- **WHEN** the pointer hovers an editable This week or Next week record
- **THEN** its whole cell shows a soft tint, its text is underlined and a pencil appears in the reserved right slot
- **AND** the pencil is a decoration (`aria-hidden`), not a control, and hover shows no other control

#### Scenario: The cue moves nothing

- **WHEN** the cue appears or disappears
- **THEN** the record, its row and the neighbouring cells keep their size and position, because the slot is reserved
- **AND** long text wraps before the slot and the pencil never covers it

#### Scenario: A click on the cell opens the popover

- **WHEN** the lead clicks the record’s cell outside its status and discussion controls, including on its stage icons
- **THEN** the editing popover opens as if the text button were activated

#### Scenario: Keyboard and touch need no hover

- **WHEN** the lead reaches a record by keyboard, or on a coarse pointer or at 760 px or narrower
- **THEN** the text button is reachable and shows a visible focus ring, and Enter opens the editor
- **AND** no hover cue is shown on touch or at 760 px or narrower

#### Scenario: No cue where editing is not offered

- **WHEN** the pointer hovers a Last week record, a record of a submitted report, or any record the lead cannot edit
- **THEN** no tint, underline or pencil appears
