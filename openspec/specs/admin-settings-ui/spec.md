# admin-settings-ui Specification

## Purpose

Define Settings live policy fields and form-state/error behavior, including unsaved edits, pending saves and the validation of period, policy and timezone inputs. Admin navigation and responsive record access live in `admin-navigation-responsive`.

## Requirements

### Requirement: Settings updates never manufacture the singleton

The canonical init migration MUST remain the only owner of `AppSettings`
singleton creation. `admin.updateSettings` MUST apply a partial update to the
fixed `id='singleton'` row and MUST fail if that row is missing; it MUST NOT
upsert a replacement from Prisma defaults and an incomplete patch.

#### Scenario: settings singleton is missing during a partial update

- **WHEN** an admin submits a valid partial settings update while the canonical
  singleton row is absent
- **THEN** the update fails as a data-integrity error
- **AND** no new `AppSettings` row is created

### Requirement: Period Policy Form Exposes Only Live Fields, Described Honestly

The Settings → Periods form MUST expose only period-policy fields that have a
live consumer, and each field's help text MUST describe the field's actual
current behavior rather than claiming it is deferred when its consumer already
ships.

#### Scenario: Consumer-less fields are absent end-to-end

- **WHEN** the period-settings contract is inspected for `firstDayOfWeek`,
  `deadlineDayOfWeek`, `maxOpenPeriods`, and `requireAllSectionsToPublish`
- **THEN** those fields are absent from the Settings → Periods form, from the
  `admin.updateSettings` input payload, AND from the `admin.getSettings` read
  payload
- **AND** those fields are absent from the shared period-settings schema/type and from
  the `AppSettings` Prisma model
- **AND** canonical init creates the `AppSettings` singleton while demo seed
  updates it idempotently, so `prisma migrate reset` plus seed succeeds

#### Scenario: Each working field's copy matches its real behavior

- **WHEN** an admin reads the Settings → Periods form
- **THEN** no help string or banner claims a working field is deferred or
  persisted-only
- **AND** each of the eleven retained fields describes its real current effect:
  - `autoCreatePeriods` — the period-creator scheduler creates the next period
    when the schedule advances
  - `periodLengthDays` — the scheduler spans each created period this many days
  - `defaultDeadlineDays` — the scheduler sets the deadline this many days after
    period start
  - `workingDays` — feeds the deadline (business-date) calculation
  - `gracePeriodHours` — submissions within this many hours past the deadline are
    always accepted
  - `allowLateSubmissions` — governs ONLY whether submissions are accepted after
    the grace window (off → rejected after grace; on → still accepted)
  - `autoPublishAfterDeadline` — the hourly auto-publisher publishes any
    still-draft period once `deadline + grace` has passed; it reads this flag
    independently, with NO "requires Auto-create periods" dependency
  - `autoArchiveWeeksAfterPublish` — the auto-archiver archives a published period
    this many weeks after publish (0 = never)
  - `deadlineTime` — configured `HH:MM` in `defaultTimezone`, applied with
    minute precision by both manual creation and scheduled auto-creation
  - `allowReopenAfterPublish` — the reopen request-path gate rejects reopen when
    off
  - `reopenWindowHours` — the reopen gate rejects reopen beyond this many hours
    after publish

#### Scenario: Period-policy save affordance uses canonical language

- **WHEN** an admin saves the Settings → Periods form
- **THEN** the user-facing copy uses "Period policy" (per CONTEXT.md), not
  "Period settings": the button reads "Save Period Policy", its `aria-label` is
  "Save period policy", the inline success reads "Period policy saved", and the
  mutation toast label is "Period policy"

### Requirement: Settings Sub-Tab Forms Preserve Unsaved Edits and Report Revalidation Failures Distinctly

A Settings sub-tab form MUST NOT overwrite an in-progress edit when its
local draft state is reseeded from a server query: the reseed MUST run only
when the form is not currently dirty (no unsaved local changes since the
last seed or save). This applies to every draft-holding Settings sub-tab —
Identity, Notifications, Periods, and Reminders. After the settings mutation
itself succeeds and its post-save landing-page revalidation
(`/api/revalidate-org`) fails or throws, the UI MUST still report the
settings save as successful (the underlying data write already happened)
AND MUST surface a distinct revalidation-failure signal, so a stale
landing-page cache is never reported as a fully clean save.

#### Scenario: Background refetch does not clobber an in-progress edit

- **WHEN** an admin is mid-edit in the Settings → Identity short-name or
  full-name field, has not yet saved, and the underlying organization query
  refetches in the background (e.g. on window refocus)
- **THEN** the admin's unsaved input in the field is not overwritten by the
  refetched server value

#### Scenario: Background refetch does not clobber unsaved Notifications edits

- **WHEN** an admin is mid-edit in the Settings → Notifications
  from-email field, has not yet saved, and the settings query refetches in
  the background
- **THEN** the admin's unsaved input is not overwritten by the refetched
  server value

