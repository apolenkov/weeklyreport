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

For every item shown in Previously planned that the lead can still decide, the Lead Report Overview MUST offer these verdicts, each reachable in one activation: `Done`, `Continue` (keep it in Current week), `Next week`, and `Paused` (requires a one-line reason). `Won't do` MUST be available in the item's overflow menu and requires its existing reason. Each verdict control on the rail MUST show its icon together with a visible text label naming the verdict, with an accessible name that states the verdict and the item text, and MUST NOT rely on color alone. The rail MUST carry one visible hint line: at rest it asks what happened to the plan, and while a verdict control is hovered or focused it states that verdict's consequence for the selected week before the Lead commits. The same consequence MUST be exposed as the control's accessible description. Verdicts apply only to items that were planned for the selected week; the column MUST NOT ask for a verdict on prior-week results that carry no commitment for the selected week.

#### Scenario: A planned item is marked done

- **WHEN** the lead activates `Done` for a Previously planned item
- **THEN** the item's Current week occurrence for the same `stableId` is created or updated with status done
- **AND** the prior week item, its text and its published snapshot are unchanged
- **AND** the item shows the verdict as an icon stamp without adding text to the row

#### Scenario: A planned item is paused

- **WHEN** the lead activates `Paused` for a Previously planned item
- **THEN** a one-line reason is requested before saving
- **AND** the Current week occurrence for the same `stableId` is saved as paused with that reason
- **AND** no `blocked` wording is used for this verdict

#### Scenario: A planned item moves to next week

- **WHEN** the lead activates `Next week` for a Previously planned item
- **THEN** exactly one Next week occurrence exists for that `stableId` afterwards
- **AND** an already existing explicit Next commitment is not duplicated

#### Scenario: The Lead reads what a verdict does before choosing

- **WHEN** a Previously planned item awaits a verdict
- **THEN** each rail control shows its icon and a visible label, and the rail shows a hint asking what happened to the plan
- **AND** hovering or focusing a control replaces the hint with that verdict's consequence for the selected week
- **AND** no verdict is recorded until the control is activated
