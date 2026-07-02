## MODIFIED Requirements

### Requirement: Viewer reads the Status target live, gated published-or-current

The system SHALL let a viewer read a report if and only if its
`periodStatus === "published"` OR it is the **current editable period** — the single
newest non-archived `open` / `reopened` report with `periodStart <= now`, with NO
published fallback; every other period MUST be rejected as not-found. The
current-editable id MUST be resolved no earlier than the report fetch, so that an
`open → published` race rejects (recovered by a one-shot re-resolution through the
Status entry) and a newly-created period likewise fails closed — the race resolves
toward not-found, never toward exposure or a stale live model. On a period the viewer
may read, the viewer reads the same content the head sees on that period, scoped to
the viewer's `ViewerGroupAccess` groups, with the **submitted-only default** and
unsubmitted **draft** sections behind the submission-state toggle (see
`report-submission-visibility`); the report view renders **read-only for content**
(the review and acknowledgement affordances are a separate surface — see
`review-acknowledgement`). A non-current `open` / `reopened` period, or a
scheduled-future period (`periodStart > now`), requested by explicit id MUST be
rejected, so the live read cannot probe arbitrary periods. A viewer with no group
access MUST see nothing (zero-row scope), never another group's content.

#### Scenario: Viewer sees a submitted section in the current open period

- **GIVEN** a lead in the viewer's group has submitted a section in the current
  `open` period
- **WHEN** the viewer opens that period
- **THEN** the submitted section's content is shown read-only

#### Scenario: A draft section is hidden by default and reachable via the toggle

- **GIVEN** a lead in the viewer's group has draft (unsubmitted) content in the
  current `open` period
- **WHEN** the viewer opens that period in the default submitted-only view
- **THEN** the draft content is hidden by default and its presence is signalled
- **AND** switching the toggle to "all" shows the draft content read-only

#### Scenario: A reopened current period shows its live content behind the toggle, not a blank

- **GIVEN** the current period is a previously published period the head has
  reopened (its sections reset to draft, text intact)
- **WHEN** the viewer opens it in the default submitted-only view
- **THEN** the report does not appear empty (the presence of the reopened draft
  content is signalled)
- **AND** switching the toggle to "all" shows the live section content read-only

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
- **THEN** its published snapshot is shown read-only (unfiltered by the toggle)

#### Scenario: Viewer with no group access sees an empty report

- **GIVEN** a viewer with no `ViewerGroupAccess` rows
- **WHEN** the viewer opens a current or published report it would otherwise see
- **THEN** the report content is empty (zero-row scope)
- **AND** no content from other groups is revealed

#### Scenario: A race not-found recovers once through the Status entry

- **GIVEN** a viewer on the Status report (`?source=status&recovery=0`) whose open
  period is published mid-view, yielding a `NOT_FOUND`
- **WHEN** the report route handles that `NOT_FOUND`
- **THEN** it redirects once to `/reports/latest?recovery=1`, which re-resolves and
  lands on the now-published snapshot at `?source=status&recovery=1`
- **AND** a further `NOT_FOUND` carrying `recovery=1`, or any `NOT_FOUND` without
  `source=status`, shows the terminal notice without redirecting (no loop)
