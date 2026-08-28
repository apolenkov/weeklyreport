## ADDED Requirements

### Requirement: Admin Primary Navigation Fits Every Supported Viewport

The Admin route at `/admin` MUST expose every canonical Admin destination without document-level horizontal overflow. At narrow and tablet widths where the complete pill strip does not fit, the route MUST use the compact Admin picker; the full pill strip MUST appear only at a width where all destinations fit. Both presentations MUST preserve the same `/admin?tab=<id>` client-side navigation contract, active destination, canonical destination order, pending Reopen count, failed-job count, and an intentional token-driven `focus-visible` treatment bounded to the active control.

#### Scenario: Tablet Admin navigation uses the compact picker

- **WHEN** an Admin opens `/admin?tab=settings` at 768 CSS px
- **THEN** the compact picker exposes all canonical Admin destinations, including Actions and Settings
- **AND** non-zero pending Reopen and failed-job counts remain visibly and accessibly discoverable beside the compact navigation
- **AND** the pill strip does not expand the document beyond the viewport
- **AND** the document has zero horizontal overflow

#### Scenario: Wide Admin navigation keeps the pill strip

- **WHEN** an Admin opens `/admin?tab=settings` at 1280 CSS px
- **THEN** the complete pill strip is visible in canonical order with Settings marked current
- **AND** keyboard focus on a pill uses the shared focus-ring token and remains bounded to that control
- **AND** the document has zero horizontal overflow

#### Scenario: Compact and wide navigation resolve the same destination

- **WHEN** the Admin chooses Products through the compact picker or the wide pill strip
- **THEN** both controls navigate client-side to `/admin?tab=products`
- **AND** the Products destination becomes active without a full document reload

#### Scenario: Responsive variants preserve operational counts

- **WHEN** one Reopen request is pending and the failed-job queue is non-empty
- **THEN** both the compact and wide Admin navigation surfaces expose the same two non-zero counts with accessible descriptions
- **AND** switching responsive presentation does not turn either operational signal into hidden information

### Requirement: Settings Secondary Navigation Is Discoverable on Narrow Screens

The Settings surface at `/admin?tab=settings` MUST expose every working Settings section at 375 CSS px without relying on a visually clipped tab strip or an undisclosed horizontal gesture. Its narrow control and wide Radix tab list MUST operate the same active panel, preserve the existing section order, keep Holidays visibly deferred and inert, and retain the shared token-driven keyboard focus treatment.

#### Scenario: Mobile Admin reaches every working Settings section

- **WHEN** an Admin opens Settings at 375 CSS px
- **THEN** one compact labelled control exposes Identity, Periods, Reminders, Notifications, and Integrations in documented order
- **AND** Holidays remains visible as an inert row carrying the canonical Coming-Soon badge rather than disappearing from the surface or pretending to be selectable
- **AND** the clipped horizontal Settings tab strip is not presented

#### Scenario: Selecting a mobile Settings section changes the active panel

- **WHEN** the Admin selects Notifications through the compact Settings control
- **THEN** the Notifications panel becomes active
- **AND** the corresponding desktop tab state remains synchronized in the shared tab model
- **AND** no Settings form, query, or save behavior changes

#### Scenario: Desktop Settings retains the existing tab presentation

- **WHEN** an Admin opens Settings at 768 CSS px or wider
- **THEN** the existing line-variant Radix tab list is visible without clipping
- **AND** the compact Settings control is not presented

## MODIFIED Requirements

### Requirement: Settings Sub-Tab Triggers Share One Visual Style

All Settings sub-tab triggers in the wide presentation MUST render in the same visual style as one another, including any Coming-Soon sub-tab. A deferred sub-tab MUST signal its Coming-Soon state through its tooltip and assistive-tech accessible name, NOT through a divergent trigger shape. In the compact presentation, the working-section picker MUST exclude Holidays and an adjacent inert Holidays row MUST carry the canonical `ComingSoonBadge`. Neither presentation makes Holidays selectable until its panel is implemented.

#### Scenario: Holidays trigger matches its siblings

- **WHEN** an Admin views the Settings sub-tab strip at `/admin?tab=settings` at 768 CSS px or wider
- **THEN** the Holidays trigger uses the same `line`-variant underline style as the Identity, Periods, Reminders, Notifications, and Integrations triggers, with no outlined pill and no fixed-width Calendar chip
- **AND** the surrounding `TabsTrigger` carries `aria-disabled="true"`, remains focusable and hoverable for tooltip discovery, and cannot select a nonexistent Holidays panel through focus, pointer, or keyboard activation
- **AND** the nested Coming-Soon label keeps its shared Radix tooltip on hover, `data-testid="holidays-coming-soon"`, and computed accessible name from the descendant visually-hidden `ComingSoonBadge`
- **AND** the page renders with zero React console errors and no nested interactive element

#### Scenario: Compact Holidays trace stays visible and inert

- **WHEN** an Admin views Settings below 768 CSS px
- **THEN** the working-section picker excludes Holidays because no Holidays panel exists
- **AND** an adjacent inert Holidays row remains visible with the canonical `ComingSoonBadge` and `aria-disabled="true"`
- **AND** the row cannot become the active Settings section
- **AND** the hidden wide trigger is not treated as the mobile deferred-state affordance
