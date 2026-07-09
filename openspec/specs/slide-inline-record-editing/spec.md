# slide-inline-record-editing Specification

## Purpose

Lead authors can correct slide records directly from their own slide deck
without introducing a second write path. This capability governs inline editing
and deletion of existing item, risk, and decision records from the lead slide
surface while preserving the same ownership, lock, and mutation rules as the
lead edit form.

## Requirements

### Requirement: Double-click opens the record editor on own slide rows

The lead slide grid (`SlideArticle` on `/lead/report/[id]?mode=slides`) MUST
open an edit dialog for the underlying record when the author double-clicks (or
presses Enter on a focused) own item, risk, or decision row. The dialog MUST be
pre-filled with the record's current values and reuse the lead form's field
editors and existing tRPC save mutations -- the system MUST NOT introduce new
write endpoints for this surface.

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
