# viewer-report-navigation Specification

## Purpose

Define the viewer's Status entry and read-only report surface. Status resolves to
the current allowed report, while the live current-period view defaults to
submitted sections and may explicitly reveal all authorized sections.

## Requirements

### Requirement: Viewer has a primary entry to the Status target it can see

The system SHALL give a viewer a primary navigation entry (labeled "Status") that
resolves to the **Status target** containing a viewer-visible section, rendered
read-only at `/reports/[reportId]`. The Status target MUST be the **current editable
period** — the single newest non-archived `open` / `reopened` report with
`periodStart <= now` (the same id the read gate authorizes) — when that exact report
has a viewer-visible section; otherwise the newest `published` report that has a
viewer-visible section. The resolver MUST NOT search older editable periods for a
visible one, because the gate authorizes only the current editable id; routing to an
older editable report would produce a target the gate rejects. When neither matches,
the entry MUST resolve to an empty state — never an error, a content-less period, an
archived-open period, or a scheduled-future period. The published fallback MUST be
group-scoped (the newest _visible_ published report, not the globally newest). The
existing History entry MUST remain available alongside it, and the entry MUST be a
stable server-resolved target (the `/reports/latest` redirect), never a hard-coded
report id or the head-only `/head/report` surface.

#### Scenario: Current open period opens read-only

- **GIVEN** a viewer whose current `open` period has a viewer-visible section
- **WHEN** the viewer activates the Status entry
- **THEN** that period opens at `/reports/[reportId]` in read-only mode
- **AND** no editing, publishing, or lifecycle control is rendered

#### Scenario: Current editable not visible falls back to the newest visible published

- **GIVEN** the current editable period has no viewer-visible section (or no
  editable period exists), but an older published report has one
- **WHEN** the viewer activates the Status entry
- **THEN** that older viewer-visible published report opens read-only
- **AND** the globally-newest published report (visible to no one in the viewer's
  groups) is NOT the target

#### Scenario: An older visible editable period is not targeted over the current one

- **GIVEN** the current (newest) editable period has no viewer-visible section, but
  an OLDER editable period does
- **WHEN** the viewer activates the Status entry
- **THEN** the older editable period is NOT the target (the gate authorizes only the
  current editable id)
- **AND** the entry resolves to the newest visible published report or the empty
  state instead

#### Scenario: No visible report yet

- **GIVEN** a viewer whose accessible groups have no period with a viewer-visible
  section
- **WHEN** the viewer activates the Status entry
- **THEN** an empty state is shown
- **AND** no scheduled-future or non-visible period is exposed

#### Scenario: History remains available and lists only openable reports

- **GIVEN** the viewer navigation
- **WHEN** the viewer surface renders
- **THEN** both the Status entry and the History entry are present
- **AND** the viewer's History lists only `published` reports (a reopened period,
  whose companion publication status is still "published", does not appear as
  an unopenable row)

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

### Requirement: The viewer's period navigator reflects the addressed period, not the newest

The `PeriodNavigator` rendered on the viewer's read-only report surface (`/reports/[reportId]`) MUST resolve its selected/current period from the addressed `reportId`, not from parsing the URL pathname against a route-scheme regex that does not cover the viewer's route shape. When the navigator is given the addressed period id directly, that id MUST take precedence for the trigger label, the listbox's highlighted option, and the Prev/Next targets.

#### Scenario: Viewer opens an older period via History

- **GIVEN** a viewer with 2+ published periods in an accessible group opens
  a period that is not the newest
- **WHEN** the read-only report surface renders its period navigator
- **THEN** the trigger label and listbox highlight match the opened period
- **AND** Prev/Next navigate relative to the opened period, not the newest
  one

#### Scenario: Explicit dropdown selection is unaffected

- **GIVEN** the viewer's period navigator
- **WHEN** the viewer picks a period directly from the listbox
- **THEN** navigation lands on the picked period

### Requirement: Published document headers show publication state once

The shared read-only document surface at `/reports/[reportId]` MUST show one
visible publication-state indicator for a published report, through its
canonical report-header lifecycle badge. `ViewerAuthorityLabel` MUST NOT add a
second Published badge in document mode. Open and reopened working-report
authority context MUST remain visible, and Slides MUST retain their standalone
authority context when the document lifecycle badge is absent. Badge selection
MUST NOT change report lifecycle or access policy.

#### Scenario: A published report opens in document mode

- **WHEN** a visitor reads a published report at `/reports/[reportId]` in document mode
- **THEN** exactly one Published indicator appears in the header alongside its submission ratio

#### Scenario: Working or slide context is needed

- **WHEN** the read-only surface shows an open or reopened working report, or a published report in Slides
- **THEN** its existing working-report or standalone slide authority context remains visible
