## MODIFIED Requirements

### Requirement: Document actions render on the page header line; the toolbar holds the context-control bar

The report surface MUST split its controls by one axis — operates on the report document vs changes which / how it is shown — placing the document actions on the page header line and the context controls in the single bordered toolbar bar below it.

1. A control that creates, persists, commits, or exports report content (Save,
   Submit Section, Publish & Lock, Fill-From, PDF export, Move to archive) MUST
   render on the page header line, in a right-aligned action group beside the
   title/status block — NOT inside the bordered toolbar.
2. A control that changes which report is shown or how it is presented (period
   navigation, show-archived-periods filter, scope, view mode, the mode-adaptive
   collapse-all (edit) / fullscreen (slides) control, Agent review) MUST render in
   the bordered toolbar bar, even when it persists a setting.
3. The bordered toolbar MUST render exactly one row (the context-control bar);
   it MUST NOT contain a document-action row.
4. The head archive surfaces split by this axis: the show-archived-periods
   filter is a context control (toolbar bar), while the published-period "Move
   to archive" lifecycle button is a document action (header line).

#### Scenario: the lead surface splits across the header and the toolbar

- **WHEN** a lead opens their report for an editable period that has archived
  periods in its history
- **THEN** the header line's action group shows Fill-From, Save, and the Submit
  Section commit
- **AND** the bordered toolbar shows one row: period navigation, the
  show-archived-periods filter, the Mine/Everyone scope, the Edit/Slides view
  mode, the collapse-all control, and Agent review

#### Scenario: the lead slides surface shows fullscreen in the collapse-all slot

- **WHEN** a lead opens their report in slides mode
- **THEN** the bordered toolbar's trailing utility slot shows the fullscreen
  toggle (not a collapse-all/expand control), in the same position the collapse
  control occupies in edit mode

#### Scenario: the head surface splits across the header and the toolbar

- **WHEN** a head opens the review page for an open period
- **THEN** the header line's action group shows the PDF export and the Publish &
  Lock commit
- **AND** the bordered toolbar shows one row: period navigation, the
  show-archived-periods filter, the Product/Leads scope, the Edit/Slides view
  mode, and Agent review

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a published period that can be moved to the archive
- **THEN** the Move to archive control renders in the header line's action group,
  separate from the toolbar's show-archived-periods filter
