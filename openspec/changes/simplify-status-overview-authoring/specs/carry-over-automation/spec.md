## MODIFIED Requirements

### Requirement: Eligible unfinished prior-period work carries into a new period automatically

A lead's eligible unfinished prior-period Next work MUST carry into a new period automatically through `CarryOverService.executeCarryOver`. A manually moved Next occurrence remains eligible even if it was system-carried in an earlier Current period; moving to Next MUST clear its `carriedOver` marker because that move is an explicit author plan. Carry-over MUST create the target Current occurrence with `carriedOver: true`, preserve its stable identity, text, workflow status and priority rank, clear legacy `nextStepText`, and MUST NOT assert `In progress` or any other status. The marker MUST mean that the target Current occurrence awaits lead confirmation. Explicit confirmation or editing MUST clear the marker through the authorized canonical write path without changing other fields unless the lead edits them. Unconfirmed carried work MUST remain visible and MUST block submit completion.

Unresolved decisions (`resolvedAt: null`) MUST carry into the target section with the same stable lineage and `resolvedAt: null`; resolved decisions MUST NOT carry. Items and unresolved decisions MUST have their Product or Activity attached to the target. Published sources, editable-target and parent guards, execution records, per-section lineage uniqueness, retry/concurrency dedupe, and current-active-user filtering remain authoritative for both items and decisions.

#### Scenario: eligible unfinished work is carried without a head click

- **WHEN** a new period opens with eligible unfinished Next work in the prior period
- **THEN** one Current occurrence appears with the same stable identity, text, status and priority rank and with `carriedOver: true`
- **AND** no head action or automatic progress assertion occurs
- **AND** unresolved decisions appear open with their Product or Activity attached

#### Scenario: resolved decisions do not carry

- **WHEN** the authoritative predecessor contains both resolved and unresolved decisions
- **THEN** only unresolved decisions are created in the editable target with `resolvedAt: null`

#### Scenario: a missing decision parent receives no carried decision

- **WHEN** an unresolved source decision's Product or Activity is absent from the target
- **THEN** carry-over does not create that decision and does not abort other eligible records

#### Scenario: A lead confirms carried work

- **WHEN** the lead confirms an eligible carried Current occurrence without editing it
- **THEN** the authorized write clears only `carriedOver`
- **AND** reload and another authorized client observe the confirmed state
- **AND** retry is idempotent

#### Scenario: Unconfirmed carried work reaches submit

- **WHEN** an editable section contains a Current occurrence with `carriedOver: true`
- **THEN** submit guidance identifies the required confirmation
- **AND** submit cannot silently clear the marker or claim a confirmed weekly update

#### Scenario: Carried work is cancelled before confirmation

- **WHEN** the lead records an explicit terminal outcome for a carried Current occurrence
- **THEN** the authorized outcome transaction clears `carriedOver` with the outcome and audit event
- **AND** submit is not blocked by a stale confirmation marker
- **AND** a previously cancelled occurrence persisted with `carriedOver: true` may clear only that marker without weakening its resolution lock

#### Scenario: Work is moved through three consecutive periods

- **WHEN** work carried from period A to Current B is explicitly moved to Next B and period C opens
- **THEN** the move clears `carriedOver` in Next B and carry-over creates one unconfirmed Current occurrence in C
- **AND** text, status, priority, stable identity and history are preserved without duplicates

#### Scenario: finished prior work is not carried

- **WHEN** the prior-period occurrence is terminal under the canonical eligibility rules
- **THEN** it is not carried into the new period

#### Scenario: paused commitments remain suspended

- **WHEN** prior work is paused
- **THEN** automatic carry-over does not activate it
- **AND** explicit user action is required to resume it

#### Scenario: postponed prior work is replanned manually

- **WHEN** prior Next work is postponed
- **THEN** automatic carry-over does not activate it
- **AND** explicit user action is required to replan it

#### Scenario: a missing target parent receives no carried records

- **WHEN** the source item's Product or Activity is absent from the target section
- **THEN** carry-over creates no occurrence for that item

#### Scenario: re-establishing the section does not duplicate

- **WHEN** the target section is established or carry-over is retried
- **THEN** the existing execution and per-section lineage constraints prevent duplicate occurrences

#### Scenario: a submitted target is never overwritten

- **WHEN** the target section or period is not in an editable lifecycle tuple
- **THEN** carry-over writes nothing to that target

#### Scenario: published history targets only current active authors

- **WHEN** a published source includes removed or deactivated historical authors
- **THEN** carry-over creates target sections only for current active authors
- **AND** ineligible authors do not abort eligible authors

#### Scenario: no prior period carries nothing

- **WHEN** a period has no authoritative predecessor
- **THEN** no work is carried and no error is raised

#### Scenario: an explicit next step preserves the current result

- **WHEN** legacy source data contains a Current result and a distinct nextStepText
- **THEN** carry-over uses the future text for the new unconfirmed Current occurrence and preserves the source result in immutable history
- **AND** the target clears legacy nextStepText without losing either text
