# uat-quality-gates (delta)

## MODIFIED Requirements

### Requirement: Final Playwright Re-Sweep MUST Show Zero Console Errors Per Role

A final Playwright re-sweep MUST run across all four roles (lead, head, admin,
viewer) and MUST observe zero console ERRORS for each role. Console WARNINGS
MUST be logged for the record but MUST NOT fail the sweep, and the
favicon-404 request MUST be ignored as environmental noise.

#### Scenario: Lead role re-sweep is clean

- **WHEN** a re-sweep runs with the lead role via Playwright over the report
  form, stage chips, and slides mode
- **THEN** the captured console shows 0 ERRORS
- **AND** any WARNINGS are logged but do not fail the sweep

#### Scenario: Head role re-sweep is clean

- **WHEN** a re-sweep runs with the head role via Playwright over the dashboard,
  composite status, and publish/revoke flow
- **THEN** the captured console shows 0 ERRORS

#### Scenario: Admin role re-sweep is clean

- **WHEN** a re-sweep runs with the admin role via Playwright over the admin
  panel (periods, reminders, projects, action log)
- **THEN** the captured console shows 0 ERRORS

#### Scenario: Viewer role re-sweep is clean

- **WHEN** a re-sweep runs with the viewer role via Playwright over the
  published read-only report view
- **THEN** the captured console shows 0 ERRORS

#### Scenario: Favicon 404 is exempt

- **WHEN** a role re-sweep records a 404 for the favicon request
- **THEN** that 404 is ignored and does NOT count as a console ERROR

#### Scenario: A real console error blocks sign-off

- **WHEN** any role's re-sweep records a `console.error`, page error, or
  uncaught exception that is not the exempt favicon 404
- **THEN** the re-sweep fails for that role
- **AND** the track is not marked done until the error is fixed in the
  responsible wave's change
