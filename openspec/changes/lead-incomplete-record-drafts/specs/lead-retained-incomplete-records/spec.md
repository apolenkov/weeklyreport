## Purpose

Enable authorized authors to recover retained incomplete records without changing published history or bypassing existing access and lifecycle rules.

## ADDED Requirements

### Requirement: Retained incomplete drafts are privately recoverable

Author history MUST provide a report- and section-scoped, read-only recovery view of the author's retained incomplete risks and decisions omitted from publication. The server MUST verify the author's current entitlement and existing source access and retention; ordinary published content MUST NOT expose the draft text. The view MUST identify the source period and section and explain why the draft is read-only.

#### Scenario: Published source remains recoverable

- **GIVEN** an author's incomplete draft was omitted from a manually or automatically published report and remains retained
- **WHEN** the currently entitled author opens its source from author history
- **THEN** the author can read the draft and identify its source period and section
- **AND** the view explains that the published source is read-only

#### Scenario: Older and archived source

- **GIVEN** an omitted draft belongs to a noncurrent or archived published report
- **WHEN** its author requests recovery and existing access and retention permit it
- **THEN** the retained draft is available read-only without reopening the report

#### Scenario: Access or retained source is unavailable

- **WHEN** a nonauthor or a formerly entitled author requests the draft, or the source has been removed under existing retention or deletion rules
- **THEN** protected text is not disclosed
- **AND** the recovery surface does not promise permanent retention

### Requirement: Copying recovery text requires an explicit eligible create

The author MUST explicitly choose to copy retained text into a currently eligible editable section through the normal create flow. The target MUST revalidate current entitlement, parent, stages, required fields and lifecycle. Recovery MUST NOT automatically carry the draft, mutate a frozen snapshot or grant a reopen action.

#### Scenario: Author copies into an eligible current section

- **WHEN** the authorized author explicitly copies retained text into an eligible current section and the normal create flow succeeds
- **THEN** the new draft is subject to current validation and the source and frozen snapshot remain unchanged
- **AND** the new record receives a new stableId, reused only for retries of that explicit create; source identity and comments are not cloned

#### Scenario: Target context or entitlement has changed

- **WHEN** the selected target is no longer editable or the author, parent or stages are no longer eligible
- **THEN** the copy is rejected without a target write or source mutation
- **AND** the author is not granted permission to reopen the source

### Requirement: Recovery does not depend on current-period routing

Retained-draft discovery and reads MUST use authenticated own-section access, not the viewer current-period gate or section provisioning. The read MUST verify current active identity, canonical authoring-role entitlement and exact source section ownership. Group membership or shared-product access alone MUST NOT authorize private recovery. Missing or unauthorized sources MUST return no protected content.

#### Scenario: Older open or archived unpublished source

- **WHEN** an entitled author owns retained incomplete rows in a noncurrent open or archived unpublished source
- **THEN** author history provides read-only recovery with source period and current lifecycle reason, without making it viewer-readable or provisioning another section
- **AND** the surface calls it a retained draft, not a draft proven omitted from publication

#### Scenario: Reopen and republish

- **WHEN** an authorized lifecycle action reopens and later republishes the source
- **THEN** recovery reads the currently retained incomplete source rows, not an invented immutable revision history
- **AND** completion or explicit permitted deletion while editable changes retained recovery content, while existing queued publication artifacts retain their own frozen contents

#### Scenario: Assignment changes but author still owns the source

- **WHEN** a currently entitled author loses the source Product stage assignment but still owns the source section
- **THEN** read-only recovery retains their text under own-section access
- **AND** copy requires a newly eligible target context and cannot revive the old stage grant

#### Scenario: Snapshot restored without private source rows

- **WHEN** history contains a publication with frozen omissions but retained source rows are absent
- **THEN** history keeps the frozen omission notice and recovery states source content is unavailable
- **AND** it does not reconstruct draft text from the snapshot or promise undeclared retention

### Requirement: Private draft entitlement is consistent across own reads

Incomplete text, identities, comments and current retained-count discovery MUST require current active canonical authoring-role entitlement and exact section authorship on every route. Recovery, reports.getActive, reports.myHistory, leadForm.byPeriod and statusOverview MUST apply this rule using current server facts, not cached session role or section IDs. Existing access to complete history and authorized public omission notices MUST remain unchanged.

#### Scenario: Freshly hydrated demoted author

- **GIVEN** an active former Lead is now a viewer and still owns a section containing complete and incomplete records
- **WHEN** they request recovery, getActive, byPeriod, statusOverview or myHistory for that source
- **THEN** no route returns incomplete text, identities, attached comments or private retained counts or recovery links
- **AND** recovery denies access using its normal inaccessible-source response; mixed existing reads retain only otherwise authorized complete content and public scoped omission notices
- **AND** complete own-history access is not removed merely because authoring entitlement was revoked

#### Scenario: Cached pre-demotion session cannot expose drafts

- **GIVEN** a session or cached response was created while the actor was an entitled author, then demotion commits
- **WHEN** any own-read or recovery route starts a new authorization observation
- **THEN** current server role and active status govern the response even if the session still says lead or carries the old activeReportSectionId
- **AND** no stale server cache serves protected draft data or retained discovery; private client caches are cleared on observed entitlement loss
- **AND** this does not claim to retract text already delivered before demotion

#### Scenario: Inactive user and stale section pointer

- **WHEN** a user becomes inactive, or a cached activeReportSectionId points to a section not authored by the current actor
- **THEN** all private read and discovery paths deny protected content using current server facts
- **AND** an inactive user remains rejected by normal authentication rather than receiving a complete-content fallback
- **AND** no path provisions a section merely to inspect retained drafts

#### Scenario: Nonauthor leadership is not private entitlement

- **WHEN** an active Head or admin requests another author's section through any own-read, history or recovery route
- **THEN** leadership alone discloses no incomplete text, identities, discussion or private retained counts
- **AND** existing authorized complete reviewer content and scoped public omission notices remain available

#### Scenario: Stage reassignment is not role revocation

- **WHEN** a currently active entitled author loses a Product stage but retains exact source section authorship
- **THEN** all otherwise eligible own-read routes and recovery retain private source access consistently
- **AND** none of those reads grant new write or copy eligibility for the lost stage
