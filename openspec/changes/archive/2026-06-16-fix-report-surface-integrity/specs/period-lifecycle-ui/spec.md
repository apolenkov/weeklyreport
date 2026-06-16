## ADDED Requirements

### Requirement: The lead period navigator marks per-period lifecycle state

The lead period navigator (`PeriodNavigator`) MUST mark each period for
the current lead as one of:

- **Current** — the active period (`open` or `reopened`, not archived).
- **Submitted for this lead** — the current lead's `ReportSection` for
  that period has `submittedAt` set. This marker is per-lead and
  per-period.
- **Archived** — an archived period, shown with a quiet neutral marker or
  basket affordance, NEVER a status hue, and independent of submission.

The submitted marker MUST be opt-in per navigator instance via a
`showLeadSubmissionMarkers` flag plus a `leadSubmittedAt` value, and it
MUST be sourced ONLY from the current lead's `ReportSection.submittedAt`.
It MUST NOT be derived from the head shell's fabricated `isSubmitted`
flag. The head and viewer navigators MUST show only the current and
archived markers and MUST NOT show the submitted marker.

#### Scenario: the lead navigator marks current, submitted, and archived

- **WHEN** the lead opens the period navigator with
  `showLeadSubmissionMarkers` enabled
- **THEN** the active period is marked current
- **AND** a period whose `ReportSection.submittedAt` is set for this lead
  is marked submitted
- **AND** an archived period is marked with a quiet neutral/archived
  marker, never a status hue

#### Scenario: the submitted marker is sourced only from the lead's submittedAt

- **WHEN** the head shell renders the navigator with its fabricated
  `isSubmitted: true` on every history entry
- **THEN** the submitted marker does not appear, because it is sourced
  only from `leadSubmittedAt` and `showLeadSubmissionMarkers`

#### Scenario: head and viewer navigators omit the submitted marker

- **WHEN** a head or viewer opens the period navigator
- **THEN** only current and archived markers appear
- **AND** no submitted marker is shown
