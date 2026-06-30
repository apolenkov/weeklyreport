## ADDED Requirements

### Requirement: Reviewing Is a Capability on the Leadership Chain, Not a New Role

Review acts SHALL be authorized by the existing canonical `leadershipProcedure`
(head + admin + viewer; lead excluded) plus an in-handler group-scope check, and
MUST NOT introduce a new `Role` enum value or a new middleware-chain builder.

Because `Role` is single-valued per user, a `reviewer` role could not coexist with
a head who also reviews; reviewing is therefore modelled as a capability several
roles hold. The new `review.*` procedures MUST be built on `leadershipProcedure`
(one of the nine canonical builders) so the `role-coverage-gate` test stays green;
the reviewer-designation and group-scope rules are enforced INSIDE the handler, not
by a new chain. A `lead` session MUST be rejected by the chain for every review act.

#### Scenario: A lead cannot perform any review act

- **GIVEN** a `lead` session
- **WHEN** the lead calls any `review.*` procedure
- **THEN** the leadership chain rejects it as FORBIDDEN

#### Scenario: The role-coverage gate stays green

- **GIVEN** the new `review.*` procedures
- **WHEN** the `role-coverage-gate` test runs
- **THEN** every `review.*` procedure is built on a recognized canonical builder
- **AND** no new builder is added to the allow-list

### Requirement: Acknowledgement Is a Group-Level Seen Receipt for Any Access-Holder

Any head, admin, or viewer with access to a group SHALL be able to record a
group-level acknowledgement ("seen") for that group's report in the current period,
and this acknowledgement MUST require only access — never the reviewer designation.

An acknowledgement is one record per (acknowledger, group, period); re-acknowledging
is idempotent (upsert, refreshed timestamp). It carries no verdict and no comment.
The head MUST be able to see who has acknowledged. A viewer with no access to the
group MUST NOT be able to acknowledge it.

#### Scenario: A plain viewer acknowledges a report

- **GIVEN** a viewer with `ViewerGroupAccess` to group A and `canReview = false`
- **WHEN** the viewer acknowledges group A's current-period report
- **THEN** a seen receipt is recorded for that viewer, group, and period
- **AND** the head of group A can see that the viewer acknowledged

#### Scenario: Acknowledgement is idempotent

- **GIVEN** a viewer who has already acknowledged group A's current period
- **WHEN** the viewer acknowledges it again
- **THEN** the existing receipt's timestamp is refreshed
- **AND** no duplicate receipt is created

#### Scenario: A viewer cannot acknowledge a group it cannot access

- **GIVEN** a viewer with no `ViewerGroupAccess` to group B
- **WHEN** the viewer attempts to acknowledge group B's report
- **THEN** the procedure rejects it as FORBIDDEN

### Requirement: Verdict and Comments Require Reviewer Designation, Scoped Per Group

Posting a per-section verdict or a per-record comment SHALL require that the caller
is a designated reviewer FOR THE SECTION'S GROUP — the head of that group, an
admin, or a viewer whose `ViewerGroupAccess` for that group has `canReview = true`
— and MUST reject any caller who only has plain access.

The `canReview` grant is per-`ViewerGroupAccess` row, so a viewer designated for
group A MUST NOT be able to post a verdict or comment on group B. Designation is
checked in the handler against the group that owns the target section/record; head
and admin are designated implicitly (head for their own group, admin everywhere).

#### Scenario: A designated viewer posts a verdict

- **GIVEN** a viewer with `canReview = true` for group A
- **WHEN** the viewer posts a verdict on a group-A section
- **THEN** the verdict is recorded

#### Scenario: A head posts a verdict on their own group's section

- **GIVEN** a head of group A (a reviewer of their own group implicitly, with no
  `canReview` flag involved)
- **WHEN** the head posts a verdict on a group-A section
- **THEN** the verdict is recorded
- **AND** the implicit-designation path is exercised, distinct from the `canReview`
  path

#### Scenario: A plain viewer cannot post a verdict or comment

- **GIVEN** a viewer with access to group A but `canReview = false`
- **WHEN** the viewer attempts to post a verdict or a comment on a group-A section
- **THEN** the procedure rejects it as FORBIDDEN

#### Scenario: Reviewer designation does not cross groups

- **GIVEN** a viewer with `canReview = true` for group A only
- **WHEN** the viewer attempts to post a verdict or comment on a group-B section
- **THEN** the procedure rejects it as FORBIDDEN

### Requirement: A Comment Anchors to a Concrete Record

A review comment SHALL anchor to exactly one concrete record — an `Item`, `Risk`, or
`Decision` — and MUST carry the authoring reviewer's identity, so the lead sees
precisely which record is flagged.

Comments are flat (no reply threads in this change). A comment MUST be deleted when
its anchor record is deleted (cascade); it persists when the record is edited. The
comment author MAY be a non-human reviewer in a later change (a future AI review
agent uses the same record anchor); this change records only human reviewers.

#### Scenario: Reviewer comments on a specific item

- **GIVEN** a designated reviewer reading a group-A section
- **WHEN** the reviewer adds a comment anchored to a specific `Item`
- **THEN** the comment is stored against that item with the reviewer's identity
- **AND** the lead who authored the item can read it on that item

#### Scenario: A comment is removed with its record

