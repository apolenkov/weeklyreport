## MODIFIED Requirements

### Requirement: Viewer reads the Status target live, gated published-or-current

The system SHALL let a viewer read a report if and only if its
`periodStatus === "published"` OR it is the **current editable period** — the single
newest non-archived `open` / `reopened` report with `periodStart <= now`, with NO
published fallback; every other period MUST be rejected as not-found. The
current-editable id MUST be resolved no earlier than the report fetch, so that an
`open → published` race rejects (the Status entry may resolve again) and a
newly-created period likewise fails closed — the race resolves
toward not-found, never toward exposure or a stale live model. On a period the viewer may
read, the viewer MUST see the same content the head sees on that period —
including unsubmitted **draft** sections only when the viewer explicitly chooses
Show all — scoped to the viewer's `ViewerGroupAccess` groups and rendered strictly
read-only. A non-current `open` /
`reopened` period, or a scheduled-future period (`periodStart > now`), requested by
explicit id MUST be rejected, so the live read cannot probe arbitrary periods. A
viewer with no group access MUST see nothing (zero-row scope), never another group's
content.

The read-only Head and viewer report surfaces MUST exclude incomplete risks and decisions before deriving statuses and aggregates, including when Show all displays unsubmitted sections. They MUST display an omission notice scoped to the sections shown and authorized, separate from pending-section counts. Published notices use frozen metadata; legacy snapshots without it show unknown rather than zero. No inaccessible section’s omissions or draft text are disclosed.

#### Scenario: Viewer sees a submitted section in the current open period

- **GIVEN** a lead in the viewer's group has submitted a section in the current
  `open` period
- **WHEN** the viewer opens that period
- **THEN** the submitted section's content is shown read-only

#### Scenario: Viewer sees an unsubmitted draft in the current open period

- **GIVEN** a lead in the viewer's group has draft (unsubmitted) content in the
  current `open` period
- **WHEN** the viewer opens that period with the default submission filter
- **THEN** the draft content is hidden

#### Scenario: Viewer can explicitly show all current sections

- **GIVEN** the viewer is on the live current period and has authorized draft
  sections
- **WHEN** the viewer activates the Show all submission-state control
- **THEN** those draft sections are shown read-only
- **AND** the control is unavailable for published snapshots

#### Scenario: A reopened current period shows live content, not a blank

- **GIVEN** the current period is a previously published period the head has
  reopened (its sections reset to draft, text intact)
- **WHEN** the viewer opens it with the default submission filter
- **THEN** the reset draft sections remain hidden
- **WHEN** the viewer activates Show all
- **THEN** the live section content is shown read-only
- **AND** the report does not appear empty while Show all is active

#### Scenario: A non-current period is rejected by explicit id

- **GIVEN** an `open` / `reopened` period that is not the current one, or a
  scheduled-future period
- **WHEN** a viewer requests it by explicit `reportId`
- **THEN** the request is rejected as not-found

#### Scenario: An archived-open period is rejected

- **GIVEN** an archived report still carrying `periodStatus = "open"` (the admin
  archive path does not force `periodStatus`)
- **WHEN** a viewer requests it by explicit `reportId`
- **THEN** the request is rejected as not-found (it is not the current editable
  period, which is non-archived)

#### Scenario: A past published period is readable

- **GIVEN** a past `published` (or archived-published) report with a viewer-visible
  section
- **WHEN** the viewer opens it
- **THEN** its published snapshot is shown read-only

#### Scenario: Viewer with no group access sees an empty current report

- **GIVEN** a viewer with no `ViewerGroupAccess` rows
- **WHEN** the viewer opens the globally current editable report
- **THEN** the current-period gate admits the report but its scoped content is
  empty
- **AND** no content from other groups is revealed

#### Scenario: Viewer with no group access cannot address a published report

- **GIVEN** a viewer with no `ViewerGroupAccess` rows
- **WHEN** the viewer opens a published report by explicit id
- **THEN** report-level admission returns `NOT_FOUND` rather than an empty
  report envelope
- **AND** the Status target resolves to the empty state without revealing
  whether an inaccessible report exists

#### Scenario: A race not-found recovers once through the Status entry

- **GIVEN** a viewer on the Status report (`?source=status&recovery=0`) whose open
  period is published mid-view, yielding a `NOT_FOUND`
- **WHEN** the report route handles that `NOT_FOUND`
- **THEN** it redirects once to `/reports/latest?recovery=1`, which re-resolves and
  lands on the now-published snapshot at `?source=status&recovery=1`
- **AND** a further `NOT_FOUND` carrying `recovery=1`, or any `NOT_FOUND` without
  `source=status`, shows the terminal notice without redirecting (no loop)

#### Scenario: Show all includes a section but excludes incomplete records

- **GIVEN** an authorized unsubmitted section contains a complete decision and an incomplete blocked risk
- **WHEN** a viewer chooses Show all on the live report
- **THEN** the complete decision remains visible and the incomplete risk and its status floor are absent
- **AND** a separate scoped omission notice warns the report may be incomplete

#### Scenario: Notice does not disclose other groups

- **GIVEN** only an inaccessible group has incomplete records
- **WHEN** the viewer reads the report
- **THEN** neither its draft text nor its omission count or existence is exposed

#### Scenario: Published legacy omission state

- **WHEN** a viewer reads a legacy snapshot without omission metadata
- **THEN** the omission state is unknown, not zero, and the snapshot is unchanged
