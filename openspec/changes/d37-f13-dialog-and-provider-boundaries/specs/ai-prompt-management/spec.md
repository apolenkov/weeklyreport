## MODIFIED Requirements

### Requirement: Prompt administration is safe and observable

The `admin.aiPrompts` read, draft, activate, restore, and discard procedures
MUST use the canonical admin middleware chain. Read models MAY expose complete
prompt text, lifecycle, history, and whether a revision is current-serving,
incompatible, but MUST NOT expose credentials, provider bodies,
report data, questions, or generated answers through logs, metrics, or audit
payloads. Lifecycle metrics MUST use bounded feature/operation/outcome labels
and MUST NOT use revision IDs, hashes, or prompt text as labels. The settings UI
MUST describe direct activation of the current editor prompt and MUST NOT offer
an incompatible history row as an activation candidate.

#### Scenario: A non-admin invokes prompt management

- **WHEN** a lead, head, viewer, or unauthenticated caller invokes an
  `admin.aiPrompts` procedure
- **THEN** canonical role middleware rejects the request before prompt or
  provider data is read

#### Scenario: A safe lifecycle transition is audited

- **WHEN** an administrator drafts, activates, restores, or discards
  a prompt revision
- **THEN** the audit event contains only safe actor/feature/revision/transition
  metadata and the bounded metric contains no prompt or provider payload

#### Scenario: Pending discard remains observable

- **WHEN** an administrator confirms discard of an eligible draft or failed prompt
- **THEN** the action remains visible with disabled pending feedback until settlement; active, superseded and incompatible selections stay ineligible
