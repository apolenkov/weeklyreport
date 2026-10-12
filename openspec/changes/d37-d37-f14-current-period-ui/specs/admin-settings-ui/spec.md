## MODIFIED Requirements

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

#### Scenario: Deadline time is cleared

- **WHEN** the administrator clears Deadline time
- **THEN** the form reports an inline linked HH:MM error, preserves the invalid edit without committing it, and blocks Save until a valid minute-precision time is entered

#### Scenario: Numeric help survives invalid input

- **WHEN** a numeric Period Policy field is valid or invalid
- **THEN** its business hint remains in its accessible description and an invalid value adds the linked error without replacing the hint

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

#### Scenario: Correcting one invalid field preserves focus

- **WHEN** an administrator corrects one of multiple invalid Period Policy fields
- **THEN** focus stays in the edited field and Save remains blocked for other active errors
