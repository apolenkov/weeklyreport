## ADDED Requirements

### Requirement: Viewer report headers identify working and published authority

The viewer report surface MUST label the authority state of the displayed report in its header: an open or reopened Status report MUST show `Working report — includes drafts` plus its `Draft` or `Reopened` state, while a published report MUST show `Published` and MUST NOT present itself as a working report.

#### Scenario: Current open Status report is labeled working

- **WHEN** a viewer opens the current open report through Status
- **THEN** the header shows `Working report — includes drafts`
- **AND** the header state is `Draft`

#### Scenario: Reopened report is labeled working

- **WHEN** a viewer opens the current reopened report
- **THEN** the header shows `Working report — includes drafts`
- **AND** the header state is `Reopened`

#### Scenario: Published report is labeled published

- **WHEN** a viewer opens a published report from Status, History, Search, or a direct authorized link
- **THEN** the header state is `Published`
- **AND** the working-report banner is absent

### Requirement: Authority labeling does not broaden viewer capabilities

The viewer surface MUST remain read-only and Search MUST remain published-only after authority labels are added.

#### Scenario: Working report exposes no mutation

- **WHEN** a viewer reads a working report that includes draft sections
- **THEN** no edit, submit, publish, reopen, archive, or lifecycle mutation control is rendered

#### Scenario: Search remains a published authority window

- **WHEN** a viewer searches reports while a working report exists
- **THEN** search results include only published report snapshots
- **AND** working draft content is not searchable
