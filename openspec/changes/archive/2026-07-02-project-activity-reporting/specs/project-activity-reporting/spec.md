## ADDED Requirements

### Requirement: A Project Activity Is an Admin-Provisioned, Stage-Less, Group-Scoped Unit

The system SHALL persist a **Project Activity** as a reporting unit that carries **no
SDLC stage**, is created and maintained by the admin, and belongs to exactly one
reporting group via a required authoritative `groupId`.

A Project Activity carries a `name`, the required `groupId` (authoritative — not
re-derived from any lead's group, so lead rotation never moves it), an optional
`projectId` link to one Product (label-only — it does NOT entangle product health),
and a `jiraAccounts String[]` plain-text list (no Jira integration). Admin CRUD MUST
be exposed as **`projectActivity.*`** procedures on the canonical admin middleware
chain — the existing `activity.*` namespace (the live-status feed) MUST NOT be reused,
and no new `Role` is introduced.

#### Scenario: Admin creates a group-scoped activity

- **GIVEN** an admin
- **WHEN** the admin creates a Project Activity with a name, a group, an optional product link, and Jira account references
- **THEN** the activity is persisted with that authoritative `groupId` and no SDLC stage

#### Scenario: A lead cannot create an activity

- **GIVEN** a lead
- **WHEN** the lead attempts to create a Project Activity
- **THEN** there is no lead-facing creation path (activities are admin-provisioned)

### Requirement: Many Leads Attach to an Activity and Each Reports Their Own Status

A Project Activity SHALL support attachment of multiple leads (many-to-many), and each
attached lead SHALL report their own weekly status for it.

Attachment is a `ProjectActivityLead` join. A lead's report surface lists ONLY the
activities they are attached to. Each attached lead's status is independent — one
activity can be reported on by several leads in the same period, each through their own
section.

#### Scenario: Two leads report independent statuses for one activity

- **GIVEN** an activity with leads A and B attached
- **WHEN** lead A reports `block` and lead B reports `on-track` in the same period
- **THEN** both statuses are recorded independently, each on its author's section

#### Scenario: The lead form lists only attached activities

- **GIVEN** a lead attached to activity X but not activity Y
- **WHEN** the lead opens their report
- **THEN** activity X is listed for status entry and activity Y is not

### Requirement: Activity Weekly Status Is a Per-Period Section Child Row

A lead's weekly activity status SHALL be a child row of the lead's `ReportSection`
(`ActivityStatus { reportSectionId, activityId, status, note? }`, unique
`(reportSectionId, activityId)`), written through the existing section-save under the
`ReportSection.version` optimistic lock, with a default status seeded when the section
is provisioned.

`status` is a nullable `TrafficLightStatus` (null/on-track, `yellow`=risk, `red`=block)
with an optional free-text `note`. Section provisioning MUST seed one `ActivityStatus`
(default `green`, mirroring `ProjectStatus`) per activity the lead is attached to. The
write path MUST validate that each written `activityId` is one the section author is
attached to and seeded for — never trusting the client payload (the same client-trust
gap C6 closes for stages). Because it is a section child row, it is **exempt from the
period-transition boundary** — the lead save writes child rows only, never the Report
period.

#### Scenario: Activity statuses are seeded at provisioning

- **GIVEN** a lead attached to two activities opening a new period
- **WHEN** the lead's section is provisioned
- **THEN** two `ActivityStatus` rows are seeded with the default status

#### Scenario: A lead cannot write a status for an unattached activity

- **GIVEN** a lead not attached to activity Z
- **WHEN** a save payload carries an `ActivityStatus` for activity Z
- **THEN** the write is rejected (the `activityId` is not attached/seeded for the section)

#### Scenario: Saving an activity status does not write the period

- **GIVEN** a lead saving their section with updated activity statuses
- **WHEN** the save persists
- **THEN** only child rows (including `activityStatus`) are written, never the Report period tuple

### Requirement: Activities Are Visible to the Head/Viewer but Do Not Roll Up

The head and viewer SHALL see group-scoped Project Activities with their weekly status
beside products, and the published snapshot SHALL include activities; activity status
SHALL NOT roll up into product health, portfolio totals, or escalations in v1.

Activities are read through the section author (the same group-scoped path as
`ProjectStatus`), so no new product-id-keyed scope dimension is introduced. The
`publishedSnapshot` MUST include activities, and the read path MUST tolerate older
snapshots that lack the field. A blocked activity MUST NOT drive a linked product red,
MUST NOT contribute to portfolio overview totals or the escalation set, and activities
are NOT searchable in v1.

#### Scenario: Head sees an activity's status beside products

- **GIVEN** a head whose group has an activity reported `block` this period
- **WHEN** the head opens the assembled report
- **THEN** the activity and its `block` status are shown beside the group's products

#### Scenario: A blocked activity does not change product health

- **GIVEN** an activity linked to product P reported `block`, while P's owned stages are all green
- **WHEN** the portfolio overview computes P's health
- **THEN** P stays green (activity status is independent of stage-driven health)
- **AND** the blocked activity does not appear in the escalation set

#### Scenario: An old published snapshot without activities still reads

- **GIVEN** a report published before activities existed (snapshot lacks the field)
- **WHEN** it is read
- **THEN** it renders without error (the read path tolerates the missing field)
