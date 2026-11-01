# lead-status-overview Specification

## Purpose

Keep the lead Overview readable and contained by grouping reporting units,
using authoritative temporal sources and the canonical health vocabulary.

## Requirements

### Requirement: Overview MUST group and identify reporting units clearly

Products and Project Activities MUST remain peer reporting-unit types in stable
Product-first order, with explicit group boundaries and counts. The visible
label of each unit MUST retain its complete identity at the accepted desktop
viewports; a status badge or metadata MUST NOT force the only name label into a
single-line ellipsis. Grouping MUST NOT duplicate Activity rows beneath linked
Products.

#### Scenario: Long Product and Activity names are rendered

- **WHEN** a reporting-unit name exceeds the first-column single-line width
- **THEN** the complete name remains visually readable through wrapping
- **AND** status and metadata remain associated with the same unit
- **AND** the document has no horizontal overflow

#### Scenario: Both reporting-unit types are present

- **WHEN** Overview contains Products and Project Activities
- **THEN** each type appears under one explicit labelled group with its real count
- **AND** every reporting unit appears exactly once in canonical order

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose addressable Report and Slides views, defaulting to Report Overview. Report MUST retain canonical document/context controls and one unit-header Add item action per eligible unit. Additional contextual create controls MUST reuse the same handlers, not another persistence path. Removing Edit mode MUST preserve `unified-report-authoring` parity.

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
- **THEN** Report retains report identity, autosave, Fill from, Retry after autosave error, Submit, period navigation, visibility, mode controls, and the eligible unit-header Add item action
- **AND** all actions use canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates unit Add item, contextual creation, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Overview MUST render each reporting unit once

The Overview MUST treat Product and Project Activity as peer reporting-unit
types. Products MUST appear in their stable existing order, followed by
Activities. An Activity with zero, one, or multiple linked Products MUST appear
once; linked Products MUST be secondary labels and MUST NOT create duplicate or
nested Activity rows. Historical parents represented by authoritative report
data MUST remain visible under their stored labels.

#### Scenario: An activity links to multiple products

- **WHEN** the authorized section contains one Activity linked to two Products
- **THEN** Overview renders one Activity reporting unit with both Product labels
- **AND** the Activity is not repeated beneath either Product

#### Scenario: A historical parent is no longer assigned

- **WHEN** an authoritative temporal source contains an item whose parent is absent from the current assignment catalogue
- **THEN** Overview appends one historical reporting unit using the stored parent label
- **AND** the source item is not dropped or silently reassigned

### Requirement: Temporal columns MUST use authoritative period sources

Every reporting unit MUST expose `Previously planned`, `Current week`, and
`Next week`. `Previously planned` MUST contain next-period commitments from the
immediate predecessor of the selected period: `type=next` items and independently
stored nonblank `nextStepText` on Current items. For a Current item's commitment,
the column MUST show the next-step text, not its previous reported result.
Cancelled predecessor records MUST remain visible as historical resolutions,
not active commitments. A valid immutable published
snapshot is authoritative; when none exists, a submitted live section MAY be
used. Draft predecessor content and the selected period's `carriedOver` subset
MUST NOT be presented as the complete prior plan. Current MUST use the selected
section's `type=current` results. Next MUST use its `type=next` items and separate
Current-item next commitments. Projecting a commitment MUST preserve the Current
result and stable lineage without creating a second editable occurrence. Each
column MUST show its real period range or an explicit unavailable state.

#### Scenario: The predecessor is published

- **WHEN** the immediate prior period has a valid published snapshot containing the lead's section
- **THEN** Previously planned renders that frozen section's next-period commitments and historical resolutions
- **AND** later live-table changes cannot alter the rendered prior plan

#### Scenario: A current result has an independent next commitment

- **WHEN** a selected Current item contains both a reported result and nonblank `nextStepText`
- **THEN** Current week shows the result and Next week shows the separate commitment
- **AND** both projections retain the same stable lineage and one editable occurrence
- **AND** the authoritative successor's Previously planned column uses the commitment text rather than repeating the result

