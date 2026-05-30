# admin-settings-ui Specification

## Purpose

TBD - created by archiving change fix-admin-holidays-nested-button. Update Purpose after archive.

## Requirements

### Requirement: Coming-Soon Tab Controls MUST NOT Nest Interactive Elements

A coming-soon control rendered as a tab label MUST use a non-interactive element and MUST NOT nest a `<button>` or `<a href>` inside the interactive tab container. This keeps the DOM valid (a Radix `TabsTrigger` already renders a native `<button>`) so React produces no hydration error.

#### Scenario: Admin opens the settings Holidays tab

- **WHEN** an admin navigates to `/admin?tab=settings`
- **THEN** the page renders with zero React console errors
- **AND** the "Holidays" coming-soon tab label contains no `<button>` nested
  inside the `TabsTrigger` button

#### Scenario: Coming-soon control stays inert and discoverable

- **WHEN** the Holidays coming-soon control is displayed
- **THEN** it remains visually inert (not clickable) and keeps its
  `aria-label`, `Coming Soon` tooltip, and `data-testid="holidays-coming-soon"`
