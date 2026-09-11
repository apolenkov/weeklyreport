# admin-reminders-ui Specification

## Purpose

The admin Reminders tab is the user-facing surface for configuring
`ReminderPolicy` rows that drive the reminders engine. This specification defines
how the tab presents and edits those policies in the admin's language — plain
"Reminder" cards, inline editing, and permanent removal — while leaving the
reminders engine itself untouched.

## Requirements

### Requirement: Reminder Cards Use Plain Language, Not Engine Jargon

Each reminder on the admin Reminders tab MUST render as a plain-language card and
MUST NOT surface engine jargon. The card MUST show an on/off control bound to the
policy `active` flag, a human-readable timing phrase derived from the offset
(e.g. "24h before deadline"), and a one-line plain description of the recipient
group. The card MUST NOT display the raw `kind` token, the raw `audience` token,
the signed offset (e.g. `T-1440min`), or the word "policy" in user-facing copy.
All copy MUST be English and MUST use the canonical term "Reminder" (per
CONTEXT.md).

#### Scenario: Deadline reminder card reads in plain language

- **WHEN** an admin opens the Reminders tab and a `deadline` /
  `lead-with-draft` policy with offset −1440 minutes is active
- **THEN** the card shows an enabled on/off control, the timing phrase
  "24h before deadline", and a recipient line naming the leads who still have a
  draft
- **AND** the card does not render the raw strings "lead-with-draft",
  "T-1440min", or "policy"; "deadline" is allowed within the human-readable
  timing phrase

#### Scenario: Toggling the card enables or disables the reminder

- **WHEN** an admin flips a card's on/off control
- **THEN** the underlying policy `active` flag is saved through the existing
  save path
- **AND** the card's enabled/disabled state reflects the new value

#### Scenario: The whole tab says "Reminder", never "policy"

- **WHEN** an admin opens the Reminders tab, saves or removes a reminder, and
  opens the remove-confirmation dialog
- **THEN** the tab title, description, search placeholder/aria, the add-reminder
  CTA, the save/remove toasts, and the remove-confirm dialog title all use
  "Reminder" and none renders the word "policy"
- **AND** the remove-confirm preview shows a plain timing + recipient line, not a
  raw `kind`/offset/`audience` headline

### Requirement: The Card Replaces the Generated-Schedule Table With a Next-Send Line

The reminder card MUST NOT render the read-only generated-rules table or a
"Schedule" expander. It MUST instead show a single next-send line computed from
the rules already provided to the card. When at least one upcoming send exists,
the line MUST state the earliest upcoming send date and that it recurs each
period. When the reminder is disabled or has no upcoming send, the line MUST read
that there are no upcoming sends. The UI projection of each generated rule MUST
contain only `policyId`, `active`, and `fireAt`; policy editing continues to use
the separate complete policy view. No backend query is added.

#### Scenario: Active reminder shows the next send date

- **WHEN** an admin views an active reminder whose earliest future generated
  rule fires on a known date
- **THEN** the card shows a next-send line naming that date and indicating the
  reminder then recurs every period
- **AND** no generated-schedule table and no "Schedule" expander are rendered

#### Scenario: Disabled or exhausted reminder shows no upcoming sends

- **WHEN** an admin views a reminder that is disabled, or that has no future
  generated rule
- **THEN** the card's next-send line states there are no upcoming sends

#### Scenario: Generated rules stay a minimal read-only projection

- **WHEN** the admin snapshot is mapped for the Reminders tab
- **THEN** each generated rule exposes only its owning `policyId`, active flag,
  and fire time
- **AND** no generated name, description, or unused rule round-trip fields are
  synthesized for the policy editor

### Requirement: Add and Edit Use One Reminder-Type Preset

The Add/Edit form MUST offer the reminder type as a single preset choice rather
than two independent `Kind` and `Audience` controls. Exactly two presets MUST be
selectable for a new reminder: "Deadline reminder to leads" (mapping to
`kind=deadline`, `audience=lead-with-draft`) and "Escalation digest to head"
(mapping to `kind=escalation`, `audience=head-of-late`). The form MUST NOT
offer a third kind or allow an admin to assemble a kind/audience pairing
outside these presets. The existing timing input (numeric
amount + minutes/hours/days unit + before/after-deadline direction) MUST be
retained unchanged.

#### Scenario: Creating a reminder offers only the two valid presets

- **WHEN** an admin opens the Add-reminder form
- **THEN** the type control offers exactly "Deadline reminder to leads" and
  "Escalation digest to head" and nothing else
- **AND** selecting a preset sets the corresponding `kind` and `audience` on save
- **AND** the numeric-amount, unit, and before/after timing controls are present

#### Scenario: No separate kind and audience dropdowns

- **WHEN** an admin opens the Add or Edit form
- **THEN** there is no standalone `Kind` dropdown and no standalone `Audience`
  dropdown

#### Scenario: A new reminder never starts from an invalid pairing

- **WHEN** an admin opens the Add-reminder form while the org default audience
  is `head-of-late`
