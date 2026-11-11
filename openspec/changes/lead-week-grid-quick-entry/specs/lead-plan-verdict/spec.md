## ADDED Requirements

### Requirement: A frozen prior commitment can be continued without rewriting history

Previously planned MUST remain read-only. Eligible prior work MUST be continuable in This week through the existing verdict and continuation owners, without rewriting a prior record or snapshot, duplicating a stableId or silently overwriting a conflicting continuation. Existing eligible verdicts and reason requirements remain available.

#### Scenario: Continue a previous commitment already carried forward

- **WHEN** a prior commitment already has a carried This week occurrence and the Lead chooses Continue or sets its status
- **THEN** the existing This week occurrence is updated or confirmed without creating another occurrence
- **AND** the prior record and its frozen snapshot are unchanged

#### Scenario: Only a linked Next occurrence exists

- **WHEN** a Lead continues an eligible previous commitment and the selected week has a linked Next occurrence but no This week occurrence
- **THEN** the existing linked-item planner handles it under its existing conflict and promotion rules
- **AND** it does not blindly create an additional This week occurrence or overwrite an explicit Next commitment

#### Scenario: Neither selected-week occurrence exists

- **WHEN** a Lead continues an eligible previous commitment and neither This week nor Next week occurrence exists
- **THEN** the existing prior-plan outcome command records the selected-week result under the same stableId and retains its audit event
- **AND** a retry of the same command identity is handled under the existing replay rules without modifying the previous snapshot

#### Scenario: Conflicting continuations exist

- **WHEN** selected-week occurrences conflict or contain a different explicit continuation
- **THEN** existing conflict selection and history rules apply without silent replacement or duplicate active occurrences

## MODIFIED Requirements

### Requirement: Each prior-week planned item MUST receive one verdict in one action

For every prior-week planned item the Lead can still decide, This week MUST show a question reading `Planned last week · What happened?` with the visible answers `Done`, `Continue` and `Next week`, and an overflow `⋯` holding `Paused` and `Won't do`. Done, Continue and Next week MUST each record in one activation. Paused and Won't do MUST each take two activations and a one-line reason. The plan text MUST NOT change.

#### Scenario: A planned item is marked done

- **WHEN** the lead activates `Done` in the plan's question
- **THEN** the This week occurrence for the same `stableId` is created or updated with status done
- **AND** the prior week item, its text and its published snapshot are unchanged
- **AND** the question is replaced by that record on the plan's line, with no "from plan" label on desktop

#### Scenario: A planned item is paused

- **WHEN** the lead activates `⋯` and then `Paused`
- **THEN** a one-line reason is requested inline with Save and Cancel, and an empty reason is refused
- **AND** on Save the This week occurrence for that `stableId` is saved as paused with that reason, and no `blocked` wording is used

#### Scenario: A planned item moves to next week

- **WHEN** the lead activates `Next week` in the plan's question
- **THEN** exactly one Next week occurrence exists for that `stableId` afterwards, with no status shown
- **AND** an already existing explicit Next commitment is not duplicated
- **AND** This week shows the muted line `Planned last week · moved to next week` in place of the question

#### Scenario: The Lead reads what a verdict does before choosing

- **WHEN** a prior-week planned item awaits a verdict
- **THEN** each answer's tooltip states its consequence for the selected week, and the same text is its accessible description
- **AND** no verdict is recorded until an answer is activated

#### Scenario: Paused and Won't do share the overflow

- **WHEN** a prior-week planned item awaits a verdict
- **THEN** the question shows only `Done`, `Continue` and `Next week` as labelled answers beside the `⋯` overflow
- **AND** `Paused` and `Won't do` are the overflow entries, each opening its reason request

#### Scenario: A repeated activation does not answer the next plan

- **WHEN** the lead activates a verdict and activates again at the same position while the question updates
- **THEN** only the first verdict is recorded and the next plan still awaits its answer

#### Scenario: A continuation shares the plan's line

- **WHEN** a plan is answered `Continue` or `Next week`, or a carried continuation exists
- **THEN** its This week or Next week record starts on the plan's line, which is the line of its last-week record when one exists, with tops and first text lines within 2 CSS pixels
- **AND** a plan with no answer leaves the space beside it empty, with no placeholder or dash

#### Scenario: Unanswered plans are a non-blocking pointer

