# admin-navigation-responsive Specification

## Purpose

Defines Admin tab and primary navigation, Settings secondary navigation and the responsive access to operational alerts and records on every supported viewport.

## Requirements

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
