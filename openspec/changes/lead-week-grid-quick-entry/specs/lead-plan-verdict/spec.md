## MODIFIED Requirements

### Requirement: Pending verdicts MUST be counted and MUST block submission

Carried plans whose record has no chosen status MUST count in `N to fix` and MUST block Submit through the one blockers list. Unanswered plans without a record MUST NOT block Submit and MUST be sent as Not answered. Paused and postponed prior items MUST NOT count as pending.

#### Scenario: Submit with pending items

- **WHEN** two carried plans have no chosen status and the lead activates Submit
- **THEN** Submit shows `2 to fix` and is blocked, and the blockers list in `Before you submit` names both records
- **AND** after both have a status the count disappears and Submit is available under the remaining canonical eligibility checks

### Requirement: Each prior-week planned item MUST receive one verdict in one action

For every prior-week planned item the Lead can still decide, the status menu of its plan line MUST offer Done, In progress (the existing Continue verdict), Next week, Paused… and Won’t do…, with no separate answer buttons. Done, In progress and Next week MUST record in one activation. Paused… and Won’t do… MUST ask one line of reason in the row. Each plan MUST receive one answer, and the plan text MUST NOT change.

#### Scenario: A planned item is marked done

- **WHEN** the lead chooses `Done` in the plan's status menu
- **THEN** the This week occurrence for the same `stableId` is created or updated with status done
- **AND** the prior week item, its text and its published snapshot are unchanged
- **AND** the plan line is replaced by that record on the same row, and `Marked Done in This week.` is announced with an Undo

#### Scenario: A planned item continues in progress

- **WHEN** the lead chooses `In progress`
- **THEN** the This week occurrence is created or kept as in progress under the same stableId, with no copy
- **AND** `Kept in This week as In progress.` is announced with an Undo

#### Scenario: A planned item is paused

- **WHEN** the lead chooses `Paused…`
- **THEN** a one-line reason is requested in the row with Save and Cancel, and an empty reason is refused
- **AND** on Save the This week occurrence for that `stableId` is saved as paused with that reason, and no `blocked` wording is used

#### Scenario: A planned item is closed as Won’t do

- **WHEN** the lead chooses `Won’t do…` and saves a reason
- **THEN** the work is closed through the existing outcome command with its audit event, and the This week record shows `Won’t do` with the reason
- **AND** `Closed as Won’t do. You can restore it until you submit.` is announced

#### Scenario: A planned item moves to next week

- **WHEN** the lead chooses `Next week`
- **THEN** exactly one Next week occurrence exists for that `stableId` afterwards, with no status shown
- **AND** an already existing explicit Next commitment is not duplicated
- **AND** `Moved to Next week.` is announced and the open tab does not change

#### Scenario: Next week is unavailable when a next step is saved

- **WHEN** the carried record of a plan already holds a saved next step
- **THEN** `Next week` stays in its status menu, aria-disabled, with `Its next step is already planned in Next week. Edit the next step instead`
- **AND** choosing it changes nothing

#### Scenario: A repeated activation does not answer the next plan

- **WHEN** the lead activates a menu item and activates again at the same position while the line updates
- **THEN** only the first answer is recorded and the next plan still awaits its answer

## REMOVED Requirements

### Requirement: Suggested continuations MUST be confirmable together

**Reason**: Mockup v2.5 removes the answer button group and `Confirm all as Continue`. Each carried record is answered through its own status icon, so one action no longer sets In progress on several records at once.
**Migration**: Use "An unanswered plan is one line like any record" and "Pending verdicts MUST be counted and MUST block submission": a carried record counts in `N to fix` until its status is chosen.

## ADDED Requirements

### Requirement: A frozen prior commitment can be continued without rewriting history

Previously planned MUST remain read-only. Eligible prior work MUST be continuable in This week through the existing verdict and continuation owners, without rewriting a prior record or snapshot, duplicating a stableId or silently overwriting a conflicting continuation. Existing eligible verdicts and reason requirements remain available.

#### Scenario: Continue a previous commitment already carried forward

- **WHEN** a prior commitment already has a carried This week occurrence and the Lead chooses In progress or sets its status
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

### Requirement: An unanswered plan is one line like any record