- **WHEN** a prior-week planned item has no answer and is not a carried continuation
- **THEN** the This week column header shows an `N plans to answer` link that moves focus to the first such question
- **AND** the link does not block Submit, and `Before you submit` states that unanswered plans are sent as Not answered

#### Scenario: Submitted report shows Not answered

- **WHEN** the report is submitted or read-only
- **THEN** no answer control is shown and an unanswered plan reads `Planned last week · not answered` on its line
- **AND** while the report is editable an unanswered plan shows its question and no `not answered` text

#### Scenario: All plans are answered

- **WHEN** no prior-week planned item awaits a verdict
- **THEN** the This week header shows no `plans to answer` link and no answer control remains
- **AND** each answered plan keeps its result, a record or the muted moved line, on its line

#### Scenario: A carried continuation is not yet confirmed

- **WHEN** rollover has carried a prior plan into This week without a chosen status
- **THEN** its record shows a question-mark status named `Status not set` and the marker `needs a status`, and no separate question is shown
- **AND** choosing any status answers the plan
- **AND** until every such record has a status, Submit stays blocked and the record counts in `N to fix`

#### Scenario: A result without commitment gets no verdict

- **WHEN** a prior-week result carries no commitment for the selected week
- **THEN** its Last week row shows no answer control

#### Scenario: Undo is offered only after confirmation

- **WHEN** a verdict has been recorded
- **THEN** Undo restores the record the verdict changed only after its save is confirmed and only while the record still matches the version that verdict produced
- **AND** Undo is refused with its reason while the record is saving, and then changes nothing

#### Scenario: Undo while the occurrence is being edited is refused

- **WHEN** an editor holds unsaved input for the occurrence produced by a verdict and the Lead activates Undo
- **THEN** Undo is refused with a request to save or cancel first, and the input is kept

#### Scenario: Undo after a later change is refused

- **WHEN** the Lead edits, moves or discusses the occurrence produced by a verdict and then activates Undo
- **THEN** Undo is refused with an explanation and the occurrence and the prior week stay unchanged
- **AND** Undo is also refused while that record's discussion holds typed or saved-draft reply text

#### Scenario: Occupancy is re-checked before an answer is applied

- **WHEN** the target week gains a record of the same plan before an answer, a move or an Undo is applied
- **THEN** the change is refused, the question stays open with the reason and the one working option, and no duplicate record is created

#### Scenario: A plan already in Next week asks before it is brought into This week

- **WHEN** the plan's record already sits in Next week, has no This week record, and the answer targets This week
- **THEN** an AlertDialog asks whether to bring that record into This week; the Next week record moves and no copy is made
- **AND** Cancel changes nothing and returns any typed reason to its field

#### Scenario: A typed reason survives Cancel and Escape

- **WHEN** the Lead cancels or presses Escape in a Paused or Won't do reason request that holds typed text
- **THEN** the text returns to its field or is kept for a moment with Undo, and is never discarded silently or overwritten by later text

### Requirement: Pending verdicts MUST be counted and MUST block submission

Carried plans whose record has no chosen status MUST count in the Submit count (`N to fix`) and MUST block Submit through the one blockers list. Unanswered plans without a record MUST NOT block Submit and MUST be sent as Not answered. Paused and postponed prior items MUST NOT count as pending.

#### Scenario: Submit with pending items

- **WHEN** two carried plans have no chosen status and the lead activates Submit
- **THEN** Submit shows `2 to fix` and is blocked, and the blockers list in `Before you submit` names both records
- **AND** after both have a status the count disappears and Submit is available under the remaining canonical eligibility checks

### Requirement: Suggested continuations MUST be confirmable together

When rollover has carried plans without a chosen status, the This week column header MUST provide one `Confirm all as Continue (N)` action that sets In progress on those records in a single save. It MUST NOT change a record whose status the Lead has chosen, and MUST NOT be shown when none is pending.

#### Scenario: Several continuations are pending

- **WHEN** four carried continuations have no chosen status and the lead activates `Confirm all as Continue`
- **THEN** all four are set to In progress in one save
- **AND** their `N to fix` count reaches zero

#### Scenario: A chosen status is kept

- **WHEN** one carried record already has status Done and the lead activates `Confirm all as Continue`
- **THEN** that record stays Done and only the untouched carried records change
