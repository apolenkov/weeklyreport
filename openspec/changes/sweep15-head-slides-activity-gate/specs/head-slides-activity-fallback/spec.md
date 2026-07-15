## ADDED Requirements

### Requirement: Head slides depend on live activity only for an empty report fallback

The head slide consumer MUST gate on `activity.live` loading, error, and data only after `weeklyReport.get` has loaded a report with zero lead sections and activity fallback is enabled.

#### Scenario: Populated report renders while activity is pending

- **WHEN** `weeklyReport.get` returns one or more lead sections and `activity.live` is still loading
- **THEN** the head deck renders slides from those report sections
- **AND** it does not render the activity loading skeleton

#### Scenario: Populated report survives an activity error

- **WHEN** `weeklyReport.get` returns one or more lead sections and `activity.live` fails
- **THEN** the head deck still renders the report-section slides
- **AND** the unused activity error does not replace the deck with an error state

#### Scenario: Empty report waits for activity fallback

- **WHEN** `weeklyReport.get` returns zero lead sections and activity fallback is enabled
- **THEN** the head deck follows `activity.live` loading, error, and success states
- **AND** successful activity rows are assembled into fallback slides

#### Scenario: Viewer never uses the head-only fallback

- **WHEN** the viewer slide surface renders with activity fallback disabled
- **THEN** it does not query or gate on `activity.live`
