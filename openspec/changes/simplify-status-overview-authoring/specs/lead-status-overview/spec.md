## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

For an editable lead draft, each active logical work item in the `/lead/report/:reportId` Status Overview MUST expose one primary `Edit` action that opens the canonical item editor without leaving Overview. Its title MUST open that same editor. A prior-only lineage with no active occurrence MUST expose `Plan this work`, which seeds the canonical editor from the authoritative predecessor and creates one Current or Next occurrence with the same stable identity without changing the prior snapshot. Each reporting unit MUST expose one `Add item` action. The editor MUST place the one editable occurrence in either Current week or Next week, never both, without exposing a separate next-step authoring workflow. Saving MUST update the one canonical lead draft through its existing `DraftPatch`, autosave, optimistic version, authorization, and lifecycle paths. Previously planned MUST remain an immutable snapshot. Submitted, locked, historical, and foreign records MUST NOT expose an Overview write action. Priority controls MUST NOT appear in this basic editor, and saving an unrelated edit MUST preserve any existing priority rank.

#### Scenario: A lead creates a Product item from Overview

- **WHEN** the lead activates Add item for an editable Product
- **THEN** the canonical item editor opens with that Product selected and an explicit Current week or Next week choice
- **AND** saving appends the item through the canonical week-items draft patch
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add item for an editable Product and selects Current or Next
- **THEN** the canonical editor follows the Product stage rules and saves through the week-items draft patch

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add item for an editable Activity
- **THEN** the canonical editor opens with that Activity selected and no Product-stage requirement

#### Scenario: A lead edits an existing item

- **WHEN** the lead activates the visible Edit action for an owned Current or Next item
- **THEN** the same canonical editor opens with its text, week, status, and required domain fields
- **AND** no separate next-step editor or Overview-specific write path is used

#### Scenario: An existing priority is hidden from basic editing

- **WHEN** the lead edits a ranked item from Status Overview without changing its priority elsewhere
- **THEN** the basic editor does not display a priority control
- **AND** saving preserves the existing priority rank

#### Scenario: A lead plans a prior-only lineage

- **WHEN** an authoritative Previously planned item has no Current or Next occurrence in an editable draft
- **THEN** `Plan this work` opens the canonical editor with the predecessor values and explicit Current week or Next week selection
- **AND** saving creates one active occurrence with the predecessor stable identity while the prior snapshot remains unchanged
- **AND** no Continue or separate next-step field is exposed

#### Scenario: An Overview item is not writable

- **WHEN** an item belongs to a submitted, locked, historical, or foreign section
- **THEN** no Add, Edit, Move, or drag write action is rendered
- **AND** activating its content cannot emit a draft patch

#### Scenario: An Overview cell is not writable

- **WHEN** a period view is immutable or belongs to a non-writable section
- **THEN** the cell exposes no Add, Edit, Move or drag write action

### Requirement: Temporal columns MUST use authoritative period sources

Every reporting unit MUST expose `Previously planned`, `Current week`, and `Next week` as readable period views. Previously planned MUST use the authoritative immediate predecessor source as an immutable snapshot. Current and Next MUST expose one editable occurrence in exactly one of those two buckets. The authoring surface MUST present one logical work lineage once and MUST NOT require the user to understand `nextStepText`, linked continuation, or standalone implementation terms. Moving the occurrence between Current and Next MUST preserve stable lineage, text, status, priority rank, comments and published history, and MUST NOT clone the item or create a duplicate on retry. Moving MUST NOT silently assert `In progress` or otherwise change status. Independent items MUST remain visually independent rather than being paired by list position.

#### Scenario: A prior plan is moved to Current

- **WHEN** the lead chooses Move to this week for eligible planned work
- **THEN** the canonical editor opens with Current week selected
- **AND** saving retains the work lineage, text and status while leaving the immutable predecessor snapshot unchanged

#### Scenario: The predecessor is published

- **WHEN** the immediate prior period has a valid published snapshot
- **THEN** Previously planned renders that frozen source and later live changes cannot alter it

