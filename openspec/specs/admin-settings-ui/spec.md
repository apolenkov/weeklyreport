# admin-settings-ui Specification

## Purpose

Define Admin navigation and responsive record access, Settings live policy fields, and form-state/error behavior.

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

### Requirement: Admin Tab Strip Navigates Client-Side

The desktop admin tab strip MUST navigate between tabs client-side (via
`next/link` or an equivalent client-side router transition) rather than a
raw anchor full-page load. Switching tabs MUST NOT discard the React Query
cache or trigger a full document reload. The desktop strip and the mobile
`AdminTabsMobileSelect` picker MUST navigate to the same URL shape and MUST
behave the same way (both client-side) for the same tab selection.

#### Scenario: Clicking a desktop tab pill does not reload the page

- **WHEN** an admin on `/admin?tab=users` clicks the "Products" tab pill in
  the desktop tab strip
- **THEN** the URL updates to `/admin?tab=products` via client-side
  navigation, with no full-page reload
- **AND** any React Query data already cached for the admin panel remains
  cached across the transition

#### Scenario: Desktop and mobile tab pickers behave consistently

- **WHEN** the same tab is selected via the desktop pill strip and via the
  mobile `AdminTabsMobileSelect` picker
- **THEN** both navigations resolve to the same `/admin?tab=<id>` URL using
  client-side routing, with no behavioral divergence between the two entry
  points

### Requirement: The products-tab deep-link auto-expand does not re-fire on data-only refetches

The products-tab deep-link auto-expand effect MUST auto-expand the
`?product=<id>` panel on initial load, but MUST NOT re-open a panel the user
has manually collapsed solely because the underlying `products` data
reference changed. This governs `ProductsTab`
(`apps/web/src/features/admin/ui/products-tab.tsx`). The effect MUST distinguish
a genuine new deep-link target (`productFilter` changing) from a data-only
refetch, and only the former re-triggers auto-expand once the user has manually
toggled the panel.

#### Scenario: A same-tab mutation does not reopen a collapsed deep-linked panel

- **GIVEN** an admin is on `/admin?tab=products&product=<id>` and has
  manually collapsed the auto-expanded panel
- **WHEN** the admin edits or archives a different product in the same tab,
  invalidating `admin.snapshot` and producing a new `products` reference
- **THEN** the deep-linked panel stays collapsed after the refetch

#### Scenario: A new deep-link target still auto-expands

- **GIVEN** an admin navigates to a new `?product=<id>` deep link for a
  different product
- **WHEN** the products tab renders with the new `productFilter`
- **THEN** the newly-targeted panel auto-expands, even if the user had
  previously collapsed a different panel

### Requirement: Admin Primary Navigation Fits Every Supported Viewport

The Admin route at `/admin` MUST expose every canonical Admin destination
without document-level horizontal overflow. At narrow and tablet widths where
the complete pill strip does not fit, the route MUST use the compact Admin
picker; the full pill strip MUST appear only at a width where all destinations
fit. Both presentations MUST preserve the same `/admin?tab=<id>` client-side
navigation contract, active destination, canonical destination order, pending
Reopen count, failed-job count, and an intentional token-driven `focus-visible`
treatment bounded to the active control.

#### Scenario: Tablet Admin navigation uses the compact picker

- **WHEN** an Admin opens `/admin?tab=settings` at 768 CSS px
- **THEN** the compact picker exposes all canonical Admin destinations,
  including Actions and Settings
- **AND** non-zero pending Reopen and failed-job counts remain visibly and
  accessibly discoverable beside the compact navigation
- **AND** the pill strip does not expand the document beyond the viewport
- **AND** the document has zero horizontal overflow

#### Scenario: Wide Admin navigation keeps the pill strip

- **WHEN** an Admin opens `/admin?tab=settings` at 1280 CSS px
- **THEN** the complete pill strip is visible in canonical order with Settings
  marked current
- **AND** keyboard focus on a pill uses the shared focus-ring token and remains
  bounded to that control
- **AND** the document has zero horizontal overflow

#### Scenario: Compact and wide navigation resolve the same destination

- **WHEN** the Admin chooses Products through the compact picker or the wide
  pill strip
- **THEN** both controls navigate client-side to `/admin?tab=products`
- **AND** the Products destination becomes active without a full document
  reload

#### Scenario: Responsive variants preserve operational counts

- **WHEN** one Reopen request is pending and the failed-job queue is non-empty
- **THEN** both the compact and wide Admin navigation surfaces expose the same
  two non-zero counts with accessible descriptions
- **AND** switching responsive presentation does not turn either operational
  signal into hidden information

### Requirement: Settings Secondary Navigation Is Discoverable on Narrow Screens

