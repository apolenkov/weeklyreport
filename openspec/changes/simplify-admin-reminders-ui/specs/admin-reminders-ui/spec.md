# admin-reminders-ui Specification (delta)

## ADDED Requirements

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
- **AND** the card does not render the strings "lead-with-draft", "deadline",
  "T-1440min", or "policy"

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
that there are no upcoming sends. No backend query is added.

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

### Requirement: Add and Edit Use One Reminder-Type Preset

The Add/Edit dialog MUST offer the reminder type as a single preset choice rather
than two independent `Kind` and `Audience` controls. Exactly two presets MUST be
selectable for a new reminder: "Deadline reminder to leads" (mapping to
`kind=deadline`, `audience=lead-with-draft`) and "Escalation digest to head"
(mapping to `kind=escalation`, `audience=head-of-late`). The dialog MUST NOT
offer the unused `follow_up` kind and MUST NOT allow an admin to assemble a
kind/audience pairing outside these presets. The existing timing input (numeric
amount + minutes/hours/days unit + before/after-deadline direction) MUST be
retained unchanged.

#### Scenario: Creating a reminder offers only the two valid presets

- **WHEN** an admin opens the Add-reminder dialog
- **THEN** the type control offers exactly "Deadline reminder to leads" and
  "Escalation digest to head" and nothing else
- **AND** selecting a preset sets the corresponding `kind` and `audience` on save
- **AND** the numeric-amount, unit, and before/after timing controls are present

#### Scenario: No separate kind and audience dropdowns

- **WHEN** an admin opens the Add or Edit dialog
- **THEN** there is no standalone `Kind` dropdown and no standalone `Audience`
  dropdown

#### Scenario: A new reminder never starts from an invalid pairing

- **WHEN** an admin opens the Add-reminder dialog while the org default audience
  is `head-of-late`
- **THEN** the dialog starts from a complete valid preset (deadline→leads) and
  does NOT pre-build the invalid `deadline` → `head-of-late` pairing
- **AND** saving without changing the type persists a valid preset pairing

### Requirement: Advanced Fields Are Collapsed by Default

The dialog MUST place the timezone and the validity window (`Valid from`,
`Valid until`, and the forever toggle) inside an "Advanced" section that is
collapsed by default. These fields MUST remain fully editable when the section is
expanded, preserving dated rollout and per-reminder timezone. The common path
(type + timing + active) MUST be usable without opening Advanced.

#### Scenario: Advanced section hides timezone and validity by default

- **WHEN** an admin opens the Add or Edit dialog
- **THEN** the timezone and validity-window controls are not visible until the
  admin expands the Advanced section
- **AND** after expanding, the admin can edit the timezone, the valid-from date,
  the valid-until date, and the forever toggle

### Requirement: The Reminders Engine Is Unchanged

This presentation change MUST NOT alter the reminders engine. Saving a reminder
through the simplified card or dialog MUST write the same `ReminderPolicy` fields
the engine already consumes (`kind`, `audience`, `offsetMinutes`, `timezone`,
`active`, `validFrom`, `validUntil`). The change MUST NOT modify the Prisma
schema, the policy-to-rule applicator, the dispatch scheduler, or the shared
contracts. No database migration is introduced.

#### Scenario: Saving writes existing policy fields only

- **WHEN** an admin saves a reminder from the simplified dialog
- **THEN** the persisted policy carries a valid `kind`, `audience`,
  `offsetMinutes`, `timezone`, `active`, and validity window
- **AND** no new persisted field and no schema migration are required

### Requirement: Legacy Non-Preset Reminders Are Preserved, Not Rewritten

A stored policy whose pairing is outside the two presets MUST remain visible and
editable without being silently coerced into a preset. Such a pairing includes a
legacy `follow_up`, or an inverted `deadline` → `head-of-late`. The card MUST
describe it in plain language from its actual stored values, and the dialog MUST
represent its type as a read-only "Custom" label so that saving unrelated fields
(timing, active) does not change the stored pairing.

#### Scenario: Editing a legacy reminder keeps its stored pairing

- **WHEN** an admin edits a reminder whose stored `kind`/`audience` pair is not
  one of the two presets, changing only its timing
- **THEN** the type is shown as "Custom" and is not reassigned to a preset
- **AND** the saved policy keeps its original `kind` and `audience`
