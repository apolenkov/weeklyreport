## MODIFIED Requirements

### Requirement: The Lead report surface exposes a native Chat entry point

The Lead report context toolbar MUST render **Chat** immediately beside the existing **Agent review** placeholder. When global AI availability is `available`, Chat MUST be active and open the existing assistant surface. When availability is `not_configured`, unresolved, or cannot be read, Chat MUST remain visible but disabled and MUST explain in English that AI is not configured by an administrator. The control and chat surface MUST reuse the repository's existing report-toolbar, dialog/sheet/layout, typography, spacing, color, focus, busy, empty, and error patterns. Head, admin, viewer, print, and unrelated report surfaces MUST NOT gain an active assistant control in this change.

#### Scenario: Lead opens configured Chat from the report toolbar

- **WHEN** a Lead activates Chat while global AI availability is `available`
- **THEN** the report assistant surface opens without navigating to an unrelated application or losing the current report context
- **AND** the toolbar controls retain their established height and alignment

#### Scenario: Lead reaches Chat while AI is unconfigured

- **WHEN** global AI availability is `not_configured`
- **THEN** Chat remains visible but disabled with explanatory copy
- **AND** the web client sends no assistant request

#### Scenario: Availability has not been confirmed

- **WHEN** the authenticated availability query is loading or returns an error
- **THEN** Chat remains visible but disabled and the web client sends no assistant request

#### Scenario: A non-Lead reaches the assistant procedure

- **WHEN** a head, admin, viewer, or unauthenticated caller invokes the report-assistant tRPC procedure
- **THEN** the canonical role middleware rejects the request before assistant retrieval runs
