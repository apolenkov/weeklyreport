## MODIFIED Requirements

### Requirement: Double-click opens the record editor on own slide rows

The lead slide grid (`SlideArticle` on `/lead/report/[id]?mode=slides`) MUST open an edit dialog for the underlying record when the author double-clicks, presses Enter on a focused, or presses Space on a focused own item, risk, or decision row. The dialog MUST be pre-filled with the record's current values and reuse the lead form's field editors and existing tRPC save mutations -- the system MUST NOT introduce new write endpoints for this surface.

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

#### Scenario: Author activates a focused row with Space

- **WHEN** the author tabs to their own focusable row and presses the Space
  key
- **THEN** the edit dialog opens exactly as it would on Enter
- **AND** the page does not scroll as a side effect of the keypress
