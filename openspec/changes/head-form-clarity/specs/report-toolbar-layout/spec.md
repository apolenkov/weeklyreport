## MODIFIED Requirements

### Requirement: Head slide context controls occupy one compact toolbar row

At desktop width, period/archive controls MUST remain the left cluster and
Product/Leads scope, the Head fullscreen toggle in Slides mode, and view mode
MUST remain the right cluster of the single report context toolbar. Head MUST
NOT render a density control. The fullscreen toggle MUST be adjacent to the
scope controls and MUST use the shared fullscreen affordance. Head view-mode
labels MUST be Report / Slides, not Edit / Slides.

#### Scenario: Head opens Slides

- **WHEN** the Head opens Slides mode
- **THEN** the context toolbar contains period/archive controls, Product/Leads,
  one fullscreen toggle, and the Report/Slides view mode in one row
- **AND** no `Slide density` control is present
- **AND** the active deck does not render a second fullscreen toggle

#### Scenario: Head opens Leads presentation

- **WHEN** the Head selects Leads scope in Slides mode
- **THEN** period/archive, scope, fullscreen, and view controls remain in the
  single context toolbar
- **AND** the next deck row is the lead carousel rather than a second
  mode-control row

### Requirement: Document actions render on the page header line; the toolbar holds the context-control bar

Report document actions MUST occupy the header action group and context controls one bordered toolbar row. Lead completion actions MUST render only in the header action group; there is no bottom rail or other second completion surface. Completion actions MUST use Retry-only autosave recovery, not a permanent Save/Add cluster. The context toolbar MUST NOT become a second document-action surface. Head form view MUST be labeled Report, independently of its Read/Review interaction mode.

#### Scenario: the lead surface splits across the header and the toolbar

- **WHEN** a lead opens an editable report with archived history
- **THEN** the header offers Fill from and eligible completion actions, with Retry only during autosave recovery
- **AND** the single context row holds period navigation, archived filter, Report chat, Mine/Everyone scope, and Report/Slides mode
- **AND** Report Overview has no collapse-all control and no permanent manual Save

#### Scenario: the lead scrolls past the header

- **WHEN** a lead scrolls an editable report so the header leaves the viewport
- **THEN** no completion rail or bottom Submit card appears
- **AND** Submit stays in the header action group

#### Scenario: the lead slides surface shows density and fullscreen in the trailing slot

- **WHEN** a lead opens Slides
- **THEN** the context toolbar trailing slot shows Document/Presentation density and fullscreen

#### Scenario: the head surface splits across the header and the toolbar

- **WHEN** a head opens review for an open period
- **THEN** PDF export and Publish & lock occupy the header action group
- **AND** period navigation, archived filter, Product/Leads scope, and Report/Slides mode occupy the single context row

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a period eligible for Move this report to the archive
- **THEN** Archive remains a header document action separate from the context archive filter

#### Scenario: document and presentation controls follow the same split

- **WHEN** report controls are composed
- **THEN** Submit, Publish & lock, Fill from, PDF export, Archive, and any eligible save/retry action stay outside the context bar
- **AND** period, archived filter, scope, mode, density, and fullscreen stay in that bar even if a setting is persisted
