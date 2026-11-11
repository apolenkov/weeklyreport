## ADDED Requirements

### Requirement: A frozen prior commitment can be continued without rewriting history

Previously planned MUST remain read-only. Eligible prior work MUST be continuable in Current through the existing verdict and continuation owners, without rewriting a prior record or snapshot, duplicating a stableId or silently overwriting a conflicting continuation. Existing eligible verdicts and reason requirements remain available.

#### Scenario: Continue a previous commitment already carried forward

- **WHEN** a prior commitment already has a carried Current occurrence and the Lead chooses Continue
- **THEN** the existing Current occurrence is confirmed or opened for further work without creating another occurrence
- **AND** the prior record and its frozen snapshot are unchanged

#### Scenario: Only a linked Next occurrence exists

- **WHEN** a Lead continues an eligible previous commitment and the selected week has a linked Next occurrence but no Current occurrence
- **THEN** the existing linked-item planner handles it under its existing conflict and promotion rules
- **AND** it does not blindly create an additional Current occurrence or overwrite an explicit Next commitment

#### Scenario: Neither selected-week occurrence exists

- **WHEN** a Lead continues an eligible previous commitment and neither Current nor Next occurrence exists
- **THEN** the existing prior-plan outcome command records the selected-week result under the same stableId and retains its audit event
- **AND** a retry of the same command identity is handled under the existing replay rules without modifying the previous snapshot

#### Scenario: Conflicting continuations exist

- **WHEN** selected-week occurrences conflict or contain a different explicit continuation
- **THEN** existing conflict selection and history rules apply without silent replacement or duplicate active occurrences

## MODIFIED Requirements

### Requirement: Each prior-week planned item MUST receive one verdict in one action

For every prior-week planned item that the Lead can still decide, the Lead Report Overview MUST list it exactly once in a "Last week's plan" answer list placed above the This week / Next week grid. Each row shows the planned text, its Product or Activity and its stage as read-only context. Each row MUST offer `Done`, `Continue` (keep it in This week) and `Next week`, each reachable in one activation, and an overflow menu holding `Paused` (requires a one-line reason) and `Won't do` (requires its existing reason). Each verdict control MUST show a visible text label naming the verdict, with an accessible name that states the verdict and the item text, and MUST NOT rely on color alone. The list MUST carry one visible hint line: at rest it asks what happened to each plan, and while a verdict control is hovered or focused it states that verdict's consequence for the selected week before the Lead commits; the same consequence MUST be exposed as the control's accessible description. A recorded verdict removes the row from the list, shows the selected week's occurrence in its unit's This week or Next week cell with a visible "from plan" marker, announces the result and offers Undo. While the list reflows after a verdict, a repeated activation landing on the next row within a short guard interval MUST NOT record a verdict. When no plan awaits an answer the list MUST collapse to a one-line summary that keeps the "Show last week" control. Verdicts apply only to items that were planned for the selected week; the list MUST NOT ask for a verdict on prior-week results that carry no commitment for the selected week.

#### Scenario: A planned item is marked done

- **WHEN** the lead activates `Done` for a row of the answer list
- **THEN** the item's Current week occurrence for the same `stableId` is created or updated with status done
- **AND** the prior week item, its text and its published snapshot are unchanged
- **AND** the row leaves the answer list and the unit's This week cell shows the occurrence with a "from plan" marker

#### Scenario: A planned item is paused

- **WHEN** the lead chooses `Paused` from the row's overflow menu
- **THEN** a one-line reason is requested before saving
- **AND** the Current week occurrence for the same `stableId` is saved as paused with that reason
- **AND** no `blocked` wording is used for this verdict

#### Scenario: A planned item moves to next week

- **WHEN** the lead activates `Next week` for a row of the answer list
- **THEN** exactly one Next week occurrence exists for that `stableId` afterwards
- **AND** an already existing explicit Next commitment is not duplicated

#### Scenario: The Lead reads what a verdict does before choosing

- **WHEN** a prior-week planned item awaits a verdict
- **THEN** each control shows a visible label, and the list shows a hint asking what happened to each plan
- **AND** hovering or focusing a control replaces the hint with that verdict's consequence for the selected week
- **AND** no verdict is recorded until the control is activated

#### Scenario: A repeated activation does not answer the next plan

- **WHEN** the lead activates a verdict and activates again at the same position while the list reflows
- **THEN** only the first verdict is recorded and the next plan still awaits its answer

#### Scenario: All plans are answered

- **WHEN** no prior-week planned item awaits a verdict
- **THEN** the answer list collapses to one line stating that all plans are answered
- **AND** "Show last week" remains available
