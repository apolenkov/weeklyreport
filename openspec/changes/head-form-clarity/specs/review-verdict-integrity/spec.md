## ADDED Requirements

### Requirement: Head verdict controls belong to the reviewed section

In Review on `/head/report/[reportId]`, Leads scope MUST place one eligible Approve / Request changes control beside each owning section heading, including Activity-only sections. Product scope MUST retain one section review roster with author links to the matching Leads section. No scope MUST present a second mutation control for the same section. Acknowledge MUST remain in its existing publish-header placement.

#### Scenario: A Lead contributes multiple Products and Activities

- **WHEN** Head reviews that submitted reviewable section in Leads scope
- **THEN** one verdict control names that author beside the section heading above all their Product and Activity content
- **AND** no verdict controls are repeated inside Product or Activity cards or in a separate top roster

#### Scenario: Product review roster navigates to the section

- **WHEN** Head activates an author's link in the Product-scope review roster
- **THEN** Leads scope opens the same displayed section, scrolls to it and focuses its heading region without a mutation
- **AND** reduced motion uses immediate scrolling instead of smooth scrolling
- **AND** switching scope uses the same section ID, judged version, verdict state and mutation pending state

#### Scenario: Section eligibility changes during review

- **WHEN** the section becomes draft, the report becomes published or archived, or review capability is withdrawn
- **THEN** its mutation controls disappear or become unavailable under the existing gates
- **AND** no verdict is sent merely because a scope, focus or eligibility changed
- **AND** after a successful Request changes removes a control, focus moves to the surviving section region only if focus was lost with that control

#### Scenario: A stale inline verdict is rejected

- **WHEN** Head approves or requests changes beside a section whose displayed version is stale
- **THEN** the existing version-conflict outcome is shown without stamping a verdict for unseen content
- **AND** Request changes retains its mandatory reason and existing dialog recovery behavior

#### Scenario: Two section controls appear on a phone

- **WHEN** two eligible section headings render at 375 CSS pixels
- **THEN** verdict actions have author-specific accessible names, remain keyboard reachable, wrap without clipping and meet existing touch-target rules