- **GIVEN** an item carrying a reviewer comment
- **WHEN** the item is deleted
- **THEN** the comment is deleted with it (no orphan)

### Requirement: A changes_requested Verdict Auto-Un-Submits the Section, Race-Safe

A per-section verdict of `changes_requested` SHALL automatically un-submit a
currently-submitted section (`submitted → draft`, clearing `submittedAt`, stamping
the reviewer as the un-submitter) within a transaction that re-checks the section is
still `submitted`, using the existing `ReportSection.version` optimistic lock.

A verdict of `approved` MUST leave the section `submitted` (a reviewer may still
attach comments — soft feedback). `changes_requested` on a section that is already
`draft` MUST record the verdict and comments but un-submit nothing. The auto
un-submit MUST be the same state transition the head's existing revoke performs, so
the section returns to the lead's editable surface. Concurrent verdicts MUST be
race-safe: if the section is no longer `submitted` at commit time, the transaction
MUST NOT double-apply the transition.

#### Scenario: changes_requested returns a submitted section to draft

- **GIVEN** a designated reviewer viewing a `submitted` group-A section
- **WHEN** the reviewer posts a `changes_requested` verdict
- **THEN** the section becomes `draft` with `submittedAt` cleared
- **AND** the verdict records the reviewer as the un-submitter

#### Scenario: approved leaves the section submitted

- **GIVEN** a designated reviewer viewing a `submitted` section
- **WHEN** the reviewer posts an `approved` verdict with comments
- **THEN** the section stays `submitted`
- **AND** the comments are recorded on their anchor records

#### Scenario: changes_requested on a draft section un-submits nothing

- **GIVEN** a designated reviewer viewing a section already in `draft`
- **WHEN** the reviewer posts a `changes_requested` verdict
- **THEN** the verdict and any comments are recorded
- **AND** the section remains `draft` (no transition applied)

#### Scenario: Concurrent changes_requested does not double-transition

- **GIVEN** two designated reviewers posting `changes_requested` on the same
  `submitted` section at once
- **WHEN** both transactions run
- **THEN** the section ends `draft` exactly once
- **AND** the second transaction observes the section already non-`submitted` and
  does not re-apply the transition

### Requirement: Review Never Changes the Period Lifecycle

A review act SHALL never publish, lock, reopen, or archive a reporting period; its
only state effect is the section-level auto-un-submit, and the verdict/un-submit
acts MUST be rejected unless the period is editable (`open` or `reopened`).

`Publish & Lock` remains a head-only period-level document action, untouched by
this change. Acknowledgement and comments MAY be recorded while a period is
editable; a verdict that would un-submit a section MUST be rejected on a
`published` or `archived` period (such a period is reached only through a
period-level reopen first).

#### Scenario: A verdict is rejected on a published period

- **GIVEN** a `published` period
- **WHEN** a designated reviewer attempts a `changes_requested` verdict on one of
  its sections
- **THEN** the procedure rejects it (the period is not editable)

#### Scenario: Review does not expose publish to a reviewer

- **GIVEN** a designated viewer-reviewer
- **WHEN** the reviewer's review surface renders
- **THEN** no publish, lock, or period-lifecycle control is offered to them

### Requirement: A Returned Section and Its Comments Surface to the Lead In-App

The system SHALL surface a returned section and its comments to the authoring lead
in-app when a reviewer's `changes_requested` returns the section to `draft` — the
section is editable again and its per-record comments are visible on the lead's own
report surface — with no external notification required.

This change delivers feedback in-app only; Telegram / email delivery is out of
scope. The lead's surface MUST make the presence of reviewer comments noticeable
(for example, a count or marker on the affected records), so a returned section is
not silently dropped back to draft.

#### Scenario: Lead sees a returned section with comments

- **GIVEN** a lead whose submitted section was returned by a `changes_requested`
  verdict with two record comments
- **WHEN** the lead opens their report
- **THEN** the section is editable (`draft`) again
- **AND** the two reviewer comments are visible on their anchor records
- **AND** the presence of the comments is signalled on the lead's surface

### Requirement: A Verdict Is Bound to the Submission Instance It Judged

A `SectionReview` verdict SHALL record the submission instance it judged (the
section's `version` at verdict time) and MUST be treated as **current** only while
that recorded instance matches the section's current submission, so a re-submission
supersedes any prior verdict.

When a `changes_requested` verdict returns a section to draft and the lead later
re-submits, the section's `ReportSection.version` is bumped; the prior verdict's
recorded version then no longer matches, so it reads as stale and the head does NOT
see a freshly re-submitted section still flagged "needs changes". Staleness is
DERIVED from the recorded version — no separate clearing step — reusing the same
`ReportSection.version` the un-submit race-check relies on. A re-submitted section
with no newer verdict reads as awaiting a fresh review.

#### Scenario: Re-submission supersedes a prior verdict

- **GIVEN** a section returned by a `changes_requested` verdict, then edited and
  re-submitted by the lead
- **WHEN** the head views the re-submitted section
- **THEN** the prior `changes_requested` verdict reads as stale, not current
- **AND** the section shows as awaiting a fresh review, not "needs changes"

#### Scenario: A verdict on the unchanged current submission stays current

- **GIVEN** a section with an `approved` verdict and no re-submission since
- **WHEN** the head views the section
- **THEN** the verdict reads as current (its recorded version matches the section's)
