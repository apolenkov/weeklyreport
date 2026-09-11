# period-fill-from-ui Specification

## Purpose

Keeps the period fill-from dropdown truthful under search: its "Previous" badge is keyed to the real previous-period identity rather than filtered array position, and its search state resets on every close path so reopening always starts unfiltered.

## Requirements

### Requirement: The dropdown's "Previous" badge identifies the real previous period, not filtered position

`FillFromDropdownPanel`'s "Previous" badge and highlight MUST be keyed to
the actual previous period's identity (`previousPeriodId`, passed down from
`FillFromButton`, which already resolves the real previous period for its
main fill action), never to array position (`idx === 0`) within the
search-filtered period list. A search query that filters out the true
previous period MUST NOT cause a different period to be labeled "Previous".

#### Scenario: A search query filters out the true previous period

- **GIVEN** the fill-from dropdown is open and the user types a search
  query that excludes the actual previous period from the filtered results
- **WHEN** the filtered list renders
- **THEN** no period in the filtered list is labeled "Previous" unless it
  is the actual previous period
- **AND** the main split-button's fill action still targets the real
  previous period, unaffected by the search filter

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
