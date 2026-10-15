## ADDED Requirements

### Requirement: Stand reset excludes backups of the database it resets

The tester stand reset MUST record the backup CronJob's suspension state, suspend it, and wait
for every running backup pod to finish before it stops the API or changes the database. If the
state cannot be read, or a backup is still running when the bounded wait ends, the reset MUST
stop before any database change. On every exit after suspending, the reset MUST restore the
recorded suspension state, and it MUST leave an already suspended CronJob suspended.

#### Scenario: Reset runs while no backup is active

- **WHEN** the operator resets the stand and no backup pod is running
- **THEN** the backup CronJob is suspended before `migrate-reset` and resumed after the reset ends

#### Scenario: A backup is still running

- **WHEN** a backup pod is still running after the bounded wait
- **THEN** the reset exits non-zero without scaling the API or running `migrate-reset`
- **AND** the backup CronJob returns to its recorded suspension state

#### Scenario: Backups were already suspended

- **WHEN** the backup CronJob was suspended before the reset
- **THEN** the reset leaves it suspended

#### Scenario: Suspension state is unreadable

- **WHEN** the reset cannot read the backup CronJob's suspension state
- **THEN** it exits non-zero before suspending backups, scaling the API or changing the database
