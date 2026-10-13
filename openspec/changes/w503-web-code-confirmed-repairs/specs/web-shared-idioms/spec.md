## ADDED Requirements

### Requirement: Independent report-shell selections compose across pending navigation

Archive and scope selections in the shared head/viewer report shell MUST preserve each other even when the user changes them before the earlier navigation commits. The latest selection of each control MUST win. External navigation, including browser Back, MUST supersede uncommitted in-shell selections. Existing one-shot marker stripping and unrelated query values MUST remain intact.

#### Scenario: Archive and scope change before the first URL update

- **WHEN** the user changes the archive selection and then scope before the archive URL update commits
- **THEN** the resulting URL contains both latest selections

#### Scenario: A control is changed again while navigation is pending

- **WHEN** the user changes archive, scope and archive again before pending navigation completes
- **THEN** the final URL contains the latest archive value and selected scope

#### Scenario: External navigation supersedes queued selections

- **GIVEN** an in-shell URL update has additional queued selections
- **WHEN** the user navigates Back or to another report/query externally
- **THEN** the queued selections do not overwrite that external destination
