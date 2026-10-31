# lead-plan-verdict Specification

## Purpose

Defines the one-action verdict a lead gives to every prior-week item that was planned for the selected week, and how that verdict is recorded without ever changing the prior week.

## Requirements

### Requirement: Each prior-week planned item MUST receive one verdict in one action

For every item shown in Previously planned that the lead can still decide, the Lead Report Overview MUST offer these verdicts, each reachable in one activation: `Done`, `Continue` (keep it in Current week), `Next week`, and `Paused` (requires a one-line reason). `Won't do` MUST be available in the item's overflow menu and requires its existing reason. Verdict controls MUST be identifiable by icon with an accessible name that states the verdict and the item text, and MUST NOT rely on color alone. Verdicts apply only to items that were planned for the selected week; the column MUST NOT ask for a verdict on prior-week results that carry no commitment for the selected week.

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

### Requirement: Verdicts MUST be recorded without editing the prior week

A verdict MUST be stored on the selected week's occurrence keyed by `stableId`, using the existing item save path when a linked Current or Next occurrence already exists, and the existing prior-plan outcome command when none exists. A verdict MUST NOT add a mutation to the previous period, MUST honor the weekly-cycle rollover rule of at most one active next-week item per `stableId`, and MUST preserve the item's stages, tag and priority.

#### Scenario: A carried continuation already exists

- **WHEN** rollover has already created a carried Current occurrence for the item and the lead gives a verdict
- **THEN** that occurrence is updated and no second occurrence is created
- **AND** its unconfirmed marker is cleared

#### Scenario: No occurrence exists in the selected week

- **WHEN** the item has no Current or Next occurrence and the lead gives a verdict
- **THEN** the verdict is recorded through the prior-plan outcome command with its audit event
- **AND** retries do not create duplicates

### Requirement: Suggested continuations MUST be confirmable together

When rollover has suggested continuations, the Overview MUST provide one `Confirm all as continue` action that clears their unconfirmed markers in a single save. It MUST NOT change items that already carry an explicit verdict, and MUST be unavailable when no suggested continuation is pending.

#### Scenario: Several continuations are pending

- **WHEN** four carried continuations are unconfirmed and the lead activates `Confirm all as continue`
- **THEN** all four are confirmed in one save
- **AND** the review counter reaches zero

### Requirement: Pending verdicts MUST be counted and MUST block submission

Unconfirmed suggested continuations MUST count as pending review. Lead Report completion actions MUST show `n to review` above zero and block Submit through the existing unconfirmed-carried-item rule. The count MUST work in header and non-overlay rail presentations without requiring Save. Paused and postponed prior items MUST NOT count as pending.

#### Scenario: Submit with pending items

- **WHEN** two suggested continuations remain unconfirmed
- **THEN** completion actions show `2 to review` and Submit is blocked with the existing explanation
- **AND** after both are confirmed the counter disappears and Submit becomes available under the remaining canonical eligibility checks
- **AND** no permanent Save control or fixed overlay is required to review them

### Requirement: The composer parent section stays open after choosing a Parent

In the plan outcome composer the "Parent and stages" section MUST open when the
parent is unresolved at open time, and MUST NOT close because a Parent was chosen.
After that it follows the user's own toggling.

#### Scenario: Choosing a Parent reveals the stage choice

- **GIVEN** the composer is open with an unresolved parent and the section expanded
- **WHEN** the lead selects a product Parent
- **THEN** the "Parent and stages" section remains open
- **AND** the stage selection is visible

#### Scenario: Manual collapse is respected

- **GIVEN** the section is open
- **WHEN** the lead collapses it and then changes the Parent
- **THEN** the section stays collapsed
