# agent-review Specification

## ADDED Requirements

### Requirement: The Section-Reviews Strip Offers An Agent-Review Affordance

The Section-reviews strip MUST present an Agent-review affordance beside the
human verdict control, so an agent can be asked to review a section — the strip
is `section-review-strip.tsx`, now hosted on `/head/dashboard`. Because the agent
invocation is not yet built, this affordance MUST render as the inert
`AgentReviewComingSoon` control wrapping a `ComingSoonBadge`, per the
`deferred-feature-pattern` convention, and MUST NOT be hidden behind a runtime
feature flag. Grounded in HF7.

#### Scenario: The strip shows an inert Agent-review control

- **GIVEN** a head opens `/head/dashboard` with the relocated Section-reviews
  strip
- **WHEN** a strip row renders for a reviewable section
- **THEN** an Agent-review control is present rendered as `AgentReviewComingSoon`
  with its coming-soon tooltip, and no runtime feature flag controls its
  visibility

#### Scenario: The Agent-review control performs no action

- **GIVEN** the inert Agent-review control on a strip row
- **WHEN** a head activates it
- **THEN** no review is produced and no section state changes, because the
  agent-invocation path is deferred

### Requirement: An Agent Review Is Inert Until A Human Confirms It

An agent review of a section MUST be recorded as a **proposal** that has no
downstream effect of any kind until a designated human reviewer confirms it.
While a proposal is unconfirmed it MUST NOT un-submit or otherwise change the
section's status, MUST NOT count as a current verdict (`isCurrent`), MUST NOT
appear in the section's resolved verdict badge, MUST NOT be included in the
head submission-dashboard counts (`review.dashboard`), and MUST NOT feed a
reopen. The agent _judges_; a human _always_ confirms. Grounded in HF8.

#### Scenario: An unconfirmed changes-requested proposal changes nothing

- **GIVEN** a submitted section at version N and an agent proposal of
  `changes_requested` judged at version N that no human has confirmed
- **WHEN** the section read model and the head submission dashboard are computed
- **THEN** the section stays `submitted`, its verdict badge reads as though no
  agent verdict exists, `toReviewViews` yields no current agent verdict, and the
  submission-dashboard count is unchanged

#### Scenario: Confirmation applies the verdict effect

- **GIVEN** the same unconfirmed `changes_requested` proposal judged at the
  section's current version
- **WHEN** a designated human reviewer confirms it
- **THEN** the section's `changes_requested` effect is applied exactly as a
  direct human verdict would apply it (a still-submitted section is un-submitted
  to `draft`), and the confirmed verdict now surfaces on the section

#### Scenario: An unconfirmed proposal cannot feed a reopen

- **GIVEN** an unconfirmed agent proposal on a section
- **WHEN** any reopen-related read or count runs
- **THEN** the proposal contributes nothing, because only a confirmed,
  human-decided action can reach the reopen lifecycle

### Requirement: Confirmation Rides The Human Reviewer Authz And The Agent Never Bypasses The Lifecycle

The confirm and dismiss procedures for an agent proposal MUST be built on a
canonical middleware-chain builder (`leadershipProcedure`, matched by reference
identity for the `role-coverage-gate`) and MUST enforce the same reviewer
designation a direct human verdict enforces (`isDesignatedReviewer` for the
section's group, on an editable period). The agent holds no session and no role,
so it MUST be structurally incapable of invoking any confirm, un-submit, publish,
or reopen-decision procedure — it can only produce a proposal a human then acts
on.

#### Scenario: A designated reviewer confirms

- **GIVEN** a head of group A (a designated reviewer) and a proposal on a group-A
  section on an editable period
- **WHEN** they call the confirm procedure through `leadershipProcedure`
- **THEN** the confirmation succeeds and the verdict effect is applied

#### Scenario: A non-reviewer is forbidden

- **GIVEN** a viewer with `canReview = false` for the section's group
- **WHEN** they call the confirm or dismiss procedure for that section's proposal
- **THEN** the call is rejected with a forbidden error and no state changes

#### Scenario: The agent cannot decide a reopen request

- **GIVEN** the reopen-request lifecycle gated to `head` and `admin`
  (`reopen-requests`)
- **WHEN** any agent output exists for a section under a pending reopen request
- **THEN** the agent output alone never approves, rejects, or otherwise decides
  the request; only a head or admin session decides it

### Requirement: A Stale Agent Proposal Cannot Be Confirmed

Confirmation MUST be rejected when the section version has advanced past the
version the agent proposal judged (`judgedVersion`) — i.e. the lead re-submitted
after the agent judged — mirroring the existing
`isCurrent = judgedVersion === version` staleness rule so a human never applies a
verdict the agent formed against superseded content.

#### Scenario: Re-submission staleness blocks confirmation

- **GIVEN** an agent proposal judged at version N and a section the lead has
  since re-submitted to version N+1
- **WHEN** a designated reviewer attempts to confirm the proposal
- **THEN** the confirmation is rejected (or the proposal is auto-dismissed as
  stale) and no verdict effect is applied to the current version

### Requirement: A Confirmed Agent Verdict Preserves Agent Attribution

Confirming an agent proposal MUST preserve the agent as the _author_ of the
verdict and record the confirming human as the _confirmer_, so the audit trail
shows both. The confirmed verdict MUST NOT be silently rewritten to look like a
verdict the human authored directly.

#### Scenario: The confirmed verdict carries both actors

- **GIVEN** an agent proposal produced by agent model `M`
- **WHEN** human `H` confirms it
- **THEN** the resulting verdict records author = agent `M` and confirmer = `H`,
  and both are available to the section read model for display

### Requirement: The Agent-Invocation And Confirmation Backends Are Deferred With A Loud Stub

Every deferred agent-review backend entry point MUST throw
`new Error('Not implemented — see TODO(AGENT-REVIEW-01)')` until the agent
invocation is built — the agent-invocation procedure and, while unbuilt, the
confirm/dismiss procedures — with a matching
`TODO(AGENT-REVIEW-01)` marker at the activation point, per the
`deferred-feature-pattern` backend requirement. A deferred path MUST NOT silently
return mock or empty data.

#### Scenario: The deferred agent-invocation procedure throws the loud stub

- **GIVEN** the deferred agent-review invocation entry point
- **WHEN** a caller invokes it
- **THEN** it throws `new Error('Not implemented — see TODO(AGENT-REVIEW-01)')`
  and returns no mocked review

#### Scenario: The activation marker exists in source

- **GIVEN** the deferred agent-review backend
- **WHEN** the source is inspected
- **THEN** a `TODO(AGENT-REVIEW-01)` marker sits at the activation point that the
  loud stub references
