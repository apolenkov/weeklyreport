## ADDED Requirements

### Requirement: Non-admin modal dialogs trap and restore focus via a shared primitive

Every non-admin `role="dialog"` / `role="alertdialog"` modal MUST trap keyboard
focus within the dialog while open and restore focus to the control that opened
it on close, sourced from one shared focus-managed dialog primitive (the Radix
Dialog in `@customreport/ui`, or a single shared wrapper) rather than per-dialog
hand-rolled autofocus. This governs the lead risk
(`apps/web/src/components/lead/risk-edit-dialog.tsx`), decision
(`apps/web/src/components/lead/decision-edit-dialog.tsx`), and reopen
(`apps/web/src/components/lead/request-reopen-dialog.tsx`) dialogs, the shared
`apps/web/src/components/ui/confirmation-dialog.tsx`, and the publish lock
(`apps/web/src/components/weekly-report/publish-lock-button.tsx`). Behavior is
otherwise unchanged; this unifies the focus implementation, it does not alter the
dialogs' content or actions.

#### Scenario: Tab does not escape an open dialog

- **GIVEN** one of the governed modals is open
- **WHEN** the keyboard user presses Tab past the last focusable control
- **THEN** focus stays within the dialog rather than moving to background content

#### Scenario: focus returns to the opener on close

- **GIVEN** a governed modal was opened from a trigger control
- **WHEN** it closes via Escape, Cancel, overlay click, or a successful action
- **THEN** keyboard focus returns to the trigger control and is not left on
  `<body>`

### Requirement: Dialog focus documentation matches the implementation

A dialog component's documentation MUST NOT claim focus behavior it does not
implement. The `confirmation-dialog.tsx` JSDoc MUST NOT claim it "Traps focus"
unless the shared primitive actually traps focus there.

#### Scenario: the confirmation-dialog JSDoc is truthful

- **GIVEN** `confirmation-dialog.tsx` is migrated onto the shared focus-managed
  primitive
- **WHEN** a maintainer reads its JSDoc
- **THEN** the "Traps focus" claim is true of the wired code (or the claim is
  removed)

### Requirement: Report-shell controls expose correct focus and keyboard semantics

Interactive report-shell controls MUST NOT advertise affordances they do not
implement. `LockBadge` (`apps/web/src/components/report-shell/lock-badge.tsx`)
MUST NOT keep `onFocus`/`onBlur` handlers that can never fire (a `role="img"`
element with no `tabIndex`): either make it focusable or drop the dead handlers.
`ScopeToggle` (`apps/web/src/components/report-shell/scope-toggle.tsx`), which
advertises `role="radiogroup"`, MUST implement arrow-key roving tabindex, or use
`role="group"` with `aria-pressed` toggles instead.

#### Scenario: LockBadge has no dead focus handlers

- **GIVEN** `LockBadge` renders as a non-focusable `role="img"` element
- **WHEN** the cleanup runs
- **THEN** either it is made focusable so its focus handlers can fire, or the
  dead `onFocus`/`onBlur` handlers are removed

#### Scenario: ScopeToggle keyboard semantics match its role

- **GIVEN** `ScopeToggle` declares `role="radiogroup"`
- **WHEN** a keyboard user navigates it with arrow keys
- **THEN** roving tabindex moves the selection — or the control instead uses
  `role="group"` with `aria-pressed` so its semantics match its behavior
