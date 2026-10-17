## ADDED Requirements

### Requirement: Confirm is one-shot while the host reports pending

For a host that passes `isPending`, the dialog MUST invoke `onConfirm` at most once
between opening (or the end of a pending phase) and the next pending phase, even if
the confirm action is activated again before the host re-renders with
`isPending=true`. The lock MUST release when the dialog closes or when a pending
phase ends with the dialog still open. Hosts that do not pass `isPending` MUST keep
their current behaviour.

#### Scenario: two rapid activations confirm once

- **WHEN** the confirm button is clicked twice, or Enter is pressed twice on it, before the host reports pending
- **THEN** `onConfirm` is invoked once

#### Scenario: a failed delete can be retried

- **WHEN** the host reports pending and then not pending with the dialog still open
- **THEN** the next confirm activation invokes `onConfirm` again

### Requirement: Pending keeps keyboard focus inside the dialog

While `isPending` is true the dialog MUST keep focus inside; when the focused action
becomes disabled, focus MUST move to the dialog panel and Tab and Shift+Tab MUST stay
on it. Opening already pending MUST NOT focus the destructive action.

#### Scenario: focused Cancel becomes disabled

- **WHEN** Cancel holds focus and the host switches to pending
- **THEN** the dialog panel holds focus
- **AND** Tab and Shift+Tab leave focus on the panel

### Requirement: Risk context is part of the accessible description

The `alertdialog` accessible description MUST read the preview, then the subtitle,
the consequence and the reversibility note when each is present and shown, and every
referenced id MUST resolve and be unique across mounted dialogs.

#### Scenario: full risk context

- **WHEN** a dialog shows preview, subtitle, consequence and an irreversible action
- **THEN** its accessible description is "preview subtitle consequence This action cannot be undone."

#### Scenario: reversibility hidden

- **WHEN** `showReversibility` is false
- **THEN** the description omits the reversibility note

### Requirement: Focus restore skips a disconnected explicit target

On close, the dialog MUST restore focus to the explicit trigger node only while it is
connected to the document. When it is disconnected and the previously focused element
is still connected, focus MUST return to that element. When both are gone the
destination is NOT specified by this change (policy deferred to Root with the public
removed-opener evidence); this change MUST NOT invent a fallback for that case.

#### Scenario: stale explicit trigger with a connected previous element

- **WHEN** the explicit trigger node is disconnected and the element focused when the dialog opened is still connected at close
- **THEN** focus returns to that previously focused element

#### Scenario: both targets gone

- **WHEN** the explicit trigger and the previously focused element are both disconnected at close
- **THEN** the destination is deferred and no requirement is placed on it here
