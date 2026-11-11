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

For every prior-week planned item that the Lead can still decide, the Last week column MUST show its answer controls in that plan's own row: `Done` (check), `Continue` (arrow), `Next week` (double arrow) and an overflow "…" holding `Paused` and `Won't do`. Each control MUST be one activation away, have a tooltip and an accessible name that states the verdict and the item text, and MUST NOT rely on color alone. The plan text MUST NOT change.

#### Scenario: A planned item is marked done

- **WHEN** the lead activates `Done` in the plan's row
- **THEN** the item's Current week occurrence for the same `stableId` is created or updated with status done
- **AND** the prior week item, its text and its published snapshot are unchanged
- **AND** the row's controls are replaced by a result mark, and the occurrence appears in This week on the plan's line with a "from plan" marker

#### Scenario: A planned item is paused

- **WHEN** the lead chooses `Paused` from the row's "…" overflow
- **THEN** a one-line reason is requested before saving
- **AND** the Current week occurrence for the same `stableId` is saved as paused with that reason
- **AND** no `blocked` wording is used for this verdict

#### Scenario: A planned item moves to next week

- **WHEN** the lead activates `Next week` in the plan's row
- **THEN** exactly one Next week occurrence exists for that `stableId` afterwards
- **AND** an already existing explicit Next commitment is not duplicated

#### Scenario: The Lead reads what a verdict does before choosing

- **WHEN** a prior-week planned item awaits a verdict
- **THEN** each control's tooltip states that verdict's consequence for the selected week, and the same text is its accessible description
- **AND** visible text labels appear only in the narrow tabbed layout, as a 44 px button strip under the plan
- **AND** no verdict is recorded until the control is activated

#### Scenario: Paused and Won't do share the overflow

- **WHEN** a prior-week planned item awaits a verdict
- **THEN** the row shows only `Done`, `Continue` and `Next week` as icons beside the overflow
- **AND** `Paused` and `Won't do` are the overflow entries, each opening its reason request

#### Scenario: A repeated activation does not answer the next plan

- **WHEN** the lead activates a verdict and activates again at the same position while the row updates
- **THEN** only the first verdict is recorded and the next plan still awaits its answer

#### Scenario: A continuation shares the plan's line

- **WHEN** a plan is answered `Continue` or `Next week`
- **THEN** its This week or Next week record starts on the same row line as the plan, with tops and first text lines within 2 CSS pixels
- **AND** a plan without an answer leaves the space beside it empty, with no placeholder or dash

#### Scenario: Unanswered plans are a non-blocking pointer

- **WHEN** a prior-week planned item has no answer and is not a carried continuation
- **THEN** the blocker line shows an "N plans to answer" link that moves focus to the first such plan's row
- **AND** the link does not block Submit, and "Before you submit" states that unanswered plans are sent as Not answered

#### Scenario: Submitted report shows Not answered

- **WHEN** the report is submitted or read-only
- **THEN** no verdict control is shown and an unanswered plan reads "Not answered"
- **AND** while the report is editable an unanswered plan reads "No answer yet"

#### Scenario: All plans are answered

- **WHEN** no prior-week planned item awaits a verdict
- **THEN** the blocker line shows no "plans to answer" link and the Last week column shows no answer control
- **AND** each plan keeps its result mark in its row

#### Scenario: A carried continuation is not yet confirmed

- **WHEN** rollover has carried a prior plan into This week without confirmation
- **THEN** the plan keeps its answer controls, the This week record is marked "not updated this week" on the plan's line, and the blocker line counts it as "N to review"
- **AND** `Continue` confirms that existing occurrence without creating another, and `Confirm all as Continue` in the Last week column header confirms all such occurrences
- **AND** Submit stays blocked until they are confirmed

#### Scenario: A result without commitment gets no verdict

- **WHEN** a prior-week result carries no commitment for the selected week
- **THEN** its Last week row shows no answer control

#### Scenario: Undo is offered only after confirmation

- **WHEN** a verdict has been recorded
- **THEN** Undo is offered only after its save is confirmed and only while the occurrence still matches the version that verdict produced
- **AND** an Undo outside that window is refused with an explanation and changes nothing

#### Scenario: Undo while the occurrence is being edited is refused

- **WHEN** an editor holds unsaved input for the occurrence produced by a verdict and the Lead activates Undo
- **THEN** Undo is refused with a request to save or cancel first, and the input is kept

#### Scenario: Undo after a later change is refused

- **WHEN** the Lead edits, moves or discusses the occurrence produced by a verdict and then activates Undo
- **THEN** Undo is refused with an explanation and the occurrence and the prior week stay unchanged
