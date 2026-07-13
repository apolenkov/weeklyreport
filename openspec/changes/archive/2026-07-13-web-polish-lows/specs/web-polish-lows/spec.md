## ADDED Requirements

### Requirement: The pause-reason prompt calls its persist callback outside the state updater

`usePauseReason`'s `confirm` function MUST invoke the `onPause` persist
callback as a plain statement, never from inside a `useState` updater
function passed to `setPending`. React MAY invoke a state updater function
more than once for a single state transition (notably under Strict Mode's
double-render check); a persist side effect placed inside one MUST NOT rely
on it running exactly once.

#### Scenario: Confirming a pause reason persists exactly once

- **WHEN** a lead confirms a pause reason for an item
- **THEN** `onPause` is called exactly once with that item's id and reason
- **AND** the call happens outside any `setPending` updater function

### Requirement: A pausedReason-only validation error focuses the reason field

`item-edit-dialog`'s save-invalid-focus logic MUST focus the paused-reason
input when the only populated validation error is `pausedReason`, instead of
falling through to the text field or an unrelated stage checkbox.

#### Scenario: A paused item with no reason keeps focus discoverable

- **WHEN** a lead sets status to Paused, leaves the reason blank, and
  attempts to save (button click or the Ctrl/Cmd+Enter shortcut)
- **THEN** the `pausedReason` validation error is set
- **AND** keyboard/screen-reader focus moves to the paused-reason input,
  not the stage checkbox or the text field

### Requirement: The autosave badge visually distinguishes the error state

The lead-form header's autosave badge MUST render a destructive
background/text variant when `autosave.state === "error"`, distinct from
the green variant used for `"saving"`, `"pending"`, and `"saved"`.

#### Scenario: A failed autosave reads as an error, not a success

- **WHEN** an autosave attempt fails and `autosave.state` becomes `"error"`
- **THEN** the badge renders the `"⚠ Save failed"` label on a destructive
  background
- **AND** it does not render on the same green background used for a
  successful save

### Requirement: The slides-mode fallback route preserves the requested view mode

The lead-form toolbar's `ViewModeToggle` fallback route MUST carry the
`?mode=slides` marker when it is reached from slides mode (the edit-route
href used from a read-only or foreign-slides-deck context while already in
slides mode), so re-entering through that fallback keeps the requested mode
instead of silently reopening in edit mode.

#### Scenario: Slides-mode entry survives the fallback route

- **WHEN** a viewer in slides mode is routed through the toolbar's fallback
  href
- **THEN** the resulting URL carries `?mode=slides`
- **AND** the report shell renders in slides mode after navigation

### Requirement: The save-now button clears a stale "Saved" state immediately on exit

`SaveNowButton` MUST clear its `showSaved` flag synchronously whenever
`autosave.state` transitions away from `"saved"`, in addition to the
existing timer-based revert, so a save failure occurring inside the
post-success revert window replaces the checkmark immediately rather than
waiting for the timer.

#### Scenario: A failure during the revert window shows the error affordance immediately

- **WHEN** a save succeeds, the checkmark is showing, and a subsequent save
  fails before the revert timer elapses
- **THEN** the button reflects the error state immediately
- **AND** it does not continue showing the stale success checkmark until the
  timer fires

### Requirement: The pending-reminders list uses stable keys

`alert-bar`'s pending-lead list MUST be keyed by a stable identifier (the
lead's `id`, or array index if no stable id is available on the item shape)
rather than by display name.

#### Scenario: Two pending leads sharing a name both render correctly

- **WHEN** two leads with the same display name are both pending
- **THEN** both render as separate list entries
- **AND** neither entry is dropped or duplicated due to a key collision

### Requirement: Clearing a period's end date or deadline is an explicit clear, not a silent no-op

`periods-tab-dialog`'s edit-mode submit handler MUST submit an explicit
`null` for `periodEnd`/`deadline` when an existing value is cleared to an
empty string, distinct from the create-mode empty case which MUST continue
to omit the field (`undefined`).

#### Scenario: Clearing an existing period's end date persists the clear

- **WHEN** a head edits a period that has an end date, clears the end-date
  field, and submits
- **THEN** the submitted payload carries `periodEnd: null`
- **AND** the server-side period no longer has an end date after the save

#### Scenario: Create mode still omits an unset end date

- **WHEN** a head creates a new period and leaves the end-date field empty
- **THEN** the submitted payload omits `periodEnd` (`undefined`), not `null`

### Requirement: The period delete-button guard mirrors the full server rejection condition

`periods-action-icon-row`'s delete button MUST be disabled for every period
state the server rejects a delete for (published or reopened), not only
`periodStatus === "published"`.

#### Scenario: A reopened period's delete button is disabled

- **WHEN** a period is reopened (whether or not it is also published)
- **THEN** the delete button renders disabled with a label explaining why
- **AND** no delete request that the server would reject is reachable
  through the button

### Requirement: Cursor-paginated queries respect a factory-set `enabled` when the caller supplies none

`use-cursor-pagination` MUST only override the built query options'
`enabled` value with `options.enabled` when the caller explicitly supplies
it; when `options.enabled` is `undefined`, the factory's own `enabled`
value (if any) MUST pass through unmodified.

#### Scenario: A factory-disabled query stays disabled with no caller override

- **WHEN** a consumer calls the hook without an `options.enabled` value, and
  the query-options factory itself sets `enabled: false`
- **THEN** the resulting query is disabled
- **AND** the factory's `enabled: false` is not silently overwritten by
  `undefined`

### Requirement: The web-vitals dynamic import handles rejection

`reportWebVitals`'s top-level `import("web-vitals")` promise chain MUST
carry a `.catch` handler, so a chunk-load failure does not surface as an
unhandled promise rejection.

#### Scenario: A failed web-vitals chunk load does not throw unhandled

- **WHEN** the dynamic `import("web-vitals")` rejects (e.g. a network
  failure loading the chunk)
- **THEN** the rejection is caught
- **AND** no unhandled promise rejection is reported

### Requirement: The admin product form blocks a blank name from saving

`products-tab`'s product-save form MUST require a non-blank (post-trim)
name before `handleSave` is reachable: the Save button MUST be disabled on
a blank name, and `handleSave` MUST NOT call `saveProjectMut.mutate` when
the trimmed name is empty.

#### Scenario: A blank product name cannot be saved

- **WHEN** an admin clears the product name field to blank or whitespace
- **THEN** the Save button is disabled
- **AND** no mutation is sent for a blank name even if `handleSave` is
  invoked directly (e.g. via a keyboard submit)
