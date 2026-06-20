## MODIFIED Requirements

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
