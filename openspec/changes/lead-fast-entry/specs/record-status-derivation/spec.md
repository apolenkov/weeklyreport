## MODIFIED Requirements

### Requirement: One stored progress vocabulary independent of week placement

`ItemWorkflowStatus` MUST remain the single stored progress source: `planned | in_progress | paused | postponed | done`. Current and Next MUST accept the same vocabulary. Current `planned` means Not started. The system MUST NOT store `blocked` on an Item or persist a separate completion flag. `paused` MUST retain a nonblank `pausedReason`; every non-paused status MUST clear it. Paused and postponed work MUST NOT feed blocked or at-risk escalation. Week placement, progress, derived alarm, and carried confirmation are independent dimensions.

For an eligible Current occurrence without a separate next commitment, `Move to next week` in the Lead Report Overview MUST be a placement-only postponement: saving moves that occurrence to Next, preserving stored progress and stable identity, clearing `carriedOver`, and leaving no duplicate Current occurrence. It MUST NOT synthesize `nextStepText`, set progress to `postponed`, or act as `Continue next week`. An existing explicit Next for the same `stableId` MUST prevent a duplicate move; the existing continuation/promotion path for an already stored `nextStepText` remains unchanged.

At rollover, an explicit next-period commitment MUST become Current `planned`; a fallback continuation of Current `in_progress` MUST remain `in_progress`. Both MUST be marked carried and unconfirmed until the lead explicitly updates the target occurrence. No other progress status is automatically activated.

#### Scenario: In-progress work moves to Next without changing progress

- **WHEN** an authorized lead saves `Move to next week` for an eligible Current `in_progress` item without a separate next commitment
- **THEN** validation, persistence, and projection accept the same occurrence as Next `in_progress`
- **AND** it no longer occupies Current, retains its text and `stableId`, clears `carriedOver`, and creates no duplicate
- **AND** `nextStepText` remains empty; the move does not record a Current result or choose a continuation verdict

#### Scenario: next item accepts only its vocabulary

- **WHEN** a save payload carries a Next item status
- **THEN** validation accepts exactly `planned`, `in_progress`, `paused`, `postponed`, or `done`
- **AND** it rejects alarms and unknown values

#### Scenario: paused work does not escalate

- **WHEN** a section contains only paused or postponed items and no risks
- **THEN** dashboard and product health show no escalation caused by those items

#### Scenario: carry-over stays planned until progress is confirmed

- **WHEN** automatic carry-over consumes an eligible Next item or Current next commitment
- **THEN** the created Current item is `planned`, carried, and unconfirmed
- **AND** it is not automatically changed to `in_progress`

#### Scenario: fallback continuation retains in-progress without confirming a result

- **WHEN** automatic carry-over continues a Current `in_progress` item that has no next commitment
- **THEN** the created Current item remains `in_progress`, carried, and unconfirmed
- **AND** the copied text is not counted as a confirmed result until the lead updates it

#### Scenario: Paused work keeps its reason across placement

- **WHEN** a paused item with a valid pause reason is moved explicitly between Current and Next
- **THEN** its status and pause reason are preserved

#### Scenario: Postponed work can be moved to Current explicitly

- **WHEN** an authorized lead moves a Next postponed item to Current
- **THEN** its postponed status is preserved until explicitly changed

#### Scenario: Risk-derived alarms do not become stored status

- **WHEN** an item with a covering risk moves between Current and Next
- **THEN** stored progress remains unchanged and the displayed alarm is derived again

#### Scenario: an explicit Next prevents a duplicate placement

- **GIVEN** a Current item and an explicit Next occurrence already share a `stableId`
- **WHEN** a placement-only move to Next is requested
- **THEN** the move cannot create or overwrite another Next occurrence
- **AND** at rollover the eligible explicit commitment wins over fallback Current continuation, producing at most one target occurrence

Code anchors at baseline `99d3651f2`: [move preserves progress and guards other placement](../../../../../apps/web/src/features/report-sections/model/lead-actions/lead-item-actions.ts#L21-L72), [move save regression](../../../../../apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.test.tsx#L1703-L1744), [existing next-step promotion boundary](../../../../../apps/web/src/features/report-pages/ui/lead/shell/overview-item-save.ts#L287-L300). This reconciles the move wording; it does not change rollover or the status enum.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic. The source-of-truth rollover and lifecycle contracts remain [carry-over-automation](../../../../specs/carry-over-automation/spec.md#L9-L76) and [period-dual-state](../../../../specs/period-dual-state/spec.md#L18-L33).
