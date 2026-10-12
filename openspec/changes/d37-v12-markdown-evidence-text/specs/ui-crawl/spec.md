## ADDED Requirements

### Requirement: Report free-text evidence is displayed as text

Crawler Markdown reports MUST display finding details, page labels and skip reasons as ordinary text rather than interpreting their Markdown markers or line breaks as new report headings or list items. The structured findings and steps MUST retain the observed content unchanged by rendering.

#### Scenario: A console error contains a heading and another list item

- **WHEN** observed console text contains line breaks, heading markers or list markers
- **THEN** the Markdown report displays it within its original finding
- **AND** it does not create another report heading or finding item
- **AND** the structured finding retains its original text

#### Scenario: Page labels and skip reasons contain markup

- **WHEN** a page label or skip reason contains Markdown markers or line breaks
- **THEN** the report shows the label or reason as text within its existing entry
- **AND** rendering does not mutate the structured page or step
