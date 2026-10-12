## MODIFIED Requirements

### Requirement: Repeated controls carry unique accessible names

Controls repeated per lead or per record MUST have unique accessible names
that begin with the visible text (WCAG 2.5.3): the Period Summary expansion
control ("Details for <lead>" / "Less details for <lead>"), its "Request
changes from <lead>" action, the per-lead Remind control, the per-lead Revoke
control, and each record's review-comment submit button ("Comment on <record
excerpt>"). When a control's visible label changes to a transient state
(such as Remind's "Queued" or "Retry"), its accessible name MUST track the
current visible label, still prefixed by it.

#### Scenario: Two leads and two records are distinguishable by name

- **WHEN** the Period Summary lists two leads or a review page lists two
  records with comment composers
- **THEN** no two of these buttons share an accessible name

#### Scenario: A transient Remind state keeps the name in sync

- **WHEN** the head activates a lead's Remind control and the visible label
  changes to a confirmation or retry label
- **THEN** the accessible name begins with that new visible label followed by
  the lead name
- **AND** the existing live feedback message and its timing remain unchanged

### Requirement: The Blocked & At Risk dashboard block is collapsed by default

The `BlockedAtRiskTable` block on the head dashboard MUST start collapsed,
since the same blocked / at-risk content is reachable in the report below; it
stays an on-demand fast-triage peek the head expands rather than a
permanently expanded block claiming vertical space. It MUST remain expandable
when it has issues. While collapsed, its issue content MUST be excluded from
keyboard focus order and the accessibility tree (for example via `inert` and
`aria-hidden`), not merely clipped visually.

#### Scenario: the head opens the dashboard with blocked/at-risk issues present

- **WHEN** the head opens `/head/dashboard` and there are blocked or at-risk
  items
- **THEN** the Blocked & At Risk block renders collapsed (its trigger reports
  `aria-expanded="false"`)
- **AND** activating the trigger expands it to reveal the issue rows

#### Scenario: collapsed content is unreachable

- **WHEN** the Blocked & At Risk block is collapsed
- **THEN** its issue rows are not reachable by keyboard tab order
- **AND** they are not exposed to assistive technology until the trigger
  expands the block
