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
- **WHEN** nothing is pending and no draft exists
- **THEN** the header shows `All changes saved`

#### Scenario: Drafts are reported as unsaved, never as saved

- **WHEN** the report holds one or more drafts, such as an editing popover with changes, an entry line with text, a typed reason or a risk or decision draft, and no save is running or failed
- **THEN** the header shows a neutral `1 unsaved change` or `N unsaved changes`, and never `All changes saved`
- **AND** N is the number of unsaved lines in `Before you submit`, because the header and Submit read the same source
- **AND** a failed or conflicting save shows `Some changes are not saved` and a running save shows `Saving…`, each before the unsaved count

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

### Requirement: The editing popover becomes a bottom Sheet on narrow screens and touch

At 760 CSS pixels or narrower, or on a coarse pointer, the content of the editing popover MUST open as a modal bottom Sheet: the page below is inert, Tab cycles inside it and every target is 44 px. There MUST be no hover cue there. On a fine pointer wider than 760 px it stays the non-modal popover, also in the tabs layout. Content, order, save rules and focus return are the same in both.

#### Scenario: A narrow screen opens a bottom Sheet

- **WHEN** the lead activates a record’s text at 760 CSS pixels or narrower
- **THEN** the same content opens as a modal bottom Sheet, the page below is inert and every target is at least 44 by 44 CSS pixels
- **AND** no hover cue is shown on that screen

#### Scenario: A coarse pointer opens a bottom Sheet at any width

- **WHEN** the lead taps a record’s text on a coarse pointer in a window wider than 760 px
- **THEN** the modal bottom Sheet opens and the non-modal popover does not

#### Scenario: A fine pointer keeps the popover in the tabs layout

- **WHEN** a fine-pointer user activates a record’s text while the table is narrower than 1087 CSS pixels but the window is wider than 760
- **THEN** the non-modal popover opens under the record, not a Sheet

#### Scenario: The Sheet keeps the same save and focus rules

- **WHEN** the lead taps the overlay or Escape, or activates Cancel, in the Sheet
- **THEN** with no changes the Sheet closes; with changes a tap on the overlay does not save or close it, and Escape or Cancel asks `Discard changes?`
- **AND** after Save, Cancel or Escape focus returns to the record’s text button, and Tab cycles inside the Sheet while it is open

#### Scenario: Resizing across 760 pixels keeps the draft

- **WHEN** the window or pointer changes across the threshold while an editor holds changes
- **THEN** the same draft continues in the other surface with its text, stages and Next step intact and the record still shows `Not saved`

### Requirement: A submitted report is read-only and says so once

A submitted report MUST be read-only: no entry line, no `+ Risk or decision`, no edit controls, no editing popover and no hover cue. A record's text MUST open a read-only popover with only the text, `Discussion (N)` and Close. One banner above the table MUST state `This report is read-only.` once, and no other element repeats it. This keeps the rule that ineligible sections offer no write controls.

#### Scenario: A submitted report offers no write control

- **WHEN** the report is submitted
- **THEN** no entry line, `+ Risk or decision`, status control, stage toggle, editing popover or hover cue is rendered

#### Scenario: A record of a submitted report opens a read-only popover

- **WHEN** the lead activates a record's text in a submitted report
- **THEN** a popover shows the read-only text, `Discussion (N)` and Close, with no Move, More details, Delete, stage control or Save
- **AND** Discussion opens the record's `Discussion` Sheet even when it has no comments yet
- **AND** each unit still shows its counts and the list of its risks and decisions, as `lead-contextual-quick-entry` states

#### Scenario: The banner says it once

- **WHEN** the report is submitted
- **THEN** one banner above the table states `This report is read-only.`, and the line `Click text to edit. Use status to answer a plan.` is not shown
- **AND** no other element, such as a tooltip or a per-unit note, repeats that statement

#### Scenario: A record with comments keeps its discussion

- **WHEN** a record of a submitted report has comments
- **THEN** its discussion icon with the count still opens the `Discussion` Sheet under the rules of `lead-item-comment-access`
