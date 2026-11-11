## MODIFIED Requirements

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose addressable Report and Slides views, defaulting to Report Overview. Report MUST retain canonical document controls and, in each editable This week and Next week cell of an eligible unit, the always-present entry line. Every entry and create path MUST reuse the same canonical handlers, not another persistence path. Removing Edit mode MUST preserve `unified-report-authoring` parity.

#### Scenario: A lead opens a report without a mode

- **WHEN** an authenticated lead opens `/lead/report/:reportId`
- **THEN** Report is selected with the compact Overview projection
- **AND** Slides remains directly reachable without a modal

#### Scenario: A lead opens an explicit edit link

- **WHEN** the route contains `mode=edit`
- **THEN** the route normalizes to the canonical Report URL without writing or duplicating records
- **AND** editable controls, autosave, submit, and completion remain available according to section eligibility

#### Scenario: An editable lead opens the default route

- **WHEN** the lead opens `/lead/report/:reportId` without a mode query
- **THEN** Report retains report identity, autosave, Fill from, Retry after autosave error, Submit, period navigation, visibility, mode controls, and the entry line of each eligible This week and Next week cell
- **AND** all actions use canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates an entry line, detailed edit, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead composer, the detailed Sheet or the dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Overview MUST be compact, expandable, and contained

At table widths of at least 1087 CSS pixels, all reporting units MUST form a flat matrix with shared temporal boundaries, thin row separators, and no nested item card chrome or document-level horizontal overflow. The unit name and the Last week, This week and Next week columns MUST align across units. A collapsed unit MUST show at most two item previews per column and an operable count for hidden items. Disclosure controls MUST expose `aria-expanded` and `aria-controls`.

#### Scenario: A column contains more than two items

- **WHEN** Overview renders a collapsed temporal column with five source items
- **THEN** two previews and an operable `+3 more` control are visible
- **AND** activating that control reveals all five items inline exactly once

#### Scenario: Overview renders at desktop width

- **WHEN** Overview renders at 1280 by 900 or 1728 by 962
- **THEN** the visible time columns align across reporting units
- **AND** document `scrollWidth` does not exceed `clientWidth`

#### Scenario: Desktop rows contain different amounts of text

- **WHEN** Overview renders at 1280x900 or 1728x962
- **THEN** all column boundaries align across every reporting unit
- **AND** the unit name and the first line of each This week and Last week cell in a unit row start within 2 CSS pixels of each other
- **AND** a Next week cell MAY start lower when its records sit on lineage rows of Last week
- **AND** the document has no horizontal overflow

#### Scenario: An editable unplanned item wraps

- **WHEN** a This week record that is not linked to a plan has a multi-line description
- **THEN** its stage text stays muted right after the description and wraps with it as one group
- **AND** the description, that group and the actions column remain readable without overlap

#### Scenario: item text owns the flexible region

- **WHEN** an item's description or stage text grows over several lines
- **THEN** the text wraps before the fixed actions column and no action overlaps text
- **AND** the document has no horizontal overflow at any supported width

#### Scenario: collapsed content is not focusable

- **WHEN** a unit is collapsed
- **THEN** its hidden items are not keyboard-focusable, and its disclosure control exposes `aria-expanded` and `aria-controls`
- **AND** activating the count expands the full content inline

#### Scenario: narrow tables use tabs

- **WHEN** the table is narrower than 1087 CSS pixels
- **THEN** the columns are reachable as Last week, This week and Next week tabs with This week open by default
- **AND** every tab and control keeps a 44 px target on a coarse pointer

### Requirement: Empty temporal cells MUST state their emptiness in plain language

An editable This week or Next week cell with no record MUST show only its entry line, placed after the cell's last row. An empty read-only cell, including Last week, MUST expose no write control and MUST state its emptiness in plain language: `No update last week.` or `No update this week.` when the report exists but is empty, `Nothing planned.` for an empty Next week, and `Last week's report isn't available.` when the previous report is unavailable.

#### Scenario: A temporal cell has no content

