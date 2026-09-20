# Spec Delta

## MODIFIED Requirements

### Requirement: Tracked work MUST remain accountable across period boundaries

The system MUST distinguish stable task identity, author-confirmed weekly results, and next-period commitments. At a period boundary an explicit next commitment MUST take precedence and appear once as Current planned work; otherwise unfinished Current in-progress work MUST remain discoverable once as a carried, unconfirmed Current continuation. Rollover MUST NOT present either case as a newly confirmed weekly result. Unstarted planned work without an explicit commitment MUST become a derived automatically paused entry in Paused work, outside the active columns. Existing paused work MUST retain its reason and require explicit resumption. Postponed, resolved, and terminal work MUST remain historical and outside automatic active carry-over. The prior occurrence and published snapshot MUST remain immutable.

#### Scenario: Partial delivery and next step coexist

- **WHEN** the author reports API delivery and plans testing for the same task
- **THEN** both the current result and next commitment are persisted independently
- **AND** rollover creates one planned target occurrence for testing, not two tasks or a duplicate result

#### Scenario: unfinished work has no new commitment

- **WHEN** the latest eligible occurrence is Current and in progress with no next commitment
- **THEN** rollover creates one carried in-progress continuation marked unconfirmed
- **AND** reporting for the new week does not count its copied text as an author-confirmed result

#### Scenario: unstarted work was not scheduled for the new week

- **WHEN** the latest eligible occurrence is Current and planned with no next commitment
- **THEN** the active Current column contains no new occurrence for it
- **AND** Paused work shows it once with the automatic reason that it was not scheduled for the new week

#### Scenario: A paused task crosses a reporting gap

- **WHEN** a paused task has no new update for two periods
- **THEN** it remains discoverable with its last confirmed state and pause reason
- **AND** opening a later report does not resume it or create an active occurrence

#### Scenario: A deferred task is replanned

- **WHEN** the author replans a deferred task after multiple periods
- **THEN** the new commitment retains the original task identity and history
- **AND** the published predecessor is unchanged and retries cannot create duplicates

#### Scenario: A historical source is no longer the latest occurrence

- **WHEN** a newer submitted or published occurrence exists before the target period
- **THEN** a command using the older occurrence is rejected without changing target or audit
- **AND** a malformed published snapshot prevents fallback to mutable live rows

#### Scenario: An author explicitly reopens terminal historical work

- **WHEN** the author chooses the latest completed or cancelled historical occurrence
- **THEN** explicit replanning may create a new occurrence with the same lineage
- **AND** terminal work remains separate from automatic carry-over

#### Scenario: A prior promise is reviewed but not completed

- **WHEN** the author postpones or continues a prior promise
- **THEN** it may count as reviewed but MUST NOT count as completed
- **AND** promises with no confirmed outcome remain visibly unresolved