#### Scenario: Current work is moved to Next

- **WHEN** the lead chooses Move to next week for eligible Current work
- **THEN** the canonical editor opens with Next week selected
- **AND** saving moves the one editable occurrence out of Current and into Next without changing its status or identity

#### Scenario: The target occurrence already exists

- **WHEN** the logical work already has an occurrence in the selected target week
- **THEN** the editor resolves the existing occurrence according to the canonical conflict rule rather than preparing another one
- **AND** repeated saving cannot create a duplicate lineage occurrence in either active bucket

#### Scenario: A new period requires confirmation

- **WHEN** a Next-week plan becomes eligible for the newly opened Current week
- **THEN** Status Overview presents it as awaiting lead confirmation
- **AND** it does not become a confirmed Current update or `In progress` merely because the period opened
- **AND** confirming retains the same lineage, text and status unless the lead explicitly edits them

#### Scenario: A current result has an independent next commitment

- **WHEN** legacy data contains both a Current result and a nonblank independent next commitment
- **THEN** the read path preserves both texts on the same lineage
- **AND** the basic authoring path offers migration to the one-active-occurrence model without silently overwriting either text

#### Scenario: Only a predecessor draft exists

- **WHEN** the immediate prior period has no published or submitted authoritative source
- **THEN** Previously planned shows an unavailable state and does not treat draft content as an agreed plan

#### Scenario: Current work was not in the prior plan

- **WHEN** a Current item has no matching prior planned stable identity
- **THEN** it remains visible once without requiring a repeated per-item Not in prior plan label

#### Scenario: Independent Current and Next work coexist

- **WHEN** a unit contains unrelated Current and Next items
- **THEN** each item renders on its own row or card
- **AND** whitespace or list position does not imply that the items are linked

### Requirement: Overview MUST be compact, expandable, and contained

At desktop widths of at least 80 rem, Status Overview MUST use stable temporal boundaries and aligned item rows without nested card chrome, repeated drag instructions, unexplained icon-only primary actions, or document-level horizontal overflow. One stable action rail MUST contain the primary `Edit` action, one labelled `Move` menu, and at most one secondary overflow for applicable audited outcome or Restore actions. Carried confirmation MAY remain a direct contextual action. At smaller widths, each item MUST render as a contained card with explicit week labels and the same complete keyboard/touch actions. Drag-and-drop MAY be provided only as an optional shortcut for Move or Plan; it MUST invoke the same editor, MUST NOT autosave, MUST NOT imply reordering, and MUST have complete labelled keyboard and touch parity.

#### Scenario: A long item renders at desktop width

- **WHEN** an item has a long title and metadata at 1728 by 867
- **THEN** its text wraps without moving the action rail or producing horizontal overflow
- **AND** neighbouring rows retain aligned temporal boundaries

#### Scenario: A column contains more than two items

- **WHEN** a collapsed unit contains more items than its preview budget
- **THEN** an operable count expands all remaining items inline exactly once

#### Scenario: Overview renders at desktop width

- **WHEN** Overview renders at an accepted desktop viewport
- **THEN** temporal boundaries and action rails align across reporting units
- **AND** document scroll width does not exceed client width

#### Scenario: Desktop rows contain different amounts of text

- **WHEN** neighbouring rows contain different text lengths
- **THEN** text wraps while temporal boundaries and action rails remain aligned

#### Scenario: An editable unplanned item wraps

- **WHEN** an unplanned Current item has a multi-line description
- **THEN** the description, metadata and Edit action remain readable without a floating control

#### Scenario: A lead uses a narrow viewport

- **WHEN** Status Overview renders at 390 by 844
- **THEN** each visible item identifies its week and exposes complete labelled actions
- **AND** no action or content is clipped horizontally

#### Scenario: A lead drags eligible work

- **WHEN** the optional drag affordance moves eligible work to Current or Next
- **THEN** the same canonical editor opens with the target week selected
- **AND** no write occurs until the lead explicitly saves
- **AND** the equivalent labelled action remains available without dragging
