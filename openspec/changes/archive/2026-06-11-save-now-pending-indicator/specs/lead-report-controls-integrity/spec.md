## ADDED Requirements

### Requirement: In-flight control actions show a visible busy state

A lead report toolbar control MUST visibly indicate work in progress and MUST block repeat activation while its asynchronous action is running.
Specifically, the icon-only save-now button
(`apps/web/src/components/report-shell/save-now-button.tsx`): while
the `saveDraft` mutation is in flight (`AutosaveSnapshot.isInFlight`),
the button MUST replace the idle glyph with a spinner, MUST set
`aria-busy="true"`, MUST be disabled, and MUST render the primary
accent fill (`var(--color-starbucks-accent)`) with a white icon at
full opacity — never the dimmed disabled washout. The busy treatment
MUST revert to the idle styling when the mutation settles, on success
and on error alike.

#### Scenario: a save mutation is in flight

- **WHEN** the lead triggers a manual save and the `saveDraft`
  mutation has not yet settled
- **THEN** the button shows a white spinner on the accent green fill,
  carries `aria-busy="true"`, and is disabled
- **AND** clicking it again does not trigger another save

#### Scenario: the mutation settles successfully

- **WHEN** the in-flight save completes
- **THEN** the accent fill reverts to the idle styling and
  `aria-busy` is `"false"`
- **AND** the existing success check flash behaves unchanged

#### Scenario: the mutation settles with an error

- **WHEN** the in-flight save fails
- **THEN** the accent fill reverts, `aria-busy` is `"false"`, and the
  alert icon renders with the button enabled for retry