The Settings surface at `/admin?tab=settings` MUST expose every working
Settings section at 375 CSS px without relying on a visually clipped tab strip
or an undisclosed horizontal gesture. Its narrow control and wide Radix tab
list MUST operate the same active panel, preserve the existing section order,
retain the shared token-driven keyboard focus treatment, and MUST NOT duplicate
the top-level AI destination.

#### Scenario: Mobile Admin reaches every working Settings section

- **WHEN** an Admin opens Settings at 375 CSS px
- **THEN** one compact labelled control exposes Identity, Periods, Reminders,
  and Notifications in documented order
- **AND** AI is absent because it is a top-level Admin destination
- **AND** the clipped horizontal Settings tab strip is not presented

#### Scenario: Selecting a mobile Settings section changes the active panel

- **WHEN** the Admin selects Notifications through the compact Settings control
- **THEN** the Notifications panel becomes active
- **AND** the corresponding desktop tab state remains synchronized in the
  shared tab model
- **AND** no Settings form, query, or save behavior changes

#### Scenario: Desktop Settings retains the existing tab presentation

- **WHEN** an Admin opens Settings at 768 CSS px or wider
- **THEN** the existing line-variant Radix tab list is visible without clipping
- **AND** the compact Settings control is not presented

### Requirement: AI Is a Canonical Top-Level Admin Destination

The Admin route MUST expose AI in its canonical wide and compact navigation at
`/admin?tab=ai`. The destination MUST render the AI Provider and Features
controls directly, preserve their `aiTab` and `aiFeature` deep-link state, and
MUST NOT require or emit a `settingsTab` query parameter.

#### Scenario: Administrator opens AI directly

- **WHEN** an Admin opens `/admin?tab=ai`
- **THEN** the AI destination is marked current in the active Admin navigation
- **AND** Provider and Features remain reachable without first opening Settings

#### Scenario: Responsive navigation resolves the same AI destination

- **WHEN** an Admin chooses AI through the compact picker or the wide pill strip
- **THEN** both controls navigate client-side to `/admin?tab=ai`
- **AND** the AI destination becomes active without a full document reload

#### Scenario: Legacy nested AI address is not retained

- **WHEN** an Admin opens `/admin?tab=settings&settingsTab=ai`
- **THEN** Settings resolves its canonical default section
- **AND** the route does not render AI or redirect to a compatibility alias

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

### Requirement: Mobile Admin operational alerts explain their counts

The compact navigation in `AdminTabsMobileSelect` MUST visibly describe a
nonzero pending Reopen count as "1 pending reopen request" or "N pending
reopen requests". Failed-job alerts MUST likewise state what their number
counts. Each alert MUST retain its existing destination and accessible name
without a detached duplicate count badge. Zero MUST NOT be presented as a
pending alert, and a failed count query MUST remain distinguishable from zero.

#### Scenario: A Reopen request is pending

- **WHEN** the compact Admin navigation has one or more pending Reopen requests
- **THEN** its visible alert states the count and what is pending with correct singular or plural wording
- **AND** activating it uses the existing Reopen destination

#### Scenario: A count is unavailable

- **WHEN** a compact-navigation count query fails
- **THEN** the alert exposes the unavailable state rather than a fabricated zero

### Requirement: Mobile Admin records retain identity and actions

The Users and Periods surfaces at `/admin?tab=users` and `/admin?tab=periods`
MUST keep record identity, role or period state, and existing row actions
reachable at 375 CSS pixels without clipped meaningful text or document-level
horizontal overflow. Names and long email addresses MUST wrap. The Periods
surface MUST expose the week/date range and existing submission progress.
Any remaining internal horizontal overflow MUST have a visible scroll cue.
Desktop tables MAY retain their existing columns. Responsive presentations
MUST reuse existing action behavior and MUST NOT duplicate accessible DOM IDs.

#### Scenario: An Admin reads mobile Users and Periods

- **WHEN** the Admin opens Users or Periods at 375 CSS pixels
- **THEN** each record's identity and state are readable and its available actions remain reachable
- **AND** moving to 1440 CSS pixels preserves the desktop table information

### Requirement: AI secondary tabs fit the mobile Admin surface

Provider and Features tabs at `/admin?tab=ai` MUST show their complete labels
and readiness counts at 375 CSS pixels. Labels and counts MAY stack within
the existing tab control, while the desktop inline presentation MAY remain.
The shared tab state, deep links, and provider testing and activation gates
MUST remain unchanged.

#### Scenario: An Admin reads AI tab readiness on mobile

- **WHEN** the Admin opens AI at 375 CSS pixels
- **THEN** both tab names and readiness counts are visible without clipping
- **AND** selecting either tab keeps the existing active-panel and deep-link behavior
