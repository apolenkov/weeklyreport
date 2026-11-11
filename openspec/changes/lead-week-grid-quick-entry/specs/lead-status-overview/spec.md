## MODIFIED Requirements

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose addressable Report and Slides views, defaulting to Report Overview. Report MUST retain canonical document/context controls and contextual Add controls in each editable This week and Next week cell of an eligible unit. Every contextual create control MUST reuse the same canonical handlers, not another persistence path. Removing Edit mode MUST preserve `unified-report-authoring` parity.

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
- **THEN** Report retains report identity, autosave, Fill from, Retry after autosave error, Submit, period navigation, visibility, mode controls, and the contextual cell Add controls of eligible units
- **AND** all actions use canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates contextual creation, detailed edit, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead composer or dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Overview MUST be compact, expandable, and contained

At desktop widths of at least 80 rem, all reporting units MUST form a flat matrix with shared temporal boundaries, thin row separators, and no nested item card chrome or document-level horizontal overflow. The identity column and the Last week, This week and Next week columns MUST align across units. A collapsed unit MUST show at most two item previews per column and an operable count for hidden items. Disclosure controls MUST expose `aria-expanded` and `aria-controls`.

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
- **AND** the first lines of cells in a unit row start at the same vertical position
- **AND** the document has no horizontal overflow

#### Scenario: An editable unplanned item wraps

- **WHEN** an unplanned Current item has a multi-line description
- **THEN** the `Unplanned` marker stays in the muted metadata group right after the description, wrapping with the stage and "from plan" text
- **AND** the description, that group, and the actions remain readable without overlap

#### Scenario: item text owns the flexible region

- **WHEN** an item's description or stage text grows over several lines
- **THEN** the text wraps, hover or focus actions float over the item's corner without changing the text width, and on touch they sit in the free space of the last text line
- **AND** no actions column is added and the document has no horizontal overflow

#### Scenario: collapsed content is not focusable

- **WHEN** a unit is collapsed
- **THEN** its hidden items are not keyboard-focusable, and its disclosure control exposes `aria-expanded` and `aria-controls`
- **AND** activating the count expands the full content inline

#### Scenario: narrow tables use tabs

- **WHEN** the table is narrower than 920 CSS pixels
- **THEN** the columns are reachable as Last week, This week and Next week tabs with This week open by default
- **AND** every tab and control keeps a touch-size target

### Requirement: Empty temporal cells MUST state their emptiness in plain language

An empty editable This week or Next week cell MUST show only its quiet contextual Add control ("Add what happened" or "Plan something"), placed after the cell's last row. An empty read-only cell, including Last week, MUST state its emptiness in plain language, distinguishing "Nothing was planned" from an unavailable previous report, and MUST expose no write controls.

#### Scenario: A temporal cell has no content

- **WHEN** an editable This week or Next week cell has no item
- **THEN** it shows the contextual Add control for that unit and week and no other control
- **WHEN** a Last week cell or a read-only cell has no item
- **THEN** it states in plain language that nothing was planned, or that the previous report is unavailable
- **AND** historical and read-only views expose no write controls

#### Scenario: Empty periods are compacted on mobile

- **WHEN** the selected week tab of a mobile reporting unit has no item
- **THEN** an editable unit shows only its contextual Add control and a read-only unit shows one plain-language line
- **AND** empty periods do not repeat dates

## REMOVED Requirements

### Requirement: Overview previews MUST preserve reading and secondary-action access

**Reason**: The single More actions disclosure conflicts with the flat hover/focus action row of `lead-status-overview-actions` and the mockup v2.2 layout.
**Migration**: Use "Overview previews keep reading and flat secondary actions" below.

## ADDED Requirements

### Requirement: Overview previews keep reading and flat secondary actions

Editable Current/Next previews MUST keep readable copy, a separate complete-editor action, a status interaction, and their secondary actions (Edit, Move, Discussion) as the flat icon row of `lead-status-overview-actions`, without a More actions disclosure. Read-only previews MUST expose no write action. Move MUST follow the placement-or-acknowledgement contract in `record-status-derivation`.

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its full-text disclosure remains operable and its copy remains readable
- **AND** its status icon is named `Status of <update text>: <status>`
- **AND** the Edit icon opens the canonical editor named `Edit item: <update text>`

#### Scenario: secondary actions are flat

- **WHEN** Edit, Move or Discussion is shown for an editable item, including one that is currently unavailable
- **THEN** each is a separate named icon button in the item's action row
- **AND** no More actions disclosure exists

#### Scenario: an unavailable secondary action stays in place

- **WHEN** Edit, Move or Discussion cannot be used for an editable item
- **THEN** the icon stays in the row, aria-disabled and focusable, and its reason is its tooltip and accessible description
- **AND** activating it changes nothing and shows the reason

#### Scenario: a Current occurrence is postponed to Next

- **WHEN** the lead selects the week move for an eligible Current item without a separate next commitment
- **THEN** the occurrence moves to Next through the placement-only move contract, not the separate Continue next week verdict

#### Scenario: Move keeps a saved next step and never promotes

- **WHEN** the lead selects the week move for an eligible Current item that already carries a saved next step
- **THEN** the item stays Current with its description and the saved next step, and the Next lane keeps projecting that plan
- **AND** the acknowledgement rides the ordinary draft save, the continuation-promotion command is not called, and focus returns to the week-move control
