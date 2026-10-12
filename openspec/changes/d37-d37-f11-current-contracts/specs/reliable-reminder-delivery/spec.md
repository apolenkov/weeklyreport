# Spec Delta

## MODIFIED Requirements

### Requirement: Deadline content freezes the rule deadline

A deadline reminder's persisted payload MUST copy the owning
version's immutable `ReminderRule.deadline`. A live execution guard MUST prove
that this rule version still matches the current `Report.deadline` and active
policy before inserting or reviving an execution. Historical executions remain
valid after a later report deadline or policy edit because their rule version
is never rewritten. `ReminderRule.fireAt` remains the schedule and dedupe cycle
source. Email subject, preview, and body MUST NOT claim a fixed 24-hour offset
because reminder policies permit arbitrary offsets. The content MUST state the
exact frozen deadline or use neutral reminder wording.

Reminder policy admission MUST constrain signed `offsetMinutes` to the PostgreSQL INTEGER storage range before the admin save or snapshot restore consumer attempts persistence. This representation bound MUST preserve negative, zero and positive offsets; it adds no smaller business timing limit.

#### Scenario: A non-24-hour policy dispatches

- **GIVEN** a deadline rule whose `fireAt` is not 24 hours before the report
  deadline
- **WHEN** its execution and email are created
- **THEN** `scheduledFor` equals `rule.fireAt`
- **AND** `deadlineIso` equals the locked rule version's `deadline`, which was
  current for the report at execution creation
- **AND** no subject, preview, or body claims that 24 hours remain

#### Scenario: Signed storage boundaries remain valid

- **WHEN** a reminder policy supplies offsetMinutes of -2147483648 or 2147483647
- **THEN** shared policy validation accepts the offset
- **AND** negative, zero and positive integer offsets within that range remain valid

#### Scenario: An unrepresentable offset is rejected before persistence

- **WHEN** a reminder policy supplies offsetMinutes of -2147483649, 2147483648 or a noninteger
- **THEN** shared policy validation rejects it with an issue at offsetMinutes
