## ADDED Requirements

### Requirement: Private incomplete anchors reject nonauthor comment writes

Reviewer comment creation and deletion MUST reject nonauthor writes against currently incomplete risk or decision anchors after locked lineage re-resolution. Creation MUST use the existing inaccessible-record not-found response; deletion MUST use the existing inaccessible-comment not-found response. Head/admin and comment ownership MUST NOT bypass this boundary. Item, complete-record and section-level review permissions remain unchanged.

#### Scenario: Save wins before a reviewer comment

- **GIVEN** a reviewer resolved a complete risk or never-published decision before its author cleared a detail
- **WHEN** that save commits before the comment acquires the Report lock
- **THEN** the locked recheck sees the now-incomplete surviving stableId and rejects creation as inaccessible without inserting a comment
- **AND** a known or stale physical anchor grants no access and discloses no draft text or completeness-specific error

#### Scenario: Comment wins before the incomplete save

- **WHEN** an otherwise authorized reviewer comment commits before the save makes its risk or never-published decision incomplete
- **THEN** the save preserves the comment identity, author and timestamp through row recreation
- **AND** nonauthors cannot read the hidden discussion or add further comments while its anchor is incomplete

#### Scenario: Existing comment deletion is not an exception

- **GIVEN** a comment exists on a currently incomplete risk or decision
- **WHEN** its reviewer author, a nonauthor Head or a nonauthor admin attempts deletion using a known comment ID
- **THEN** the locked recheck rejects as inaccessible and preserves the comment
- **AND** no reviewer-owned deletion exception grants private-anchor access

#### Scenario: Re-completion restores normal reviewer behavior

- **WHEN** the author completes the same risk or decision under its existing stableId
- **THEN** the preserved chronological discussion becomes visible under normal scope and authorized reviewer create/delete behavior resumes
- **AND** author ownership alone grants no reviewer permission and the item-only Lead reply route does not expand to risks or decisions
