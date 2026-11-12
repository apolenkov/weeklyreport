## MODIFIED Requirements

### Requirement: Overview MUST group and identify reporting units clearly

Products and Project Activities MUST remain peer reporting-unit types in stable Product-first order, with explicit group boundaries and counts. Each unit MUST show its complete name in a header above its three week columns; a status badge or metadata MUST NOT force the only name label into a single-line ellipsis. Grouping MUST NOT duplicate Activity rows beneath linked Products.

#### Scenario: Long Product and Activity names are rendered

- **WHEN** a reporting-unit name exceeds the single-line width of its header
- **THEN** the complete name remains visually readable through wrapping
- **AND** the unit's risk and decision controls remain associated with the same unit
- **AND** the document has no horizontal overflow

#### Scenario: Both reporting-unit types are present

- **WHEN** Overview contains Products and Project Activities
- **THEN** each type appears under one explicit labelled group with its real count
- **AND** every reporting unit appears exactly once in canonical order

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose addressable Report and Slides views, defaulting to Report Overview. Report MUST retain canonical document controls and, in each editable unit, the quiet entry lines of This week and Next week. Every entry and create path MUST reuse the same canonical handlers, not another persistence path. Removing Edit mode MUST preserve `unified-report-authoring` parity.

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
- **THEN** Report retains report identity, autosave, Fill from, Retry after autosave error, Submit, period navigation, visibility, mode controls, and the entry line of each eligible unit and week
- **AND** all actions use canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates an entry line, More details, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead composer, the detailed Sheet or the dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Temporal columns MUST use authoritative period sources

Every reporting unit MUST expose Last week, This week and Next week. Last week MUST show the predecessor’s results with the statuses it published. The predecessor’s commitments MUST be a separate projection that feeds the plan line in This week and MUST NOT replace a Last week result. A valid immutable published snapshot is authoritative; a submitted live section MAY be used when none exists. Each column MUST show its period range or an explicit unavailable state.

#### Scenario: The predecessor is published

- **WHEN** the immediate prior period has a valid published snapshot containing the lead's section
- **THEN** Last week renders that frozen section's results with their published statuses
- **AND** its next-period commitments reach This week only as prior commitments
- **AND** later live-table changes cannot alter either projection

#### Scenario: A current result has an independent next commitment

- **WHEN** a selected This week item contains both a reported result and nonblank `nextStepText`
- **THEN** This week shows the result and Next week shows the separate commitment as a derived `Next step` line of the same row
- **AND** both projections retain the same stable lineage and one editable occurrence
- **AND** in the successor report Last week shows the result text and the prior commitment uses the commitment text, so neither replaces the other

#### Scenario: Only a predecessor draft exists

- **WHEN** the immediate prior period has no published snapshot and the lead's section is draft
- **THEN** Last week shows `Last week’s report isn’t available.` and This week shows no plan question for it
- **AND** no draft item is represented as an agreed plan

#### Scenario: Current work was not in the prior plan

- **WHEN** a This week record has no prior commitment or Last week result of the same stableId
- **THEN** it appears exactly once on its own row with an empty Last week cell
- **AND** no badge or marker distinguishes it from planned work

### Requirement: Overview MUST be compact, expandable, and contained

At table widths of at least 1087 CSS pixels, each reporting unit MUST show its header above three equal columns, Last week, This week and Next week, with shared boundaries across units, thin row separators, no left rail, no nested card chrome and no document-level horizontal overflow. A collapsed unit MUST show at most two work rows and an operable count for hidden rows. Disclosure controls MUST expose `aria-expanded` and `aria-controls`.

#### Scenario: A column contains more than two items

- **WHEN** Overview renders a collapsed unit with five work rows
- **THEN** two rows and an operable `+3 more` control are visible
- **AND** activating that control reveals all five rows inline exactly once

#### Scenario: Overview renders at desktop width

- **WHEN** Overview renders at 1280 by 900 or 1728 by 962
- **THEN** the three week columns have equal widths and their boundaries align across reporting units
- **AND** document `scrollWidth` does not exceed `clientWidth`

#### Scenario: Desktop rows contain different amounts of text

- **WHEN** Overview renders at 1280x900 or 1728x962
- **THEN** the first text line of each cell of one row starts within 2 CSS pixels of the others
- **AND** a cell whose week holds no record of that work shows `—` instead of shifting its neighbours
- **AND** the document has no horizontal overflow

#### Scenario: A short record keeps a calm height

- **WHEN** a short record with its stage icons is shown on desktop
- **THEN** its row is at least 48 CSS pixels and at most 64 CSS pixels high
- **AND** long text and an open editor grow the row freely

#### Scenario: An editable unplanned item wraps

- **WHEN** a This week record has a multi-line description
- **THEN** its stage icons stay right after the description and wrap with it as one group
- **AND** the description, its status control and any discussion count remain readable without overlap

#### Scenario: item text owns the flexible region

