## ADDED Requirements

### Requirement: A slide delete whose opener was removed keeps focus in the deck

When the delete confirmation for a slide record closes and the element that
opened it is no longer in the document, keyboard focus MUST move to the slide
deck container instead of `<body>`. The deck container MUST be focusable by
script and MUST NOT add a tab stop.

#### Scenario: focus after a successful delete from the inline editor

- **WHEN** the author opens a record from its row, chooses Delete, confirms, and
  the delete succeeds so that the row and its editor are removed
- **THEN** the active element is the slide deck container
- **AND** the active element is not `document.body`
