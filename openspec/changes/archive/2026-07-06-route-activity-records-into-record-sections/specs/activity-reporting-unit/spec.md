## MODIFIED Requirements

### Requirement: Activities render on the lead form, slides, and head report like products

Activities MUST render on the lead form, the lead slides, and the head report
with the same records/risks/blockers presentation a product uses, minus the SDLC
stage lane. On the lead form the split mirrors products exactly: the Project
Activities section (`activity-status-section.tsx`) is a STATUS-ONLY surface —
each attached activity renders as a card carrying its name, linked product(s),
and the risk/blocker-floored traffic-light pills, and MUST NOT list or accept
record content. The activity's records (items, risks, decisions) MUST render and
be editable in the main record sections (Current Week / Next Week / Risks /
Decisions, and the unified by-state view when enabled), grouped under an
activity lane keyed by `activityId` and labeled with the activity name — the
same grouping treatment product records get, without a stage lane. On the slides
(`slide-activity-pills.tsx`, `lead-unified-slide.tsx`) the lead's activities are
grouped by traffic-light status. On the head report
(`activity-status-strip.tsx`, `weekly-report-page.tsx`) each activity renders in
the report body like a product — its records and linked product(s) — instead of a
status-only strip. Every surface MUST show the activity's linked product(s).

#### Scenario: the lead form renders a status-only activity card

- **WHEN** a lead opens their report form for a section attached to an activity
- **THEN** the activity renders as a card showing its name, linked product(s),
  and its derived traffic-light status
- **AND** the card lists no record content and offers no record entry
- **AND** no SDLC stage pipeline is rendered for the activity

#### Scenario: activity records are edited in the main record sections

- **GIVEN** a section owning an activity-parented current-week item, a risk, and
  a decision
- **WHEN** the lead opens the report form
- **THEN** each record renders in its matching main section under a lane
  labeled with the activity's name
- **AND** the lead can edit and delete it there exactly like a product record

#### Scenario: an activity lane never collapses into a product group

- **GIVEN** an activity-parented item (`productId` empty, `activityId` set)
- **WHEN** the week sections build their grouped columns
- **THEN** the item appears under its activity's lane, not under any product
  and not silently dropped

#### Scenario: activity items occupy priority ranks

- **GIVEN** an activity-parented item holding priority rank 1
- **WHEN** the lead opens the rank picker on any other own item
- **THEN** rank 1 is presented as taken

#### Scenario: the unified by-state view includes activity records

- **GIVEN** the org's unified activity view flag is on and a section owns an
  activity-parented item
- **WHEN** the unified view renders
- **THEN** the activity-parented item appears in its state bucket alongside
  product items, and its alarm derivation stays isolated (Q1)

#### Scenario: the slides group the lead's activities by status

- **WHEN** the lead slides render for a section carrying activities
- **THEN** the activities appear on the slides grouped by traffic-light status

#### Scenario: the head report renders each activity like a product

- **WHEN** the head opens the assembled weekly report
- **THEN** each activity renders in the report body with its records and linked
  product(s), minus the stage lane
