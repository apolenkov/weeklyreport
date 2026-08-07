## ADDED Requirements

### Requirement: Slide author marks reflect the selected author scope

The lead slide grid MUST use author marks only where they distinguish contributors. In the single-author Mine scope, rows owned by the selected deck author MUST NOT repeat that author's initials because the slide header already establishes ownership. In Everyone or another multi-author scope, rows MUST show the existing stable author marks at the first row of each consecutive author series for both the selected owner and contributors, with the legend and tooltip carrying the same identity.

#### Scenario: a lead views their own Mine slide

- **WHEN** the lead slide deck is scoped to Mine and every row belongs to the selected deck owner
- **THEN** the rows render without the owner's repeated initials badges or empty badge spacers
- **AND** record status and stage marks keep their existing order and meaning

#### Scenario: a lead switches to Everyone

- **WHEN** the lead slide deck is scoped to Everyone
- **THEN** the first row of every consecutive author series shows that author's stable mark, including the selected owner
- **AND** subsequent rows in the same consecutive series omit the repeated mark

#### Scenario: a multi-author slide is reviewed outside the lead Mine scope

- **WHEN** a head or viewer reviews content whose rows can belong to different authors
- **THEN** author marks remain visible and consistent with the contributor legend
