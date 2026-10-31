# slide-inline-record-editing Specification

## Purpose

Lead authors can correct slide records directly from their own slide deck
without introducing a second write path. This capability governs inline editing
and deletion of existing item, risk, and decision records from the lead slide
surface while preserving the same ownership, lock, and mutation rules as the
lead edit form.

## Requirements

### Requirement: Double-click opens the record editor on own slide rows

The lead slide grid (`SlideArticle` on `/lead/report/[id]?mode=slides`) MUST open an edit dialog for the underlying record when the author double-clicks an editable own item, risk, or decision row, or activates its explicit Edit action after expanding the prose. The Edit action MUST be keyboard reachable and support Enter and Space. Click, Enter and Space on the prose itself MUST change only its reading disclosure, as specified in `lead-slide-by-product-grid`. The dialog MUST be pre-filled with the record's current values and reuse the lead form's field editors and existing tRPC save mutations -- the system MUST NOT introduce new write endpoints for this surface.

#### Scenario: Author edits an item from the slide

- **WHEN** the section author double-clicks their own item row on the lead slide
  and saves a text change in the dialog
- **THEN** the existing item mutation persists the change (stableId lineage
  preserved) and the slide grid re-renders with the new text without a page
  reload

#### Scenario: Author deletes a risk from the slide

- **WHEN** the author opens the dialog on their own risk row and confirms Delete
- **THEN** the record is removed via the existing delete path and the row
  disappears from the Risks column

#### Scenario: Author reads and edits a row with the keyboard

- **WHEN** the author focuses their own row's prose and presses Space or Enter
- **THEN** its full details expand without opening an editor or changing data
- **AND** activating the expanded Edit action with Space or Enter opens the editor
- **AND** Space activation does not scroll the page

### Requirement: Read-only rows and surfaces ignore double-click

The system MUST NOT open the editor for foreign (co-lead) rows, for rows on the
head or viewer decks, or when the section is submitted/locked for the period --
the same editability rules as the lead Edit form.

#### Scenario: Foreign row stays read-only

- **WHEN** a lead double-clicks a co-lead's row rendered in Everyone scope
- **THEN** no dialog opens and the row is unchanged

#### Scenario: Locked section stays read-only

- **WHEN** the author double-clicks their row after the section was submitted
- **THEN** no dialog opens (the affordance is disabled exactly where the Edit
  form would refuse the write)

### Requirement: Pending slide writes preserve the submitted editor

While an inline save or delete is pending, the slide editor MUST prevent field
changes, duplicate submission, cancellation and activation of another record.
Failure MUST retain the submitted values and restore editing. Editor references
MUST belong to a specific report section, and successful completion MUST close
only that section's editor.

#### Scenario: A pending save cannot discard later text

- **GIVEN** an author submits an item, risk or decision edit
- **WHEN** its save is pending
- **THEN** the fields and actions are disabled and dismissal is ignored
- **AND** the submitted values remain visible until success or failure

#### Scenario: A failed save restores editing

- **WHEN** the pending save fails
- **THEN** the same draft remains open and editable for retry

#### Scenario: Switching sections isolates editor identity

- **GIVEN** an editor belongs to one report section
- **WHEN** another section becomes current with the same record stable ID
- **THEN** the previous editor is not shown for the new section
- **AND** returning to the original section does not reopen its editor or delete confirmation
- **AND** an earlier completion cannot clear a different section's editor

### Requirement: Conflict reload messages reflect query completion

The slide editor MUST announce a successful conflict reload only after the
section query succeeds. A failed read MUST display the reload failure message.

#### Scenario: Conflict reload fails

- **GIVEN** a slide save returns a version conflict
- **WHEN** the subsequent section read fails
- **THEN** the reload failure message is shown without claiming the latest
  version was loaded

### Requirement: An open slide editor survives leaving Slides mode

An open Slides inline editor (edit dialog or delete confirmation) MUST NOT be
closed, and its typed values MUST NOT be discarded, because the lead form leaves
Slides mode (for example browser Back removing `?mode=slides`, which shows the Overview). The Lead
page MUST keep the editor's deck mounted but hidden until the editor closes by Save, Delete,
Cancel or a section change. With no editor open, leaving Slides mode MUST unmount
the deck.

#### Scenario: Back from Slides keeps the typed risk edit

- **GIVEN** a lead has the Slides risk editor open with unsaved typed text
- **WHEN** the URL leaves Slides mode through browser Back
- **THEN** the editor dialog remains open with the typed text
- **AND** the Overview renders behind it

#### Scenario: Cancelling after leaving Slides ends the hold

- **GIVEN** the editor was kept open after leaving Slides mode
- **WHEN** the lead cancels the dialog
- **THEN** the dialog closes and no Slides deck remains mounted

#### Scenario: Leaving Slides without an editor unmounts the deck

- **GIVEN** no Slides editor is open
- **WHEN** the URL leaves Slides mode
- **THEN** the Slides deck is not rendered