- **WHEN** an editable This week or Next week cell has no record
- **THEN** it shows the entry line for that unit and week and no other control
- **WHEN** a Last week cell or a read-only cell has no record
- **THEN** it states the matching plain-language line
- **AND** historical and read-only views expose no write controls

#### Scenario: Empty periods are compacted on mobile

- **WHEN** the selected tab of a mobile reporting unit has no record
- **THEN** an editable unit shows only its entry line and a read-only unit shows one plain-language line
- **AND** empty periods do not repeat dates

## REMOVED Requirements

### Requirement: Overview previews MUST preserve reading and secondary-action access

**Reason**: The More actions disclosure and the hover row conflict with mockup v2.4, which shows the actions as a fixed, always visible column.
**Migration**: Use "Overview previews keep reading and fixed record actions" below.

## ADDED Requirements

### Requirement: Overview previews keep reading and fixed record actions

Editable This week and Next week records MUST keep their readable text, a text control that opens in-place quick edit, a detailed-edit control, a status control (This week only), and week-move and discussion controls, all in one fixed actions column that is always visible. No More actions disclosure MAY exist. Read-only records MUST expose no write action. Move MUST follow the placement-or-acknowledgement contract in `record-status-derivation`.

#### Scenario: the lead reads a long record

- **WHEN** a long This week record is shown
- **THEN** its full text wraps and remains readable
- **AND** its text control is named `Edit text: <text>` and its status control is named `Status: <label>. Change status of <text>`

#### Scenario: the pencil opens the detailed Sheet

- **WHEN** the lead activates the pencil of an editable record
- **THEN** the detailed form opens as a modal Sheet named `Edit details: <text>` and the page below becomes inert

#### Scenario: secondary actions are fixed

- **WHEN** a record is shown
- **THEN** the pencil, the week-move icon and the discussion icon are separate named buttons in one fixed column
- **AND** no More actions disclosure exists

#### Scenario: a Current occurrence is postponed to Next

- **WHEN** the lead moves an eligible This week record without a separate next commitment
- **THEN** the occurrence moves to Next week through the placement-only move contract, not the separate Continue next week verdict

#### Scenario: Move carries a saved next step with its record

- **WHEN** the lead moves an eligible This week record that carries a saved next step
- **THEN** the record moves with its next step, which shows as a derived `Next step` row under it in Next week
- **AND** the existing continuation-promotion command is not called

#### Scenario: Read-only and locked records expose no write action

- **WHEN** a Last week record is shown
- **THEN** it exposes no action
- **WHEN** a submitted, lost or foreign record is shown
- **THEN** its actions stay in place as aria-disabled controls with their reason

### Requirement: Last week shows how the previous week went

The Last week column MUST show the previous report's published records with their published statuses, read-only. It MUST NOT change after any action on this screen. Its header subtitle MUST read `How it went · read-only`, This week's MUST read `Progress`, and Next week's MUST read `Plan`.

#### Scenario: Answers do not change Last week

- **WHEN** the lead answers, moves, edits or undoes a This week or Next week record
- **THEN** the Last week column renders exactly as before the action

#### Scenario: A published status is shown as published

- **WHEN** a Last week record was published with status In progress
- **THEN** it shows In progress with no status control

#### Scenario: The previous report is unavailable

- **WHEN** the previous report is not available
- **THEN** Last week reads `Last week's report isn't available.` and This week shows no plan question for it

### Requirement: Next week records have no status

Next week records MUST be plans without a status: no status icon, no status menu, and no Status field in their detailed form. Their detailed form MUST keep the Next step field. Moving a record into Next week MUST hide its status, and moving it back MUST show the status again.

#### Scenario: A Next week record is shown

- **WHEN** a Next week record is shown
- **THEN** it shows a neutral marker and no status control
- **AND** its detailed form has a Next step field and no Status field

#### Scenario: Moving back shows the status

- **WHEN** a record moves from Next week back to This week
- **THEN** its status is shown again

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
- **AND** activating it, or pressing Alt+Right on it, announces that reason and changes nothing

#### Scenario: Submitted report header

- **WHEN** the report is submitted
- **THEN** the header shows `Submitted` and no Submit control