#### Scenario: Only a predecessor draft exists

- **WHEN** the immediate prior period has no published snapshot and the lead's section is draft
- **THEN** Previously planned shows an explicit unavailable state
- **AND** no draft item is represented as an agreed plan

#### Scenario: Current work was not in the prior plan

- **WHEN** a current item has no matching prior planned stable identity
- **THEN** Current week marks it as unplanned
- **AND** the item remains visible exactly once

### Requirement: Overview status MUST reuse canonical health semantics

A Product header MUST use the current risk-floored owned-stage status and stage
coverage. An Activity header MUST use its independent Activity status and
linked-Product labels. Activity health MUST NOT change the status of a linked
Product. The Overview MUST use the canonical on-track, at-risk, blocked, and
no-status vocabulary and color tokens. The summary MUST render a visible health
badge only for `at-risk` and `blocked`; `on-track` and `empty` MUST remain
valid model values and MUST NOT be relabelled as a different health.

#### Scenario: A linked activity is blocked

- **WHEN** an Activity is blocked and its linked Product has no Product-level blocked or at-risk floor
- **THEN** Overview shows the Activity as blocked
- **AND** the linked Product retains its independently derived status

#### Scenario: A unit has no actionable health

- **WHEN** a unit is `on-track` or `empty`
- **THEN** no unit health badge is rendered
- **AND** its name, ownership metadata, linked Products, and content remain available

#### Scenario: A unit requires attention

- **WHEN** a unit is `at-risk` or `blocked`
- **THEN** the canonical label, tone, and dot are rendered once

### Requirement: Overview MUST be compact, expandable, and contained

At desktop widths of at least 80 rem, all reporting units MUST form a flat
matrix with shared temporal boundaries, thin row separators, and no nested item
card chrome or document-level horizontal overflow. The identity column and the
three temporal columns MUST use four equal flexible tracks. Every cell in a
unit row MUST share that row's computed height. Within an item, description and
tag MUST own the flexible region while continuity and Edit occupy one stable
trailing rail; text growth MUST wrap without moving actions into a separate
column or causing document overflow. A collapsed unit MUST show at most two
item previews per column and an operable count for hidden items; activation
MUST expand the full content inline. At smaller widths the same columns MUST
remain reachable in a contained sequential layout. Disclosure controls MUST
expose `aria-expanded` and `aria-controls`, and collapsed content MUST not
remain keyboard-focusable.

#### Scenario: A column contains more than two items

- **WHEN** Overview renders a collapsed temporal column with five source items
- **THEN** two previews and an operable `+3 more` control are visible
- **AND** activating that control reveals all five items inline exactly once

#### Scenario: Overview renders at desktop width

- **WHEN** Overview renders at 1280 by 900 or 1728 by 962
- **THEN** the three time columns align across reporting units
- **AND** document `scrollWidth` does not exceed `clientWidth`

#### Scenario: Desktop rows contain different amounts of text

- **WHEN** Overview renders at 1280x900 or 1728x962
- **THEN** all four column boundaries align across every reporting unit
- **AND** each cell within a row has equal height
- **AND** the document has no horizontal overflow

#### Scenario: An editable unplanned item wraps

- **WHEN** an unplanned Current item has a multi-line description
- **THEN** the `Unplanned` marker stays with the item's metadata row beneath the description
- **AND** the description, marker, and actions remain readable without overlap

### Requirement: Overview read path MUST preserve access and lifecycle invariants

The Overview tRPC read path MUST use a canonical protected procedure chain and
the same object-level author/report access rules as the lead form. It MUST bound
predecessor lookup to the immediate earlier period and one authorized section.
It MUST NOT mutate `periodState`, its companion lifecycle tuple, report content,
or published snapshots.

#### Scenario: A caller requests another lead's predecessor

- **WHEN** the session lacks access to the requested author's selected or prior section
- **THEN** the procedure returns no foreign content through rows, counts, labels, or errors

#### Scenario: Overview is loaded repeatedly

