## ADDED Requirements

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
