# lead-status-overview Specification

## Purpose

Keep the lead Overview readable and actionable by grouping reporting units and
opening the canonical item editor from editable Current and Next cells.

## Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

For an editable lead draft, Current week and Next week items MUST open the
existing item editor without leaving Overview. Every editable Current and Next
cell MUST also expose a contextual create action seeded to that reporting unit.
Saving an edit or creation MUST update the one canonical lead draft and MUST use
its existing `DraftPatch`, autosave, optimistic version, authorization, and
lifecycle paths. Previously planned MUST remain immutable. Submitted, locked,
historical, and foreign records MUST NOT expose an Overview write action.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add in an editable Product Current or Next cell
- **THEN** the existing item editor opens on the same page with that Product and week selected
- **AND** saving appends the item through the canonical week-items draft patch
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add in an editable Activity Current or Next cell
- **THEN** the existing item editor opens with that Activity selected and no Product-stage requirement
- **AND** saving follows the same canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no Add or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

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

The `/lead/report/:reportId` route MUST expose `Report` and `Slides` as
addressable views. Report MUST use the Overview projection as its unified
reading and authoring surface; Slides MUST retain the presentation surface.
A lead opening the route without a valid mode MUST see Report. Report MUST
retain the canonical report identity, autosave, Fill From, Save, quick-add,
Submit, period navigation, visibility, and mode controls whenever available
for the current section. These controls MUST call the existing editor draft
and write actions; Overview MUST NOT introduce a second action implementation
or persistence path. Removing the separate Edit mode MUST satisfy the full
authoring parity requirement in `unified-report-authoring`.

#### Scenario: A lead opens a report without a mode

- **WHEN** an authenticated lead opens `/lead/report/:reportId`
- **THEN** Report is selected with the compact Overview projection
- **AND** Slides remains directly reachable without a modal

#### Scenario: A lead opens an explicit edit link

- **WHEN** the route contains `mode=edit`
- **THEN** the route normalizes to the canonical Report URL
- **AND** the existing editable controls, autosave, submit, and completion flows remain available in Report according to section eligibility
- **AND** normalization does not write or duplicate report records

#### Scenario: An editable lead opens the default route

- **WHEN** the lead opens `/lead/report/:reportId` without a mode query
- **THEN** Report is active and the canonical document/context actions render
- **AND** Save, quick add, Submit, period, visibility, and mode actions use the canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates quick add, Fill From, Submit, or reopen/revoke
- **THEN** the existing lead dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Overview MUST edit current-period items through the canonical editor

For an editable lead draft, Current week and Next week items MUST open the
existing item editor without leaving Overview. Saving MUST update the one
canonical lead draft and MUST use its existing `DraftPatch`, autosave, optimistic
version, authorization, and lifecycle paths. Previously planned MUST remain
immutable. Submitted, locked, historical, and foreign records MUST NOT expose an
Overview write action. Full-authoring workflows MUST remain reachable within
Report through its inline controls and canonical details editor, without a
separate Edit mode.

#### Scenario: A lead edits a current item from Overview

- **WHEN** the lead activates an owned Current week item in an editable draft
- **THEN** the existing item editor opens on the same Overview page
- **AND** saving applies the change through the canonical draft and autosave path
- **AND** the compact projection reflects the live draft change

#### Scenario: A lead edits a next item from Overview

- **WHEN** the lead activates an owned Next week item in an editable draft
- **THEN** the same canonical item editor opens with Next week status rules
- **AND** no Overview-specific mutation or autosave path is used

#### Scenario: An item is not editable

- **WHEN** an item belongs to Previously planned or the section is submitted, locked, historical, or foreign
- **THEN** Overview renders it without an edit action
- **AND** activating the read-only content cannot emit a draft patch

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

### Requirement: Overview MUST expose one primary progress interaction per active item

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns and the canonical item editor, while each editable Current or Next item exposes one primary progress/status interaction. It MUST NOT present separate Plan, Confirm, Update status, or week-arrow controls on the primary layer. Updating an unconfirmed carried item through the canonical status/update interaction MUST clear its unconfirmed marker; it MUST NOT require a separate Confirm action. Edit details and rare week movement MAY remain inside one secondary overflow. Restore and explicit historical replanning MAY appear only when applicable. Previously planned content MUST remain read-only.

#### Scenario: an unconfirmed carried item is shown

- **WHEN** Overview renders a carried Current item that the lead has not updated in the selected week
- **THEN** it visibly states that the item is continued or planned but not updated this week
- **AND** one primary progress interaction lets the lead update its current status without a separate Confirm action

#### Scenario: an ordinary active item is shown

- **WHEN** Overview renders an editable Current or Next item with no restore or historical-replan state
- **THEN** it exposes one progress/status interaction and at most one separate Edit action
- **AND** it does not expose Plan, Confirm, Update status, or arrow controls as competing primary actions

#### Scenario: prior week remains read-only

- **WHEN** Overview renders Previously planned content
- **THEN** no edit, move, confirm, or status mutation control is available in that column
- **AND** its text, outcome, and lineage remain visible

#### Scenario: keyboard operation preserves context

- **WHEN** the lead operates the progress interaction or cancels the canonical editor with a keyboard
- **THEN** focus returns to the triggering item control or the Overview heading
- **AND** the three-column lineage remains visible without document-level horizontal overflow

### Requirement: Empty temporal cells MUST state their emptiness in plain language

The Lead Report route's Status Overview MUST render an empty temporal cell with
the visible text `No item` and no write action in that cell. A decorative mark
MUST NOT be the only explanation. New work MUST be created through the
reporting unit's single `Add item` action, which is hidden for historical units
and read-only views.

#### Scenario: A temporal cell has no content

- **WHEN** a Previously planned, Current week, or Next week cell has no item
- **THEN** it shows `No item`
- **AND** the cell exposes no add, edit, or next-step control
- **AND** below the desktop breakpoint the cell collapses to one line pairing the column label with `No item`, without a period date
