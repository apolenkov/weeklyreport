## Purpose

Give the Overview a quiet one-line report header and a layout that folds into week tabs on narrow tables.

## ADDED Requirements

### Requirement: Report header is one quiet line

The report header MUST be one quiet line holding the week navigation (the existing PeriodNavigator), the save state and Submit. On a phone the week navigation MAY scroll away while the save state and Submit stay visible. The app bar and unrelated controls are outside this screen's scope and MUST NOT be removed by this change.

#### Scenario: Save state and Submit

- **WHEN** a save is running
- **THEN** the header shows `Saving…`
- **WHEN** a save failed or conflicts
- **THEN** the header shows `Some changes are not saved`
- **WHEN** nothing is pending
- **THEN** the header shows `All changes saved`

#### Scenario: Submit with blockers

- **WHEN** blockers exist
- **THEN** Submit shows `N to fix` and is aria-disabled, and activating it moves focus to the blockers list in `Before you submit`
- **WHEN** no blocker exists
- **THEN** Submit is enabled

#### Scenario: The next-week arrow at the latest week

- **WHEN** the selected week is the latest
- **THEN** the next arrow is aria-disabled and focusable, with `This is the latest week. The next report opens on <date>` as its tooltip and accessible description
- **AND** activating it changes nothing and announces that reason

#### Scenario: Submitted report header

- **WHEN** the report is submitted
- **THEN** the header shows `Submitted` and no Submit control

### Requirement: Narrow tables fold the grid into week tabs

Below 1087 CSS pixels of table width the same grid MUST become tabs Last week, This week and Next week with This week open by default; at 1087 and above it MUST show three equal columns. A tab MUST show only the rows that have a record in its week, in their shared order. Drafts and focus MUST live outside the unmounted cells. At 375 CSS pixels there MUST be no horizontal scroll and every control MUST have a 44 px target.

#### Scenario: The threshold is a table width, not a window width

- **WHEN** the table is 1087 CSS pixels wide
- **THEN** three columns are shown
- **WHEN** the table is 1086 CSS pixels wide
- **THEN** the tabs are shown, also in a window wider than that

#### Scenario: Tabs open on This week and are operable by keyboard

- **WHEN** the tabs appear
- **THEN** This week is selected and the grid is a tab panel only while the tabs are shown
- **AND** arrow keys, Home and End move between tabs and the This week tab shows the number of unanswered plans

#### Scenario: A tab shows only its week

- **WHEN** a tab is selected
- **THEN** only rows with a record in that week appear, and empty cells of other weeks are not drawn as empty cards
- **AND** a unit with nothing in that week shows its entry line when editable and one plain-language line when read-only

#### Scenario: Switching tabs keeps drafts and place

- **WHEN** the lead switches tabs, resizes across 1087 CSS pixels, opens a Sheet or collapses a unit while input is typed
- **THEN** no draft, open editor or reason text is lost
- **AND** the unit and the last chosen work item stay in view when that item exists in the new tab

#### Scenario: The phone layout is contained

- **WHEN** Overview renders at 375 CSS pixels
- **THEN** `scrollWidth` does not exceed `clientWidth`, long text wraps, and every control is at least 44 by 44 CSS pixels with no overlapping targets
