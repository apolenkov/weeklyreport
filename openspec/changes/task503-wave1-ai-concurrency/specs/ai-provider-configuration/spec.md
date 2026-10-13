## ADDED Requirements

### Requirement: Concurrent preparation preserves ownership

Preparation start MUST atomically compare the observed revision state before
resetting progress. Subsequent progress, completion and failure callbacks MUST
only write to their own unfinished preparation. A stale callback MUST NOT reset
an activated revision's readiness or lifecycle, and a rejected claim MUST return
a controlled conflict without starting inference. Ownership MUST remain distinct
when retries share a timestamp or the wall clock moves backwards.

#### Scenario: A duplicate activation starts after another activation finishes

- **WHEN** two activations read the same validated revision and one finishes preparation and activates it before the other's start write
- **THEN** the stale start fails with a controlled conflict
- **AND** the active pointer, active lifecycle, completed readiness and availability remain those of the winner

#### Scenario: An older preparation callback returns after ownership changes

- **WHEN** a newer preparation owns the revision or activation has completed
- **THEN** an older progress, completion or failure callback cannot alter its readiness or lifecycle

### Requirement: Capability results preserve the current serving lifecycle

Capability-result persistence MUST serialize with revision lifecycle transitions
and preserve the current active, superseded or preparing lifecycle. It MUST NOT
restore a lifecycle read before provider work. The exact execution id, attempt,
running state and provider revision CAS MUST remain in force.

#### Scenario: An active revision's capability retest completes after another revision activates

- **WHEN** retest A reads active lifecycle, B activates and supersedes A, then the claimed retest A completes
- **THEN** A remains superseded and B remains the sole active revision and global pointer
- **AND** the exact current execution claim can persist its bounded capability evidence without resurrecting A