- **WHEN** an item's description grows over several lines, with its stage icons following it
- **THEN** the text wraps and no control overlaps it
- **AND** the document has no horizontal overflow at any supported width

#### Scenario: collapsed content is not focusable

- **WHEN** a unit is collapsed
- **THEN** its hidden rows are not keyboard-focusable, and its disclosure control exposes `aria-expanded` and `aria-controls`
- **AND** activating the count expands the full content inline

### Requirement: Empty temporal cells MUST state their emptiness in plain language

An empty cell in a work-item row MUST show a quiet `—` with the accessible name `No entry in <week>` and no fill, card frame or add button. A unit with no record in a week MUST state its emptiness in plain language: `No update last week.`, `No update this week.` or `Nothing planned.`; an unavailable previous report MUST read `Last week’s report isn’t available.`, never an empty column. Read-only cells MUST expose no write control.

#### Scenario: A temporal cell has no content

- **WHEN** an editable unit has no record in its This week or Next week column
- **THEN** that column shows the unit's entry line and no other control
- **WHEN** a Last week column or a read-only unit has no record
- **THEN** it states the matching plain-language line
- **AND** historical and read-only views expose no write controls

#### Scenario: A row has no record in a week

- **WHEN** a work-item row has no record in one of its three weeks
- **THEN** that cell shows `—` named `No entry in Last week`, `No entry in This week` or `No entry in Next week`
- **AND** it has no background, border card or add control

#### Scenario: Empty periods are compacted on mobile

- **WHEN** the selected tab of a mobile reporting unit has no record
- **THEN** an editable unit shows only its entry line and a read-only unit shows one plain-language line
- **AND** empty periods do not repeat dates

## REMOVED Requirements

### Requirement: Overview previews MUST preserve reading and secondary-action access

**Reason**: The More actions disclosure, the pencil and the hover row conflict with mockup v2.5: a record carries no per-record icon cluster, its text opens an editing popover, and its status and discussion count are the only controls on the line; the stage is shown as icons.
**Migration**: Use "Overview records show text, stage, status and a conditional discussion count" and "Stages are icons explained by one legend" below, and "Overview records open an editing popover" in `lead-record-editing-popover`.

## ADDED Requirements

### Requirement: One row is one work item

Overview MUST build exactly one row per work item, identified by lineage `stableId`, and trace Last week, This week and Next week within that row. Records with different `stableId`s MUST NOT share a row, matching text MUST NOT join rows, and a cell already filled MUST NOT be overwritten. A plan from last week and a This week record of the same work MUST NOT both appear. Rows keep durable identity order within a unit.

#### Scenario: Different work with the same text stays apart

- **WHEN** two records of a unit have different stableIds and identical text
- **THEN** they appear on two rows and no row joins them
- **AND** a missing stableId never matches another record by its text

#### Scenario: A changed text keeps its row

- **WHEN** the text, stage or Product of one work item differs between Last week, This week and Next week while its stableId is the same
- **THEN** one row traces last, this and next week for it

#### Scenario: A new item gets its own row

- **WHEN** a Lead creates an item
- **THEN** it appears on its own row with its earlier cells empty
- **AND** later saving, a status change or a week move does not move the row

#### Scenario: A result without continuation

- **WHEN** a Last week result has no commitment for the selected week and no This week or Next week record
- **THEN** its row shows the result in Last week and `—` in the other columns
- **AND** no question is created

#### Scenario: A prior plan without a This week record

- **WHEN** the previous report planned a work item for this week and This week has no record of it
- **THEN** its row holds one plan line in This week, answered through its status icon, with any Last week result of the same work beside it
- **AND** the row never shows both the plan line and a This week record of that work

#### Scenario: Work exists only as a plan

- **WHEN** a work item exists only in Next week
- **THEN** its row shows `—` in Last week and This week and the plan in Next week

#### Scenario: A next step shares the row

- **WHEN** a This week record carries a saved next step
- **THEN** the step shows in Next week on the same row as a derived `Next step` line
- **AND** several steps of one work are one multi-line plan, while steps that need their own tracking become new work items with new stableIds and their own rows

#### Scenario: Work is split or merged

- **WHEN** one piece of work is divided into several or several are combined
- **THEN** the source rows stay as they are and each new work item gets a new stableId and its own row
- **AND** history is neither copied into the new rows nor joined, and no Split or Merge operation or inferred link exists

#### Scenario: A work item changes Product

- **WHEN** the owner of a stableId changes between reports
- **THEN** its row belongs to the current owner and keeps one lineage
- **AND** a Last week cell from the earlier Product keeps its former Product label

#### Scenario: A filled cell is never overwritten

- **WHEN** two records with the same stableId would fill the same cell
- **THEN** the second record gets a row of its own, so the conflict is visible
- **AND** neither record is dropped or silently replaced

#### Scenario: Row order is stable

- **WHEN** a record is saved, changes status or moves between weeks
- **THEN** its row keeps its place in the durable identity order that report reads return
- **AND** a new record appears at its own position and does not jump after the read-back

