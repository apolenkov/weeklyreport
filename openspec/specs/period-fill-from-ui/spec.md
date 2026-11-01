# period-fill-from-ui Specification

## Purpose

Keeps the period fill-from dropdown truthful under search: its "Latest submitted" badge is keyed to the real source-period identity rather than filtered array position, and its search state resets on every close path so reopening always starts unfiltered.

## Requirements

### Requirement: The dropdown's "Latest submitted" badge identifies the real most recent submitted period, not filtered position

`FillFromDropdownPanel`'s "Latest submitted" badge and highlight MUST be keyed to
the actual most recent submitted period's identity (`previousPeriodId`, passed down from
`FillFromButton`, which already resolves the real most recent submitted period for its
main fill action), never to array position (`idx === 0`) within the
search-filtered period list. A search query that filters out the true
source MUST NOT cause a different period to be labeled "Latest submitted".

#### Scenario: A search query filters out the most recent submitted period

- **GIVEN** the fill-from dropdown is open and the user types a search
  query that excludes the actual most recent submitted period from the filtered results
- **WHEN** the filtered list renders
- **THEN** no period in the filtered list is labeled "Latest submitted" unless it
  is the actual most recent submitted period
- **AND** the main split-button's fill action still targets the real
  most recent submitted period, unaffected by the search filter

### Requirement: The dropdown's empty state matches why no report is listed

When the dropdown has no submitted past period, its text MUST depend on
whether archived periods are hidden by the archive toggle. If archived periods
exist and are hidden, it MUST read "No submitted reports in open periods. Show
closed (archived) report periods to see more.". Otherwise it MUST read "No
submitted past reports found.". A search with no match MUST read "No reports
match your search.".

#### Scenario: archived periods are hidden

- **WHEN** the lead has archived periods, the archive toggle is off, and no open period is submitted
- **THEN** the dropdown shows the archive hint

#### Scenario: nothing to hide

- **WHEN** the lead has no archived periods, or the toggle is already on, and no period is submitted
- **THEN** the dropdown shows "No submitted past reports found." without the archive hint

### Requirement: The dropdown's search state resets on every close path

`FillFromDropdownPanel`'s `search` state MUST reset whenever the dropdown
closes — via Escape, selecting a period, an outside click, or the trigger
button toggling it closed — so reopening the dropdown always starts
unfiltered, never carrying over the previous session's query.

#### Scenario: Reopening the dropdown after a search-then-close

- **GIVEN** the user searched, then closed the dropdown by any close path
  (Escape, selection, outside click, or the trigger button)
- **WHEN** the user reopens the dropdown
- **THEN** the search field is empty and the full period list is shown
  unfiltered

### Requirement: Fill From confirmation returns focus to its initiating segment

The direct Fill From path MUST return focus to the primary split-button segment
when its confirmation closes. The picker path MUST return focus to the chevron
split-button segment after the selected row is removed and its confirmation
closes. Escape and Cancel MUST have the same return behavior and MUST NOT invoke
the fill mutation. Focus restoration MUST remain inert when the intended segment
is disabled or unmounted before the confirmation closes, without delayed focus
work that can escape the component lifecycle.

#### Scenario: direct confirmation is dismissed

- **WHEN** a keyboard user opens the confirmation from the primary Fill From segment
- **AND** dismisses it with Escape or Cancel
- **THEN** the fill mutation is not requested
- **AND** focus returns to the primary segment

#### Scenario: picker confirmation is dismissed

- **WHEN** a keyboard user opens the picker and selects a source period
- **AND** dismisses the resulting confirmation with Escape or Cancel
- **THEN** the fill mutation is not requested
- **AND** focus returns to the chevron segment that opened the picker

#### Scenario: the return target becomes unavailable

- **WHEN** the initiating split-button segment becomes disabled or unmounts before dismissal
- **THEN** closing the confirmation does not move focus to another Fill From control
- **AND** no delayed focus work runs after the lifecycle change

### Requirement: The dropdown panel stays bounded within the viewport

`FillFromDropdownPanel` MUST remain positioned within viewport bounds and not overflow below the screen on low or zoomed viewports. When viewport height does not provide sufficient clearance below the trigger, the panel MUST clamp its `maxHeight` and/or position above the trigger so that all available controls and list items remain accessible within the viewport.

#### Scenario: Fill From dropdown open on a low-height viewport

- **GIVEN** the Fill From trigger is open on a screen with low viewport height (such as 1280×300 or 1280×200)
- **WHEN** the "Past reports" panel renders
- **THEN** the panel's bottom edge does not extend past the viewport boundary
- **AND** the panel remains scrollable with its contents accessible within viewport boundaries
