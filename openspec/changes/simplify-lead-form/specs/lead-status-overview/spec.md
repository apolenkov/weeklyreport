# Spec Delta

## MODIFIED Requirements

### Requirement: Overview MUST expose one primary progress interaction per active item

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns and the canonical item editor. Each editable Current or Next item MUST rest as one status icon followed by its text, with at most a small stage badge in a corner; it MUST NOT render permanent text action buttons or a metadata line. The status icon MUST be the one primary progress/status interaction and MUST open a menu of statuses, because a cycling click would pass over statuses that need a reason. Secondary actions (edit details, move between weeks, resolve) MUST be reachable from one overflow control that is revealed on pointer hover, on keyboard focus within the item, and on tap, and MUST stay in the accessibility tree and keyboard order while visually hidden. Updating an unconfirmed carried item through the status interaction MUST clear its unconfirmed marker; it MUST NOT require a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

#### Scenario: an unconfirmed carried item is shown

- **WHEN** Overview renders a carried Current item that the lead has not updated in the selected week
- **THEN** its status icon visibly marks it as continued or planned but not updated this week
- **AND** the status interaction lets the lead update it without a separate Confirm action

#### Scenario: an ordinary active item is shown

- **WHEN** Overview renders an editable Current or Next item with no restore or historical-replan state
- **THEN** it shows only the status icon, its text and an optional stage badge
- **AND** no text button and no metadata line is visible

#### Scenario: actions are revealed on hover, focus and tap

- **WHEN** the lead hovers the item, moves keyboard focus into it, or taps it
- **THEN** the overflow control and the quick week-move action become visible
- **AND** keyboard users reach them with Tab without a hover
- **AND** touch users get them without any hover requirement

#### Scenario: prior week remains read-only

- **WHEN** Overview renders Previously planned content
- **THEN** no control edits, moves or changes the status of the prior-week occurrence
- **AND** its text, outcome and lineage remain visible
- **AND** verdict controls, when shown, change only the selected week's occurrence

#### Scenario: keyboard operation preserves context

- **WHEN** the lead operates the status interaction or cancels the canonical editor with a keyboard
- **THEN** focus returns to the triggering item control or the Overview heading
- **AND** the three-column lineage remains visible without document-level horizontal overflow

### Requirement: Overview previews MUST separate reading from editing

Editable Current and Next previews MUST render readable update copy and expose a separate action for the complete item editor. In the clickable item preview its accessible name MUST be `Edit item: <update text>`. The status icon's accessible name MUST be `Status of <update text>: <status>`. Read-only copy MUST NOT expose a write action. Existing text disclosure, outcome actions and focus restoration MUST remain operable.

Secondary actions (`Edit details`, `Update status`, and `Move to next week` / `Move to this week`) MUST be reachable through one disclosure (accessible name `More actions for <update text>`); the disclosure MUST NOT render when none of them applies. Moving a Current result to Next MUST keep the Current result and record the continuation in `nextStepText`, so both weeks remain visible in one lineage.

#### Scenario: a Current result continues next week

- **WHEN** the lead activates `Move to next week` in `More actions` for a Current result
- **THEN** the editor keeps the item in Current and focuses its Next step
- **AND** saving preserves the Current result and stores the continuation for Next

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its copy remains readable with the existing full-text disclosure
- **AND** activating the copy opens the canonical editor
- **AND** activating `Edit details` in `More actions` opens the canonical editor

## ADDED Requirements

### Requirement: Earlier open work MUST be collapsed by default

The register of earlier open work (paused and unscheduled work from earlier periods) MUST render as a single disclosure line stating its count and MUST show its items only when the lead expands it. Its content, once expanded, and the replan actions MUST remain as specified for tracked work.

#### Scenario: earlier open work exists

- **WHEN** four earlier open items exist
- **THEN** the Overview shows one line stating four earlier open items, collapsed
- **AND** expanding it reveals the items with their existing replan action

#### Scenario: no earlier open work exists

- **WHEN** no earlier open item exists
- **THEN** the register renders nothing
