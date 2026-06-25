# admin-settings-ui Specification

## Purpose

TBD - created by archiving change fix-admin-holidays-nested-button. Update Purpose after archive.

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

All Settings sub-tab triggers MUST render in the same visual style as one
another, including any Coming-Soon sub-tab. A deferred sub-tab MUST signal its
Coming-Soon state through its tooltip and its assistive-tech accessible name, NOT
through a divergent trigger shape (an outlined pill, a fixed-width chip, or a
leading icon the working tabs do not have).

#### Scenario: Holidays trigger matches its siblings

- **WHEN** an admin views the Settings sub-tab strip at `/admin?tab=settings`
- **THEN** the "Holidays" trigger uses the same `line`-variant underline style as
  the Identity / Periods / Reminders / Notifications / Integrations triggers, with
  no outlined pill and no fixed-width Calendar chip
- **AND** the nested Coming-Soon label inside the trigger stays inert (the
  `aria-disabled` span is not itself clickable), while the surrounding
  `TabsTrigger` remains selectable like its siblings (selecting it shows the
  Holidays Coming-Soon panel) — unchanged from today
- **AND** the trigger keeps its Coming-Soon tooltip on hover, its
  `data-testid="holidays-coming-soon"`, and surfaces its Coming-Soon state
  through the trigger's computed accessible name (a descendant visually-hidden
  `ComingSoonBadge`), never via an `aria-label` on the inert span
- **AND** the page renders with zero React console errors (no nested interactive
  element, per the existing requirement)

### Requirement: Integrations Sub-Tab Surfaces Only Roadmapped Integrations

The Integrations sub-tab MUST list only integrations that are real or
roadmapped, and MUST NOT render a card for an integration that has been dropped
from the roadmap. Every listed integration that is not yet activated MUST use the
shared Coming-Soon affordance.

#### Scenario: Slack and CI cards are absent

- **WHEN** an admin opens the Integrations sub-tab
- **THEN** no "Slack" card and no "CI Integration" card are rendered
- **AND** the `admin.integrationsStatus` payload contains no `ci` field

#### Scenario: Telegram and AI cards are present as Coming-Soon

- **WHEN** an admin opens the Integrations sub-tab
- **THEN** a "Telegram" card is rendered with its configured / active-bindings
  status and a Coming-Soon badge
- **AND** an "AI" card is rendered describing a provider/model selection applied
  to all AI features (summary, risk extraction, RAG) and carries a Coming-Soon
  badge

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
