## ADDED Requirements

### Requirement: The durable spec index maps product capabilities by role and lifecycle

`openspec/specs/README.md` MUST link every durable product capability under its primary role journey (Shared, Lead, Head, Viewer, or Admin) and lifecycle stage, and MUST list cross-role capabilities once with explicit role tags.

#### Scenario: A reader looks for head review capabilities

- **WHEN** the reader opens the spec index and follows Head → Review
- **THEN** the index links the applicable review, dashboard, acknowledgement, and report-visibility capabilities with one-sentence purposes

#### Scenario: A capability spans roles

- **WHEN** one capability governs more than one role
- **THEN** it has one canonical index entry with all applicable role tags
- **AND** duplicate entries do not imply duplicate ownership

### Requirement: Engineering governance is separated from product behavior

The spec index MUST place architecture, security, observability, deployment, data-integrity, testing, lint, and tooling capabilities in a distinct Engineering governance section rather than mixing them into role/lifecycle product lists.

#### Scenario: A repository-boundary capability is indexed

- **WHEN** a capability primarily governs imports, lint, or module architecture
- **THEN** it appears under Engineering governance
- **AND** it does not appear as a user-facing lifecycle capability unless a cross-link explains a direct product outcome

### Requirement: User-facing capabilities have meaningful Purpose statements

Every user-facing durable capability MUST replace generated `TBD` Purpose text with a concise statement derived from its actual requirement scope. Completion MUST include `activity-reporting-unit`, `head-report-visibility`, `head-dashboard-clarity`, and `review-acknowledge-placement` and MUST cover every other Product capability found by the same inventory.

#### Scenario: A product capability is opened from the index

- **WHEN** its `spec.md` Purpose is read
- **THEN** the Purpose identifies the governed user outcome/surface and lifecycle scope
- **AND** it contains no generated archive/sync placeholder text

#### Scenario: TBD purposes are audited

- **WHEN** all Product-classified specs are searched after the docs change
- **THEN** no Product capability retains a `TBD` Purpose
