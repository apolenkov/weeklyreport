## MODIFIED Requirements

### Requirement: In-flight control actions show a visible busy state

Lead report asynchronous controls MUST visibly show work in progress and block repeat activation. A rendered save/retry control MUST retain its DOM identity while saving, show a full-opacity accent spinner, set `aria-busy=true`, and be disabled. On settlement it MUST restore non-busy styling and expose the existing success or retry state.

#### Scenario: a save mutation is in flight

- **WHEN** the lead triggers an available save/retry action and the mutation has not settled
- **THEN** the same button shows a white spinner on accent fill, has `aria-busy=true`, and is disabled
- **AND** another activation cannot trigger a duplicate save

#### Scenario: the mutation settles successfully

- **WHEN** the in-flight save succeeds
- **THEN** the button returns to non-busy styling with `aria-busy=false`
- **AND** the existing Saved check flash is retained before the retry-only control disappears

#### Scenario: the mutation settles with an error

- **WHEN** the in-flight save fails
- **THEN** accent busy styling ends, `aria-busy=false`, and Retry is enabled with an alert icon
- **AND** a focused Retry remains the same focused DOM node

## ADDED Requirements

### Requirement: Lead completion MUST expose Retry instead of a permanent Save action

Editable Lead Report completion actions MUST rely on autosave and omit a permanent manual Save control. Autosave error MUST expose `Retry saving draft` using the canonical force-save handler. An active Retry MUST remain mounted during in-flight work and the Saved flash, then disappear after success. This MUST NOT remove Save buttons inside explicit inline/editor submissions.

#### Scenario: Autosave needs no recovery

- **WHEN** completion actions render outside an active recovery attempt without an autosave error
- **THEN** no manual Save or Retry button is shown
- **AND** autosave status remains available without requiring another click

#### Scenario: Retry traverses busy and Saved states

- **WHEN** the lead activates Retry after autosave failure
- **THEN** the canonical handler runs once and the same button remains mounted through in-flight pending/saving/error observations and the Saved flash
- **AND** it stays disabled with `aria-busy=true` throughout in-flight work
- **AND** after success its `aria-busy` becomes false and the Saved flash lasts 1500 ms before removal

### Requirement: Retry removal MUST preserve completion focus without stealing it

When a successful completion Retry disappears, focus MUST move only if that button still owns focus: to enabled Submit, otherwise to the completion group. If the user has moved focus elsewhere, removal MUST leave it there. A repeated failure MUST retain the same enabled Retry and its focus rather than dropping focus to the document.

#### Scenario: Focused Retry finishes successfully

- **WHEN** the Saved flash ends while Retry still owns focus
- **THEN** enabled Submit receives focus, or the completion group receives focus if Submit is blocked
- **AND** removal does not leave focus on the document body

#### Scenario: The lead leaves Retry before its flash ends

- **WHEN** the lead focuses another control before successful Retry disappears
- **THEN** removal preserves that control's focus and does not focus Submit

#### Scenario: Retry fails again

- **WHEN** the active attempt ends with another save error
- **THEN** the same Retry remains enabled, non-busy, and focused if it owned focus
