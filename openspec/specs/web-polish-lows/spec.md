## Purpose

Small correctness and UX fixes across web-app low-priority polish items (autosave, dialogs, pagination, form validation).

## Requirements

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

### Requirement: The pending-reminders list uses stable keys

`alert-bar`'s pending-lead list MUST be keyed by a stable identifier (the
lead's `id`, or array index if no stable id is available on the item shape)
rather than by display name.

#### Scenario: Two pending leads sharing a name both render correctly

- **WHEN** two leads with the same display name are both pending
- **THEN** both render as separate list entries
- **AND** neither entry is dropped or duplicated due to a key collision

### Requirement: Clearing a period's end date or deadline is an explicit clear, not a silent no-op

Ruling F16 (Sasha, 2026-07-24, вариант «а»): the explicit clear is real for
the **deadline only**. `periods-tab-dialog`'s edit-mode submit handler MUST
submit an explicit `null` for `deadline` when an existing value is cleared to
an empty string, distinct from the create-mode empty case which MUST continue
to omit the field (`undefined`). The server MUST treat `deadline: null` as a
real deletion — the period then has no deadline and every deadline-driven
consumer handles that state explicitly.

Clearing `periodEnd` is NOT a deletion: a period must end. An edit-mode
clear of `periodEnd` MUST fail loudly with a field validation error, never
silently keep the old value.

#### Scenario: Clearing an existing period's deadline deletes it

- **WHEN** a head edits a period that has a deadline, clears the deadline
  field, and submits
- **THEN** the submitted payload carries `deadline: null`
- **AND** after the save the period has no deadline
- **AND** the audit event `period.manual-edit` carries
  `changes.deadline = { from: <previous ISO>, to: null }`

#### Scenario: Clearing an existing period's end date is rejected loudly

- **WHEN** a head edits a period, clears the end-date field, and submits
- **THEN** the form shows a field validation error naming `periodEnd` as
  required
- **AND** no update request mutates the period

#### Scenario: Create mode still omits an unset end date

- **WHEN** a head creates a period leaving the end-date field empty
- **THEN** the submitted payload omits `periodEnd` (`undefined`), and the
  server derives the default end date

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

#### Scenario: An explicit caller override still takes precedence

- **WHEN** a consumer calls the hook WITH an explicit `options.enabled`
  value, and the query-options factory sets a different `enabled` value
- **THEN** the caller-supplied `options.enabled` value wins

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

### Requirement: Skeleton bar widths use a JIT-extractable class or inline style

Dashboard skeleton bars MUST express their width using either a literal
Tailwind class string that appears verbatim in source (e.g. via a static
lookup map), or an inline `style={{ width }}`. This governs
`DashboardSkeleton`
(`apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx`), which MUST
NOT build a Tailwind width utility class via a runtime template-literal
interpolation (e.g. `` `w-[${w}px]` ``), because Tailwind's static JIT
scanner cannot extract a class name that only exists at runtime — the
utility is silently never generated, and the bar renders with zero width.

#### Scenario: Skeleton bars render with visible width

- **GIVEN** the dashboard is in its loading state
- **WHEN** `DashboardSkeleton` renders its header skeleton bars
- **THEN** each bar has a non-zero, visible width matching its intended
  value
- **AND** no bar's width class is constructed via a runtime
  template-literal interpolation