- **THEN** the form starts from a complete valid preset (deadline→leads) and
  does NOT pre-build the invalid `deadline` → `head-of-late` pairing
- **AND** saving without changing the type persists a valid preset pairing

### Requirement: Advanced Fields Are Collapsed by Default

The form MUST place the timezone and the validity window (`Valid from`,
`Valid until`, and the forever toggle) inside an "Advanced" section that is
collapsed by default. These fields MUST remain fully editable when the section is
expanded, preserving validity windows and per-reminder timezone. The common path
(type + timing + active) MUST be usable without opening Advanced.

#### Scenario: Advanced section hides timezone and validity by default

- **WHEN** an admin opens the Add or Edit form
- **THEN** the timezone and validity-window controls are not visible until the
  admin expands the Advanced section
- **AND** after expanding, the admin can edit the timezone, the valid-from date,
  the valid-until date, and the forever toggle

### Requirement: Editing Is Inline, Not a Modal Dialog

Clicking Edit on a reminder card MUST replace that card with the edit form
inline in the list. Adding a new reminder MUST render the same form at the top
of the list. The form MUST NOT open in a modal dialog for either Add or Edit.
Canceling an inline edit MUST restore the card; canceling a new reminder MUST
remove the form and leave the list unchanged.

#### Scenario: Editing a reminder shows the form inline

- **WHEN** an admin clicks Edit on a reminder card
- **THEN** the card is replaced by the edit form at the same list position
- **AND** no modal dialog is rendered
- **AND** saving or canceling collapses the form back to the card

#### Scenario: Adding a reminder shows the form at the top of the list

- **WHEN** an admin clicks the Add-reminder CTA
- **THEN** the form appears at the top of the reminders list
- **AND** no modal dialog is rendered
- **AND** canceling removes the form without creating a reminder

### Requirement: Removing a Reminder Permanently Deletes It

The remove action MUST hard-delete the selected `ReminderPolicy` and all of its
derived `ReminderRule` rows. The remove-confirm dialog MUST warn that the action
is permanent and cannot be undone. The action MUST NOT archive or soft-delete
the policy.

#### Scenario: Removing a reminder deletes it from the list

- **WHEN** an admin confirms removal of a reminder
- **THEN** the policy and its derived rules are deleted
- **AND** the card disappears from the list
- **AND** the confirmation dialog explains that the action is permanent

### Requirement: The reminders UI uses the existing engine contract

Saving a reminder through the card or form MUST write only the `ReminderPolicy`
fields consumed by the engine (`kind`, `audience`, `offsetMinutes`, `timezone`,
`active`, `validFrom`, `validUntil`). The UI MUST use the existing Prisma,
policy-to-rule applicator, dispatch scheduler, and shared contracts without
adding a persisted presentation-only field.

#### Scenario: Saving writes existing policy fields only

- **WHEN** an admin saves a reminder from the simplified form
- **THEN** the persisted policy carries a valid `kind`, `audience`,
  `offsetMinutes`, `timezone`, `active`, and validity window
- **AND** no presentation-only field is persisted

### Requirement: A reminder toggle changes only its active flag

The reminder card on/off action MUST preserve every existing policy field except
`active`. In particular, `validFrom` and a non-null `validUntil` MUST retain their
exact instants, including milliseconds, and a null upper bound MUST remain null.
The toggle MUST NOT use the date-only form editor conversion.

#### Scenario: Disabling preserves an open-ended validity interval

- **GIVEN** an active reminder with a non-midnight start and no upper bound
- **WHEN** the admin disables it using its card
- **THEN** the save payload changes only active to false
- **AND** its exact start instant and null upper bound are preserved

#### Scenario: Enabling preserves both validity instants

- **GIVEN** an inactive reminder with non-midnight start and end instants
- **WHEN** the admin enables it using its card
- **THEN** the save payload changes only active to true
- **AND** both original validity instants are preserved

### Requirement: Delivery activity exposes durable execution outcomes

The Reminders tab MUST render the reminder executions returned by the admin
snapshot as a read-only delivery-activity table. Each row MUST show the
recipient, scheduled time, lifecycle status, sent time when present, and the
recorded error when present. The status vocabulary MUST include `Queued`,
`Sending`, `Sent`, and `Failed`; the UI MUST preserve the distinction between
an in-flight send and a confirmed delivery. An empty execution collection MUST
render an explicit empty state rather than a missing section.

#### Scenario: An in-flight execution remains observable

- **WHEN** the snapshot contains an execution with status `sending`
- **THEN** the delivery-activity table renders that recipient with the label
  `Sending`
- **AND** it does not show a sent timestamp or claim that delivery completed

#### Scenario: A failed execution preserves its recovery fact

- **WHEN** the snapshot contains a `failed` execution with an error message
- **THEN** the table renders `Failed` and the recorded error text
- **AND** the policy cards remain available for ordinary reminder management

#### Scenario: No executions are available yet

- **WHEN** the snapshot contains no reminder executions
- **THEN** the Reminders tab renders `No reminder deliveries yet.` in the
  delivery-activity section
