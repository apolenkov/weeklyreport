## Purpose

Verdicts on a report section must be tied to the exact version the reviewer judged, and guarded against concurrent re-submits.

## Requirements

### Requirement: Verdict authorization is rechecked inside the write transaction

The verdict transaction MUST lock the parent report and re-read the current
section author and reporting group before the version compare-and-set or
`SectionReview` upsert. It MUST resolve the reviewer's current role,
group-entitlement, and viewer designation from the database in that same
transaction. A service-level reviewer precheck is advisory only; a concurrent
group move, role change, or designation revocation MUST reject the verdict and
write neither a verdict nor an un-submit transition.

#### Scenario: Revoked reviewer cannot persist a stale verdict

- **WHEN** a reviewer loses the current database designation after the
  application precheck but before the verdict transaction reaches the write
- **THEN** the verdict is rejected and no `SectionReview` row or section-state
  transition is written

#### Scenario: Group ownership is resolved at write time

- **WHEN** the section's author is moved to another reporting group after the
  reviewer precheck
- **THEN** the transaction evaluates the new group and rejects a reviewer who
  is not entitled to that group

### Requirement: A verdict records the version the reviewer judged

A reviewer's verdict MUST record `judgedVersion` from the reviewer-supplied
`input.version` — the `ReportSection.version` the reviewer actually saw and
judged — not from a version the server re-reads after the reviewer decided.
The verdict result returned to the caller MUST report the same
`judgedVersion` that is persisted. The `judgedVersion` value feeds the
section read model's advisory `isCurrent` signal (`isCurrent` is true only
when `judgedVersion` equals the section's current version), so recording the
re-read server version instead of the judged version would let the signal read
"current" for content the reviewer never reviewed.

#### Scenario: judged version comes from the reviewer's input

- **WHEN** a reviewer posts a verdict for a section whose current version
  matches the version they judged
- **THEN** the persisted `SectionReview.judgedVersion` equals the
  reviewer-supplied `input.version`
- **AND** the verdict result returned to the caller reports the same
  `judgedVersion`

### Requirement: The verdict write is guarded by an optimistic version lock for every verdict value

A verdict write MUST enforce an optimistic `version` lock for BOTH verdict
values (`approved` and `changes_requested`), not only the `changes_requested`
un-submit path. When the reviewer-supplied `input.version` no longer matches
the section's current version at write time, the verdict MUST be rejected as a
concurrency conflict and NO `SectionReview` row may be created or updated. The
version check MUST be enforced atomically within the verdict write transaction,
so a lead re-submit that commits between the service's context read and the
verdict write cannot slip a stale-version verdict through. The rejection MUST
surface to the client as a conflict (a `CONFLICT` / 409 tRPC error) distinct
from a validation failure, so the client can reload the current version and
re-decide.

#### Scenario: an approved verdict on a re-submitted section is rejected

- **WHEN** a lead re-submits a section between the reviewer opening the report
  and clicking Approve, bumping the section version so the reviewer's judged
  version is stale
- **THEN** the `approved` verdict is rejected as a version conflict
- **AND** no `SectionReview` row is created or updated
- **AND** the head-facing `isCurrent` signal is never stamped against a version
  the reviewer did not judge

#### Scenario: a changes_requested verdict on a re-submitted section is rejected

- **WHEN** a reviewer posts `changes_requested` with a `version` that no longer
  matches the section's current version
- **THEN** the verdict is rejected as a version conflict
- **AND** no `SectionReview` row is written and the section is not un-submitted

#### Scenario: a verdict on the current version is recorded

- **WHEN** a reviewer posts a verdict whose `input.version` matches the
  section's current version
- **THEN** the `SectionReview` row is written with
  `judgedVersion === input.version`
- **AND** a `changes_requested` verdict on a still-submitted section un-submits
  it exactly once via the existing revoke transition
