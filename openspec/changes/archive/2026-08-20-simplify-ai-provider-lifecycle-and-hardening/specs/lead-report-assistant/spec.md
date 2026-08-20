## MODIFIED Requirements

### Requirement: The Lead report surface exposes a native Chat entry point

The Lead report context toolbar MUST render **Chat** immediately beside the
existing **Agent review** placeholder. When the typed global AI availability
query has confirmed `available`, Chat MUST be active and open the existing
assistant surface. When availability is `not_configured`, loading, missing, or
cannot be read, Chat MUST remain visible but disabled and MUST explain in
English that AI is not configured by an administrator. The component MUST NOT
synthesize an available response for a missing procedure or test fixture. The
control and chat surface MUST reuse the repository's existing report-toolbar,
dialog/sheet/layout, typography, spacing, color, focus, busy, empty, and error
patterns. Head, admin, viewer, print, and unrelated report surfaces MUST NOT
gain an active assistant control in this change.

#### Scenario: Availability is unresolved or unavailable

- **WHEN** the availability query is loading, errors, returns no data, or
  returns `not_configured`
- **THEN** Chat remains visible and disabled
- **AND** the web client sends no assistant request

### Requirement: The assistant uses one code-owned structured answer protocol

The report-assistant runtime MUST use the fixed server-owned structured-answer
protocol for answer and citation-repair requests. Provider configuration and
test results MUST NOT expose a protocol selector or negotiate a JSON Schema
fallback. Tool schemas, authorization, retrieval limits, aggregates, and
output validation remain server-owned and MUST NOT be editable through prompt
lifecycle operations.

#### Scenario: A provider serves a grounded answer

- **WHEN** the runtime resolves a valid active provider and current prompt
  bundle
- **THEN** answer and citation-repair requests use the same fixed structured
  contract and server validation
- **AND** no persisted protocol-selection field is consulted