### Requirement: Overview records show text, stage, status and a conditional discussion count

Each record MUST be one line of its text, its stage icons (Product only) and, in This week, a status control; a Next week record MUST have no status control. A discussion control with its message count MUST appear only when the record has comments. A record MUST carry no pencil button, move arrow or per-record action cluster. Hover shows only the cue of `lead-record-editing-popover`: it reveals no control and moves nothing.

#### Scenario: A long record is read

- **WHEN** a long This week record is shown
- **THEN** its full text wraps and remains readable
- **AND** its text control is named `Edit text: <text>, This week` and its status control `Choose outcome: <text>. Status: <label>`

#### Scenario: A record carries no icon cluster

- **WHEN** a record without comments is shown on desktop or touch
- **THEN** it shows no pencil button, no move arrow and no discussion icon
- **AND** the record keeps its size when the pointer hovers it, and the pencil of the hover cue is a decoration in a reserved slot, not a control
- **AND** keyboard focus entering the record changes no size either

#### Scenario: Comments show a count

- **WHEN** a record has N comments
- **THEN** its line shows a discussion icon with the count, named `Discussion: <text>, N comments`
- **AND** activating it opens the discussion Sheet

#### Scenario: A record without comments shows no discussion icon

- **WHEN** a record has no comments
- **THEN** its Discussion stays reachable as `Discussion (0)` in the editing popover
- **AND** the line shows no empty-discussion icon

#### Scenario: Read-only and locked records expose no write action

- **WHEN** a Last week record is shown
- **THEN** its text is not a control and it has no status control
- **WHEN** the report is submitted
- **THEN** its record text is plain text, not an edit button, and no editing popover, status control or write action exists
- **WHEN** a lost-assignment or foreign record is shown in an otherwise open report
- **THEN** its text button opens the popover read-only, and every write action in it stays visible, disabled, with its reason

### Requirement: Stages are icons explained by one legend

Stages MUST render as icons with `role="img"` and the name `Stage: <name>`. One legend above the table MUST explain them. Last week MUST show the same icons dimmed, an Activity record has no stages, and clicking a stage icon on a record MUST open its editing popover like the rest of the cell.

#### Scenario: A record shows stage icons

- **WHEN** a Product record has the stages Development and Testing
- **THEN** its line shows two icons after the text, each with `role="img"` and the names `Stage: Development` and `Stage: Testing`, with the stage name as a tooltip
- **AND** an Activity record shows no stage icon

#### Scenario: The legend appears once

- **WHEN** the Overview renders, editable or submitted
- **THEN** one legend above the table lists all seven stages, each with its icon and name, and no unit or row repeats it

#### Scenario: Each stage has one icon

- **WHEN** a stage icon is drawn anywhere on the Overview, in the legend, on a record, in the popover or in the entry line
- **THEN** it uses this lucide mapping: Planning `calendar`, Analysis `search`, Design `pen-tool`, Development `code-xml`, Testing `flask-conical`, DevOps `infinity`, Support `life-buoy`

#### Scenario: Last week shows dimmed icons

- **WHEN** a Last week record has stages
- **THEN** it shows the same icons, dimmed, with the same accessible names and no control

#### Scenario: A stage icon opens the popover

- **WHEN** the lead clicks a stage icon on an editable This week or Next week record
- **THEN** the editing popover opens like the rest of the cell, and the icon is not a separate control

### Requirement: Last week shows how the previous week went

The Last week column MUST show the previous report's published results with their published statuses, read-only. It MUST NOT change after any action on this screen. Its header subtitle MUST read `How it went · read-only`, This week's MUST read `Progress`, and Next week's MUST read `Plan`.

#### Scenario: Answers do not change Last week

- **WHEN** the lead answers, moves, edits, deletes or undoes a This week or Next week record
- **THEN** the Last week column renders exactly as before the action

#### Scenario: A published status is shown as published

- **WHEN** a Last week record was published with status In progress
- **THEN** it shows In progress with no status menu

#### Scenario: Last week has no controls

- **WHEN** the lead hovers, focuses or activates a Last week record
- **THEN** no editor, menu or action opens and no draft patch is emitted

#### Scenario: The previous report is unavailable

- **WHEN** the previous report is not available
- **THEN** Last week reads `Last week’s report isn’t available.` and This week shows no plan question for it

### Requirement: Next week records have no status

Next week records MUST be plans without a status: no status icon, no status menu, and no Status field in the editing popover or the detailed Sheet. A stored status or pause reason on such a record MUST be kept hidden, never cleared, and moving a record into Next week MUST NOT reset it. Moving it back to This week MUST show the stored status again.

#### Scenario: A Next week record is shown

- **WHEN** a Next week record is shown
- **THEN** it shows no status control and no marker
- **AND** its editing popover and detailed Sheet have no Status field

#### Scenario: Moving keeps the stored progress

- **WHEN** a Paused record moves to Next week and back
- **THEN** it shows no status in Next week
- **AND** it shows Paused with its reason again in This week
