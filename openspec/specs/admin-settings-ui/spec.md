# admin-settings-ui Specification

## Purpose

Define the Admin Settings sub-tab navigation, live policy fields, deferred integration affordances, and form-state/error behavior.

## Requirements

### Requirement: Coming-Soon Tab Controls MUST NOT Nest Interactive Elements

A coming-soon control rendered as a tab label MUST use a non-interactive element and MUST NOT nest a `<button>` or `<a href>` inside the interactive tab container. This keeps the DOM valid (a Radix `TabsTrigger` already renders a native `<button>`) so React produces no hydration error. When the control's Coming-Soon tooltip is provided by the shared Radix tooltip, wrapping the inert `<span>` in a Radix `TooltipTrigger asChild` MUST merge props onto the existing span WITHOUT introducing a nested interactive element.

#### Scenario: Admin opens the settings Holidays tab

- **WHEN** an admin navigates to `/admin?tab=settings`
- **THEN** the page renders with zero React console errors
- **AND** the "Holidays" coming-soon tab label contains no `<button>` nested
  inside the `TabsTrigger` button

#### Scenario: Coming-soon control stays inert and discoverable

- **WHEN** the Holidays coming-soon control is displayed
- **THEN** it remains visually inert (not clickable), shows its Coming-Soon
  tooltip via the shared Radix tooltip on hover, and keeps its
  `data-testid="holidays-coming-soon"`
- **AND** its coming-soon state reaches assistive technology through the holidays
  tab's computed accessible name (the descendant `ComingSoonBadge` text), not via
  an `aria-label` on the inert span

### Requirement: Settings Sub-Tab Triggers Share One Visual Style

All Settings sub-tab triggers in the wide presentation MUST render in the same
visual style as one another, including any Coming-Soon sub-tab. A deferred
sub-tab MUST signal its Coming-Soon state through its tooltip and
assistive-tech accessible name, NOT through a divergent trigger shape. In the
compact presentation, the working-section picker MUST exclude Holidays and an
adjacent inert Holidays row MUST carry the canonical `ComingSoonBadge`. Neither
presentation makes Holidays selectable until its panel is implemented.

#### Scenario: Holidays trigger matches its siblings

- **WHEN** an admin views the Settings sub-tab strip at
  `/admin?tab=settings` at 768 CSS px or wider
- **THEN** the Holidays trigger uses the same `line`-variant underline style as
  the Identity, Periods, Reminders, Notifications, and Integrations triggers,
  with no outlined pill and no fixed-width Calendar chip
- **AND** the surrounding `TabsTrigger` carries `aria-disabled="true"`, remains
  focusable and hoverable for tooltip discovery, and cannot select a
  nonexistent Holidays panel through focus, pointer, or keyboard activation
- **AND** the nested Coming-Soon label keeps its shared Radix tooltip on hover,
  `data-testid="holidays-coming-soon"`, and computed accessible name from the
  descendant visually-hidden `ComingSoonBadge`
- **AND** the page renders with zero React console errors and no nested
  interactive element

#### Scenario: Compact Holidays trace stays visible and inert

- **WHEN** an admin views Settings below 768 CSS px
- **THEN** the working-section picker excludes Holidays because no Holidays
  panel exists
- **AND** an adjacent inert Holidays row remains visible with the canonical
  `ComingSoonBadge` and `aria-disabled="true"`
- **AND** the row cannot become the active Settings section
- **AND** the hidden wide trigger is not treated as the mobile deferred-state
  affordance

### Requirement: Integrations Sub-Tab Surfaces Only Roadmapped Integrations

The Integrations sub-tab MUST list only integrations that are real or
roadmapped, and MUST NOT render a card for an integration that has been dropped
from the roadmap. Every listed integration that is not yet activated MUST use the
shared Coming-Soon affordance. The messaging-integration card MUST display the
planned channel name **Element**; the displayed name is decoupled from the
not-yet-built transport, so the Element card MUST NOT render any Telegram-derived
live status (the `admin.integrationsStatus` Telegram fields describe the internal
Telegram transport and MUST NOT surface under the Element name). The Element card
is heading + description + Coming-Soon badge; it asserts no messaging status.

#### Scenario: Slack and CI cards are absent

- **WHEN** an admin opens the Integrations sub-tab
- **THEN** no "Slack" card and no "CI Integration" card are rendered
- **AND** the `admin.integrationsStatus` payload contains no `ci` field

#### Scenario: Element and AI cards are present as Coming-Soon

- **WHEN** an admin opens the Integrations sub-tab
- **THEN** a card headed "Element" is rendered (not "Telegram") with a
  description and a Coming-Soon badge
- **AND** an "AI" card is rendered describing a provider/model selection applied
  to all AI features (summary, risk extraction, RAG) and carries a Coming-Soon
  badge

#### Scenario: the Element card renders no Telegram-derived status

- **WHEN** an admin opens the Integrations sub-tab and the Telegram transport is
  configured with active bindings (`admin.integrationsStatus` reports
  configured/bindings)
- **THEN** the "Element" card does NOT show those Telegram-derived "configured" /
  "active bindings" values — it renders no live messaging status under the
  Element name
- **AND** the card asserts no active/working messaging status (heading +
  description + Coming-Soon badge only)

### Requirement: Period Policy Form Exposes Only Live Fields, Described Honestly

The Settings → Periods form MUST expose only period-policy fields that have a
live consumer, and each field's help text MUST describe the field's actual
current behavior rather than claiming it is deferred when its consumer already
ships.

#### Scenario: Consumer-less fields are removed end-to-end

- **WHEN** the four consumer-less fields (`firstDayOfWeek`, `deadlineDayOfWeek`,
  `maxOpenPeriods`, `requireAllSectionsToPublish`) are removed
- **THEN** they are absent from the Settings → Periods form, from the
  `admin.updateSettings` input payload, AND from the `admin.getSettings` read
  payload
- **AND** they are absent from the shared period-settings schema/type and from
  the `AppSettings` Prisma model, with the init migration and both Prisma seed
  programs kept in sync so `prisma migrate reset` + seed succeeds

#### Scenario: Each working field's copy matches its real behavior

- **WHEN** an admin reads the Settings → Periods form
- **THEN** no help string or banner claims a working field is deferred,
  persisted-only, or "ships in Phase 51-C"
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
  - `deadlineTime` — manual-creation default applied at whole-hour precision
    (minutes ignored); scheduled auto-creation currently uses a fixed 18:00
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
(`apps/web/src/features/admin/ui/products-tab.tsx`), whose effect currently
re-runs on any new `products` reference (e.g. from a same-tab product
mutation invalidating `admin.snapshot`). The effect MUST distinguish a
genuine new deep-link target (`productFilter` changing) from a data-only
refetch, and only the former re-triggers auto-expand once the user has
manually toggled the panel.

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
keep Holidays visibly deferred and inert, and retain the shared token-driven
keyboard focus treatment.

#### Scenario: Mobile Admin reaches every working Settings section

- **WHEN** an Admin opens Settings at 375 CSS px
- **THEN** one compact labelled control exposes Identity, Periods, Reminders,
  Notifications, and Integrations in documented order
- **AND** Holidays remains visible as an inert row carrying the canonical
  Coming-Soon badge rather than disappearing from the surface or pretending to
  be selectable
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