#### Scenario: Background refetch does not clobber unsaved Periods or Reminders edits

- **WHEN** an admin is mid-edit in any Settings → Periods field (e.g.
  deadline days, grace period) or the Settings → Reminders default-timezone
  select, has not yet saved, and the settings query refetches in the
  background
- **THEN** the admin's unsaved input is not overwritten by the refetched
  server value

#### Scenario: Save succeeds while landing-page revalidation fails

- **WHEN** an admin saves the Identity or Notifications sub-tab, the
  underlying settings mutation succeeds, and the subsequent
  `/api/revalidate-org` call returns a non-2xx response or throws
- **THEN** the UI still shows its normal saved-success toast (the data write
  succeeded)
- **AND** the UI additionally shows a distinct revalidation-failure
  toast or log, so the admin knows the landing page cache may be stale
- **AND** a thrown `/api/revalidate-org` fetch never causes a successful
  save to be reported only as an error, with no success toast

#### Scenario: A legitimate server-side change reseeds a clean form

- **WHEN** any draft-holding Settings sub-tab form (Identity, Notifications,
  Periods, Reminders) has no unsaved edits (freshly loaded, or right after
  its own save completed) and the source query's data changes
- **THEN** the form fields update to reflect the new server values

### Requirement: A pending settings save owns its visible draft

Identity, Notifications, Periods and Reminders settings forms MUST disable their
editable controls while their own save is pending. An edit handler MUST NOT reset
an in-flight mutation and allow an earlier save to clear newer input.

#### Scenario: Settings save is pending

- **GIVEN** a settings form submits its current draft
- **WHEN** the save has not settled
- **THEN** its editable controls and repeated save action are disabled
- **AND** the submitted values remain visible

#### Scenario: Settings save fails

- **WHEN** the pending settings save fails
- **THEN** the controls become editable again
- **AND** the draft remains available for correction or retry

### Requirement: Disabled reopen policy ignores inactive window errors

The Settings → Periods form MUST exclude `reopenWindowHours` raw-input errors
from its save gate while `allowReopenAfterPublish` is false. Disabling the
policy MUST preserve the last valid committed numeric window in the settings
draft. If an invalid raw window is retained for later correction, enabling the
policy again MUST validate that raw value before allowing another save.

#### Scenario: Admin disables reopening after entering an invalid window

- **GIVEN** the committed reopen window is valid
- **AND** the admin has entered an invalid raw reopen-window value
- **WHEN** the admin turns off “Allow reopen after publish”
- **THEN** the disabled window no longer blocks Save
- **AND** saving submits `allowReopenAfterPublish: false`
- **AND** the submitted `reopenWindowHours` remains the last valid committed
  value

#### Scenario: Admin enables reopening with suspended invalid input

- **GIVEN** an invalid raw reopen-window value was suspended while reopening
  was disabled
- **WHEN** the admin turns on “Allow reopen after publish”
- **THEN** the invalid raw value is shown as invalid again
- **AND** Save remains disabled until the admin enters a valid window

#### Scenario: Server echo replaces suspended invalid input

- **GIVEN** the admin saved a disabled reopen policy after suspending an
  invalid raw window
- **WHEN** fresh server settings provide a valid committed reopen window
- **THEN** the form replaces the suspended raw value with the committed value
- **AND** enabling reopening leaves the field valid and Save enabled

### Requirement: Default timezone is validated at the shared settings boundary

The complete AppSettings schema and an explicit `defaultTimezone` in the partial update schema MUST accept only identifiers resolvable by the runtime's IANA timezone database. Validation MUST use the same resolution contract as `ReminderPolicy.timezone`. Invalid non-empty values MUST fail at `defaultTimezone` before settings persistence or period deadline calculation. The complete settings schema MUST still require the field, while omission from a partial update MUST leave the property absent and MUST NOT manufacture a default.

#### Scenario: Complete settings contain a supported timezone

- **WHEN** complete settings contain a runtime-resolvable timezone such as `Europe/Moscow`, `UTC`, `Etc/UTC`, or `Asia/Tokyo`
- **THEN** shared settings validation accepts the value
- **AND** the validated value remains usable by the existing deadline calculation

#### Scenario: Complete settings contain an invalid timezone

- **WHEN** complete settings contain a non-empty but unresolvable `defaultTimezone`
- **THEN** validation rejects the settings at the `defaultTimezone` path
- **AND** the value cannot reach deadline calculation

#### Scenario: Partial update explicitly supplies an invalid timezone

- **WHEN** a partial settings update supplies an unresolvable `defaultTimezone`
- **THEN** validation rejects the update at the `defaultTimezone` path
- **AND** no settings writer receives the invalid value

#### Scenario: Partial update omits the timezone

- **WHEN** a partial settings update omits `defaultTimezone`
- **THEN** validation accepts the update
- **AND** the parsed patch still has no `defaultTimezone` property
