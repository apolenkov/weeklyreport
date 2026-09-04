## Purpose

Give a lead one trustworthy, compact comparison of the agreed prior plan,
current work, and next plan while preserving the report's canonical editing and
lifecycle semantics.

## ADDED Requirements

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose `Overview`, `Edit`, and `Slides`
as addressable view modes. A lead opening the route without a valid mode MUST
see the read-first Overview. Edit MUST retain the existing full authoring
surface and Slides MUST retain the existing presentation surface.

#### Scenario: A lead opens a report without a mode

- **WHEN** an authenticated lead opens `/lead/report/:reportId`
- **THEN** the compact Overview is selected
- **AND** Edit and Slides remain directly reachable without a modal

#### Scenario: A lead opens an explicit edit link

- **WHEN** the route contains `mode=edit`
- **THEN** the existing editable controls, autosave, submit, and completion flows render
- **AND** the Overview projection does not write or duplicate report records

### Requirement: Overview MUST edit current-period items through the canonical editor

For an editable lead draft, Current week and Next week items MUST open the
existing item editor without leaving Overview. Saving MUST update the one
canonical lead draft and MUST use its existing `DraftPatch`, autosave, optimistic
version, authorization, and lifecycle paths. Previously planned MUST remain
immutable. Submitted, locked, historical, and foreign records MUST NOT expose an
Overview write action. Full-authoring workflows MUST remain reachable through
an explicit Edit-details link.

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
`Next week`. `Previously planned` MUST contain `type=next` items from the
immediate predecessor of the selected period. A valid immutable published
snapshot is authoritative; when none exists, a submitted live section MAY be
used. Draft predecessor content and the selected period's `carriedOver` subset
MUST NOT be presented as the complete prior plan. Current and Next MUST use the
selected section's `type=current` and `type=next` items respectively. Each
column MUST show its real period range or an explicit unavailable state.

#### Scenario: The predecessor is published

- **WHEN** the immediate prior period has a valid published snapshot containing the lead's section
- **THEN** Previously planned renders that frozen section's `type=next` items
- **AND** later live-table changes cannot alter the rendered prior plan

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
no-status vocabulary and color tokens.

#### Scenario: A linked activity is blocked

- **WHEN** an Activity is blocked and its linked Product has no Product-level blocked or at-risk floor
- **THEN** Overview shows the Activity as blocked
- **AND** the linked Product retains its independently derived status

### Requirement: Overview MUST be compact, expandable, and contained

At desktop widths of at least 80 rem, all reporting units MUST form a flat
matrix with shared temporal boundaries, thin row separators, and no nested item
card chrome or document-level horizontal overflow. A collapsed unit MUST show
at most two item previews per column and an operable count for hidden items;
activation MUST expand the full content inline. At
smaller widths the same columns MUST remain reachable in a contained sequential
layout. Disclosure controls MUST expose `aria-expanded` and `aria-controls`,
and collapsed content MUST not remain keyboard-focusable.

#### Scenario: A column contains more than two items

- **WHEN** Overview renders a collapsed temporal column with five source items
- **THEN** two previews and an operable `+3 more` control are visible
- **AND** activating that control reveals all five items inline exactly once

#### Scenario: Overview renders at desktop width

- **WHEN** the viewport is 1280 by 900 or 1728 by 962
- **THEN** the three time columns align across reporting units
- **AND** document `scrollWidth` does not exceed `clientWidth`

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
