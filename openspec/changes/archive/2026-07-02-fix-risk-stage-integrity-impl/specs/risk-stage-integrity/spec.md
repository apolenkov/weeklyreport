## ADDED Requirements

### Requirement: The risk dialog never dead-ends on a zero-owned-stage product

The risk edit dialog SHALL detect when the lead owns no SDLC stage on the
selected product AND the row carries no stage of its own, and, in that case,
disable Save and show the documented "no stages assigned — contact admin"
message instead of blocking on the required-stage rule. A stage-less risk on a
zero-owned-stage product MUST NOT be left permanently unsaveable behind an
unsatisfiable "Select at least one stage." error.

The guard MUST run before the required-stage validation in `handleSave`
(`apps/web/src/components/lead/risk-edit-dialog.tsx`): when
`availableStages.length === 0 && effectiveStageIds.length === 0` the dialog skips
the required-stage error path and presents the disabled-Save + contact-admin
state promised by the `stagesForProduct` prop JSDoc.

When the guard fires, `handleSave` MUST return early as a no-op WITHOUT calling
`onSave`, so an empty `stageIds` array is never emitted to the caller or the
server write. Skipping the required-stage error branch alone is insufficient: the
function MUST NOT fall through to `onSave`. Every save entry point routes through
`handleSave`, including the Ctrl/Cmd+Enter keyboard shortcut in `handleKeyDown`,
so the keyboard path MUST respect the same guard and stay a no-op for a
zero-owned-stage dead-end. The keyboard shortcut MUST NOT bypass the
disabled-Save state.

The guard MUST NOT fire when the row already carries a stage. A cross-stage risk
that arrives with existing `stageIds` — its product lies outside the lead's
stage-owned list, so `stagesForProduct` returns `[]` — stays saveable: Save
remains enabled and the save preserves the original product and stages. This
keeps the existing cross-stage-product-preservation behaviour intact.

#### Scenario: opening the risk dialog on a stage-less product with no owned stages

- **GIVEN** a lead opens the risk dialog on a product where they own zero stages
- **AND** the risk carries no stage of its own (create mode, or a stage-less row)
- **WHEN** the dialog renders
- **THEN** the Save button is disabled
- **AND** an inline "no stages assigned — contact admin" message is shown
- **AND** the unsatisfiable "Select at least one stage." error is not displayed

#### Scenario: the Ctrl/Cmd+Enter save shortcut is a no-op on a zero-owned-stage dead-end

- **GIVEN** a lead opens the risk dialog on a product where they own zero stages
- **AND** the risk carries no stage of its own (create mode, or a stage-less row)
- **WHEN** the lead presses Ctrl/Cmd+Enter to trigger the keyboard save shortcut
- **THEN** `handleSave` returns early without calling `onSave`
- **AND** no empty `stageIds` payload is emitted
- **AND** the "no stages assigned — contact admin" state remains shown

#### Scenario: editing a cross-stage risk that already carries stages stays saveable

- **GIVEN** a lead edits a risk whose product is outside their stage-owned list
- **AND** the risk already carries one or more `stageIds`
- **AND** `stagesForProduct` returns `[]` for that product
- **WHEN** the dialog renders and the lead saves
- **THEN** Save is enabled
- **AND** the "no stages assigned — contact admin" message is not shown
- **AND** the save preserves the original product and stages

#### Scenario: a product with at least one owned stage is unaffected

- **GIVEN** a lead opens the risk dialog on a product where they own one or more
  stages
- **WHEN** the dialog renders
- **THEN** Save is enabled and the existing required-stage rule applies
  (a single owned stage auto-applies; a multi-owned selection of none blocks
  saving with "Select at least one stage.")

### Requirement: The required-mode stage banner does not promise "all stages"

The stage selector's consequence banner SHALL NOT advertise an empty selection as
"All assigned stages will show as …" when the selector is in required mode. In
required mode an empty selection is invalid, so the empty-selection banner MUST be
suppressed; the one-stage and multi-stage banner copy is unchanged, and a
non-required host keeps the existing empty-selection banner.

This applies to `apps/web/src/components/lead/stage-multi-select.tsx`: the
empty-selection banner branch is gated on `required === false`.

#### Scenario: required selector with no stage chosen shows no all-stages banner

- **GIVEN** the stage selector renders with `required` true and no stage selected
- **WHEN** the consequence banner is evaluated
- **THEN** no "All assigned stages will show as …" banner is rendered

#### Scenario: a non-required selector keeps the empty-selection banner

- **GIVEN** the stage selector renders with `required` false and no stage selected
- **WHEN** the consequence banner is evaluated
- **THEN** the existing "All assigned stages will show as …" banner is rendered

#### Scenario: selecting stages still previews the consequence

- **GIVEN** the stage selector renders in required mode
- **WHEN** the lead selects one or more stages
- **THEN** the per-stage / multi-stage consequence banner is shown as before

### Requirement: Stage id array elements are non-empty, visible, and null-byte-free

The strict write field `requiredStageIdsField` SHALL validate each array element
as a non-empty string with at least one visible character and no null byte, via
`z.string().min(1).refine(noNullBytes).refine(noInvisibleOnly)`, in addition to
the existing array-length `.min(1)` and `.max(MAX_SELECTED_STAGES)` rules. The
field lives in `packages/shared/src/schemas/report-primitives.schema.ts`. An
element that is the empty string, whitespace-only, zero-width-only, or contains a
null byte MUST be rejected at the schema boundary — not only after the dialog
trims — so a `[""]` or `[" "]` payload no longer satisfies the require-a-stage
intent and malformed strings never reach the database write.

The loose read field `stageIdsField` is unchanged, so stage-less legacy rows
still load and render the loud "No stage set" marker.

#### Scenario: a payload with an empty-string stage element is rejected

- **WHEN** a write payload sets a risk, item, or decision `stageIds` to `[""]`
- **THEN** `requiredStageIdsField` validation fails and the payload is rejected

#### Scenario: a payload with a whitespace-only stage element is rejected

- **WHEN** a write payload sets `stageIds` to `[" "]` or a zero-width-only string
- **THEN** `requiredStageIdsField` validation fails and the payload is rejected

#### Scenario: a payload with a null-byte stage element is rejected

- **WHEN** a write payload sets `stageIds` to an array whose element contains a
  null byte
- **THEN** `requiredStageIdsField` validation fails and the payload is rejected

#### Scenario: a payload with concrete stage names still passes

- **WHEN** a write payload sets `stageIds` to one or more non-empty stage names
- **THEN** `requiredStageIdsField` validation passes