- **WHEN** the same Overview is loaded multiple times
- **THEN** report and lifecycle rows remain unchanged
- **AND** each temporal source count equals its rendered item count

### Requirement: Empty temporal cells MUST state their emptiness in plain language

Status Overview MUST show empty desktop cells as `—` plus sr-only `No item in this period`, with the dash hidden from assistive technology. On mobile, one plain-language line per unit MUST state that other periods are empty, without naming each empty period or repeating dates. Contextual creation for empty editable periods MUST remain reachable under the contextual-create requirement.

#### Scenario: A temporal cell has no content

- **WHEN** a Previously planned, Current week, or Next week desktop cell has no item
- **THEN** it shows `—` visually and `No item in this period` to a screen reader
- **AND** no edit or next-step control exists for an absent item
- **AND** contextual Add is offered only for eligible Current/Next cells; historical and read-only views expose no write controls

#### Scenario: Empty periods are compacted on mobile

- **WHEN** a mobile reporting unit contains empty temporal cells
- **THEN** one plain-language line states that other periods are empty, such as `No items in other periods`
- **AND** individual empty lanes remain collapsed and do not repeat dates or name each empty period
- **AND** Current and Next creation remains touch-reachable from the unit header, including when the whole unit is empty
- **AND** Previously planned remains read-only

### Requirement: Earlier open work MUST be collapsed by default

The register of earlier open work (paused and unscheduled work from earlier periods) MUST render as a single disclosure line stating its count and MUST show its items only when the lead expands it. Its content, once expanded, and the replan actions MUST remain as specified for tracked work.

#### Scenario: earlier open work exists

- **WHEN** four earlier open items exist
- **THEN** the Overview shows one line stating four earlier open items, collapsed
- **AND** expanding it reveals the items with their existing replan action

#### Scenario: no earlier open work exists

- **WHEN** no earlier open item exists
- **THEN** the register renders nothing

### Requirement: Overview previews MUST preserve reading and secondary-action access

Editable Current/Next previews MUST keep readable copy, a separate complete-editor action, a status interaction, and one applicable secondary-action disclosure. Read-only previews MUST expose no write action. Move MUST follow the placement-or-acknowledgement contract in `record-status-derivation`, not reinterpret Continue next week.

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its full-text disclosure remains operable and its copy remains readable
- **AND** copy activation opens the editor with accessible name `Edit item: <update text>`
- **AND** its status icon is named `Status of <update text>: <status>`
- **AND** Edit details opens the same editor

#### Scenario: secondary actions share one disclosure

- **WHEN** Edit details, Update status, or an applicable Move action exists
- **THEN** one disclosure named `More actions for <update text>` exposes those actions
- **AND** it is absent when no secondary action applies
- **AND** outcome actions, text disclosure, and focus restoration remain operable

#### Scenario: a Current occurrence is postponed to Next

- **WHEN** the lead selects Move to next week for an eligible Current item without a separate next commitment
- **THEN** the canonical editor selects Next and retains description and progress without writing before Save
- **AND** Save follows the placement-only move contract, not the separate Continue next week verdict

#### Scenario: Move keeps a saved next step and never promotes

- **WHEN** the lead selects Move to next week for an eligible Current item that already carries a saved next step
- **THEN** no editor opens; the item stays Current with its description and the saved next step, and the Next lane keeps projecting that plan
- **AND** the acknowledgement rides the ordinary draft save, the continuation-promotion command is not called, and focus returns to the More actions trigger

### Requirement: The Active week control MUST NOT ignore a click after a failed save

While the Overview editor shows a failed save, every Active week radio MUST
either apply the lead's choice or be disabled. An enabled radio MUST NOT ignore
a click. The text the lead typed MUST remain in the editor in both cases.

#### Scenario: a week is chosen after a failed save

- **WHEN** a lead saves an edited item and the save fails
- **AND** the lead clicks the other Active week radio
- **THEN** that radio is selected, or it is disabled
- **AND** the lead's typed text is still in the Description field