An unanswered plan MUST appear on its work item's row in This week as one line: a question-mark status icon, its published text and its stage icons. It MUST NOT show answer buttons, a `Planned last week` label, a `from plan` badge or a second question text, and its text MUST NOT be editable. A plan with no record is a non-blocking reminder; a carried record that needs a status is a blocker.

#### Scenario: A plan is one line

- **WHEN** the previous report planned a work item for this week and This week has no record of it
- **THEN** its row shows one line in This week named `Planned last week: <text>`, with a status icon named `Choose outcome: <text>. Planned last week, no outcome yet` and tooltip `Planned last week. Choose what happened`
- **AND** no answer button, badge or repeated phrase is shown and the text is not a control

#### Scenario: An answered plan keeps its row

- **WHEN** the lead answers Done, In progress, Paused… or Won’t do
- **THEN** the record takes the plan's place on the same row, and when the row has a Last week result both start within 2 CSS pixels of each other
- **WHEN** the lead answers Next week
- **THEN** This week shows `—` for that row and the plan sits in Next week on the same row

#### Scenario: Unanswered plans are a non-blocking pointer

- **WHEN** a prior-week plan has no answer and is not a carried continuation
- **THEN** the This week column header shows an `N plans to answer` link that moves focus to the first such status icon
- **AND** the link does not block Submit, and `Before you submit` states that unanswered plans are sent as Not answered

#### Scenario: Submitted report shows Not answered

- **WHEN** the report is submitted or read-only
- **THEN** the plan line has no answer control, its icon is named `No outcome`, and it reads `Not answered`
- **AND** while the report is editable no `Not answered` text is shown

#### Scenario: All plans are answered

- **WHEN** no prior-week plan awaits an answer
- **THEN** the This week header shows `plans answered` and no `plans to answer` link, and each answered plan keeps its record on its row

#### Scenario: A carried continuation is not yet confirmed

- **WHEN** rollover has carried a prior plan into This week without a chosen status
- **THEN** its record shows a question-mark status named `Status not set` and the marker `Needs status`, and no separate plan line is shown
- **AND** choosing any outcome in its status menu answers the plan, and until every such record has a status Submit stays blocked and the record counts in `N to fix`

#### Scenario: A result without commitment gets no verdict

- **WHEN** a prior-week result carries no commitment for the selected week
- **THEN** its row shows no plan line and no answer control

### Requirement: An answer re-checks the target week and can be undone

Before every answer, move or Undo the target week MUST be checked again for a record of the same work, so one plan receives one answer and no duplicate is created. A refused answer MUST keep the plan open and state the reason. Undo of an answer MUST follow the one Undo rule of `lead-overview-save-safety` and is saved like any change. The prior snapshot MUST stay unchanged byte for byte.

#### Scenario: Occupancy is re-checked before an answer is applied

- **WHEN** the target week gains a record of the same plan between opening the menu and choosing an item
- **THEN** the change is refused, the plan stays open with the reason and the one working option, and no duplicate record is created
- **AND** the prior week snapshot is unchanged

#### Scenario: A plan already in Next week asks before it is brought into This week

- **WHEN** the plan's record already sits in Next week, has no This week record, and the answer targets This week
- **THEN** an AlertDialog `Already planned in Next week` asks whether to bring that record into This week; the Next week record moves and no copy is made
- **AND** Cancel changes nothing and returns any typed reason to its field

#### Scenario: This week gained the record meanwhile

- **WHEN** the lead chooses an answer and This week already holds a record of that plan
- **THEN** an AlertDialog `Already in This week` states `Nothing was moved: This week already has this item.` and offers `Use the This week item`
- **AND** the Next week item stays as the plan

#### Scenario: A typed reason survives Cancel and Escape

- **WHEN** the Lead cancels or presses Escape in a Paused or Won’t do reason request that holds typed text
- **THEN** the text returns to its field or is kept for a moment with Undo, and is never discarded silently or overwritten by later text

#### Scenario: Undo is offered only after confirmation

- **WHEN** an answer has been recorded
- **THEN** Undo restores the record the answer changed, or removes the record the answer created, only after its save is confirmed and only while the record still matches the version that answer produced
- **AND** Undo is refused with its reason while the record is saving, while any editor is open, after a later change to the same work, while its discussion has an unsent reply, or when the restore would enter an occupied week, and then changes nothing
