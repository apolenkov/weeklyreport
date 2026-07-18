## MODIFIED Requirements

### Requirement: The save-now button clears a stale "Saved" state immediately on exit

`SaveNowButton` MUST clear its `showSaved` flag synchronously whenever
`autosave.state` transitions away from `"saved"` — including a new edit
moving the state to `"pending"`, and a save failure moving it to `"error"` —
in addition to the existing timer-based revert, so a stale green "Saved"
indicator never persists over a state that is no longer actually saved. This
MUST NOT be confused with, or require any change to, the autosave hook's
separate `initialSavedKey` priming behavior: a freshly-loaded, unedited form
MUST continue to render `idle` (not `pending`) on its first render, because
`lastSavedRef` is already primed from `initialSavedKey` before `dirty` is
first read.

#### Scenario: A new edit interrupts the post-save revert window

- **GIVEN** `SaveNowButton` has just shown "Saved" (`showSaved === true`,
  `autosave.state === "saved"`) inside the 1500ms revert window
- **WHEN** the lead edits the form again and `autosave.state` becomes
  `"pending"`
- **THEN** the "Saved" check icon/label clears synchronously, before the
  1500ms timer would otherwise have reverted it
- **AND** the button reflects the true `pending` state

#### Scenario: A save failure occurring inside the post-success revert window

- **GIVEN** `SaveNowButton` is showing "Saved" inside the 1500ms revert
  window
- **WHEN** a subsequent save attempt fails and `autosave.state` becomes
  `"error"`
- **THEN** the checkmark is replaced by the error affordance immediately,
  rather than waiting out the timer

#### Scenario: A freshly-loaded, unedited form does not show a stale Pending

- **GIVEN** a lead form is primed with `initialSavedKey` equal to the first
  computed payload key
- **WHEN** the form renders for the first time, with no user edits
- **THEN** the autosave state is `idle` (not `pending`), because
  `lastSavedRef` was already primed from `initialSavedKey` in the same
  effect batch
- **AND** this scenario MUST NOT be broken by any change made to satisfy the
  scenarios above
