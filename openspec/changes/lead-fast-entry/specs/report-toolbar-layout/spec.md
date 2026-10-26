## MODIFIED Requirements

### Requirement: The document-action row uses an accent hierarchy with a single forward primary

Report document-action groups MUST reserve resting solid brand accent for at most one available forward commit. Other actions and reversal controls MUST use lesser neutral/outline treatment. Context controls MUST have no solid brand-accent fill. A rendered in-flight save/retry control MAY use transient accent busy styling without becoming another resting primary.

#### Scenario: a published head period shows the reversal as non-accent

- **WHEN** a head views a published period whose primary action is Reopen
- **THEN** Reopen uses neutral/outline treatment rather than resting solid brand accent

#### Scenario: a submitted lead section shows the reversal as non-accent

- **WHEN** a submitted lead section offers Request reopen
- **THEN** it uses neutral/outline treatment rather than resting solid brand accent

#### Scenario: the context bar uses no brand-accent fill

- **WHEN** the context bar renders segmented toggles
- **THEN** its active segment uses neutral foreground fill
- **AND** no context control uses solid brand accent

#### Scenario: Retry is busy while Submit remains the forward commit

- **WHEN** a visible completion Retry is saving
- **THEN** its accent spinner treatment is temporary and full opacity
- **AND** Submit remains the sole resting forward primary

### Requirement: Toolbar row composition adapts to role and period state without losing positional stability

Report controls MUST adapt to role and lifecycle eligibility while surviving controls retain stable positions. Read-only Lead periods MUST hide mutating actions; submission MUST replace the forward slot with its reversal. Viewer and Lead preview MUST expose no commit control. Status indicators MUST remain header labels outside action/context groups. Lead save recovery MUST follow Retry-only completion rules.

#### Scenario: a lead views a locked past period

- **WHEN** a lead opens a read-only past period
- **THEN** Save/Retry, Submit, and Fill from are absent
- **AND** the context bar still allows period navigation

#### Scenario: a viewer opens a published report

- **WHEN** a viewer opens a published report through the shared page
- **THEN** its action group shows only PDF export without Save, Retry, Submit, or Publish
- **AND** submitted-count status remains outside the action group
- **AND** viewer Back to Archive navigation remains in the context bar

#### Scenario: submission and preview retain their role boundaries

- **WHEN** a lead submits or opens the read-only preview
- **THEN** submission hides Retry and replaces Submit with the eligible reversal without reordering survivors
- **AND** preview has no commit control and keeps its existing outer-header navigation outside the shared toolbar
- **AND** autosave time, submitted count, publish preconditions, and department labels stay outside document/context action groups

### Requirement: Document actions render on the page header line; the toolbar holds the context-control bar

Report document actions MUST occupy the header action group and context controls one bordered toolbar row. Lead completion actions MAY hand off between the header and a separate non-overlay rail while sharing state and handlers. The rail MUST use Retry-only autosave recovery, not a permanent Save/Add cluster. The context toolbar MUST NOT become a second document-action surface.

#### Scenario: the lead surface splits across the header and the toolbar

- **WHEN** a lead opens an editable report with archived history
- **THEN** the header offers Fill from and eligible completion actions, with Retry only during autosave recovery
- **AND** the single context row holds period navigation, archived filter, Report chat, Mine/Everyone scope, and Report/Slides mode
- **AND** Report Overview has no collapse-all control and no permanent manual Save

#### Scenario: the lead slides surface shows density and fullscreen in the trailing slot

- **WHEN** a lead opens Slides
- **THEN** the context toolbar trailing slot shows Document/Presentation density and fullscreen

#### Scenario: the head surface splits across the header and the toolbar

- **WHEN** a head opens review for an open period
- **THEN** PDF export and Publish & lock occupy the header action group
- **AND** period navigation, archived filter, Product/Leads scope, and Edit/Slides mode occupy the single context row

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a period eligible for Move this report to the archive
- **THEN** Archive remains a header document action separate from the context archive filter

#### Scenario: document and presentation controls follow the same split

- **WHEN** report controls are composed
- **THEN** Submit, Publish & lock, Fill from, PDF export, Archive, and any eligible save/retry action stay outside the context bar
- **AND** period, archived filter, scope, mode, density, and fullscreen stay in that bar even if a setting is persisted

### Requirement: The lead document-action group holds no quick-add control

The Lead document-action group MUST contain Fill from and eligible Submit/reversal actions, plus Retry only for autosave recovery. Record creation MUST stay with reporting-unit/header or contextual Current/Next entry points and the Risks/Decisions sections, not a report-header quick-add. Report/Slides switching MUST retain action order; read-only past periods MUST hide mutating actions.

#### Scenario: switching Report to Slides keeps the document actions

- **WHEN** a lead switches Report to Slides on an editable section
- **THEN** Fill from, any eligible Retry, and Submit keep their relative order and shared state
- **AND** no report-header `+ Add item` control or permanent Save appears

#### Scenario: a read-only past period hides the mutating actions

- **WHEN** the lead opens a read-only past period
- **THEN** Save/Retry, Submit, and Fill from are hidden

## ADDED Requirements

### Requirement: Lead completion handoff MUST share canonical action state

Lead header and rail completion presentations MUST share canonical autosave, Submit, eligibility, and review state without duplicate handlers. Visibility handoff MUST use the latest header visibility observation; observer absence MUST leave header actions usable. Neither presentation MUST add a global quick-add control. Retry focus recovery MUST follow `lead-report-controls-integrity`.

#### Scenario: Header visibility observations are coalesced

- **WHEN** one observer batch includes multiple visibility changes for the header sentinel
- **THEN** the last observation determines the active completion presentation
- **AND** both presentations consume the same eligibility, review count, and canonical handlers

#### Scenario: Header observation is unavailable

- **WHEN** no header sentinel or IntersectionObserver is available
- **THEN** header actions remain usable instead of disappearing
