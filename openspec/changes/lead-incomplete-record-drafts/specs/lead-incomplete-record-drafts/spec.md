## Purpose

Permit durable honest capture of incomplete risks and decisions while keeping report publication, review and recovery truthful and authorized.

## ADDED Requirements

### Requirement: Minimal draft capture

The Lead draft save and read contracts MUST accept valid primary risk or decision text with eligible parent and stages, explicit risk severity, and authoritative decision owner, while allowing absent risk impact and mitigation and decision impact as null. Full editing MUST remain available; text and context MUST NOT be invented.

#### Scenario: Minimal risk

- **WHEN** an author saves valid risk text with eligible context and explicit severity but no impact or mitigation
- **THEN** the saved draft retains its text and context, stores missing fields as null, and is labelled incomplete after confirmed persistence

#### Scenario: Missing eligible context

- **WHEN** no eligible Product stage is available or authorization has changed
- **THEN** the input remains visibly unsaved and no context is silently substituted

### Requirement: Complete section submission

Section submission MUST validate the authoritative resulting collection under the section version and lifecycle lock and reject incomplete records with actionable field guidance. Explicit deletion is allowed; payload omission MUST NOT count as deletion of an incomplete record. Detailed transaction behavior belongs to `report-section-write-gates`.

#### Scenario: Legacy replacement omits a draft

- **WHEN** an old client submits or saves a replacement collection omitting a persisted incomplete record
- **THEN** the server rejects the request without committed mutation, including on submit

#### Scenario: Explicit deletion

- **WHEN** the authorized author explicitly deletes an incomplete draft under the current version
- **THEN** only the intended identity is deleted and unrelated records and comments remain intact

### Requirement: Identity and truthful persistence

Draft saves MUST retain stable identity, comments, version CAS, existing foreign boundaries and published lineage protections. The UI MUST distinguish local input, pending, failed and confirmed saved incomplete drafts.

#### Scenario: Conflict and lost response

- **WHEN** a save conflicts or its response is lost
- **THEN** the client retains input and reconciles against an authorized authoritative read without claiming unconfirmed success or duplicating lineage

### Requirement: Projection before risk derivation

Live reviewer-facing projections and published snapshots MUST exclude incomplete risks and decisions before calculating risk floors, status alarms, escalation counts and aggregates. Complete records in unsubmitted sections retain existing semantics.

#### Scenario: Blocked incomplete risk

- **WHEN** an unsubmitted section contains an incomplete blocked risk and a complete risk
- **THEN** the incomplete risk does not floor item, stage, Product, Activity or portfolio status, and the complete risk remains in the projection

### Requirement: Scoped omission disclosure

Live Head and viewer reports MUST disclose scoped incomplete-record omission counts separately from pending section counts. Publication confirmation MUST disclose the counts over every section the publication freezes, in every group, as totals only and only to a role that can publish. Published snapshots MUST freeze scoped counts from the same publication state and report unknown rather than zero for legacy snapshots without metadata. Counts MUST obey existing section scope and never expose draft text to nonauthors.

#### Scenario: Old snapshot

- **WHEN** a viewer opens an older snapshot without omission metadata
- **THEN** its omission state is unknown, not represented as zero, and the snapshot remains unchanged

#### Scenario: Cross-group viewer

- **WHEN** a viewer lacks scope for a section
- **THEN** neither that section's omission count nor its incomplete draft content is disclosed

#### Scenario: Publication confirmation covers every group

- **GIVEN** a Head's own group holds one unfinished risk and another group holds one more
- **WHEN** the Head opens the publication confirmation
- **THEN** it names two unfinished risks, while the report notice still names only the Head's own group's one
- **AND** no text, author or group of the other group's record is disclosed

### Requirement: Completeness is derived from honest stored details

Risk completeness MUST require non-null impact and mitigation; decision completeness MUST require non-null impact. Non-null writes retain canonical text validation. Missing optional details MUST use null, never fabricated text or empty stored strings. Published schemas MUST remain strict and preserve their existing stored-text compatibility independently of nullable author reads.

#### Scenario: Empty control and invalid text differ

- **WHEN** an author leaves a detail control empty or whitespace-only
- **THEN** the draft payload normalizes it to null
- **AND** nonblank unsafe or over-limit text is rejected, not normalized into a valid missing detail

#### Scenario: Completed draft becomes report content

- **WHEN** all missing details are validly completed under the same stable identity
- **THEN** the row becomes complete without a second identity or fabricated completion flag
- **AND** ordinary authorized projections may include it even before section submission under existing visibility rules

### Requirement: Omission metadata is scopeable without draft content

Omission metadata MUST distinguish known counts from unknown coverage, retain separate risk and decision counts, and support existing section and subject scope without exposing text or record IDs. Legacy absence MUST stay unknown; mixed known and unknown coverage MUST NOT be labelled a complete total. Empty authorized scope MUST reveal no inaccessible existence.

#### Scenario: Partial subject scope

- **WHEN** an authorized co-owner or analytics query selects one Product from a section containing omissions on other Products and Activities
- **THEN** disclosure includes only omissions within that Product lens
- **AND** a multi-stage risk counts once in the union of selected stages, not once per stage

#### Scenario: Mixed historical coverage

- **WHEN** an authorized corpus includes known omissions and legacy unknown metadata
- **THEN** the response distinguishes the known subtotal from unknown coverage and does not report the subtotal as an exact corpus total

#### Scenario: No complete records match

- **WHEN** a valid search has no matching complete records but its authorized selected corpus has omissions
- **THEN** its result remains empty and a separate corpus notice says records were excluded, without claiming that excluded records matched the query
