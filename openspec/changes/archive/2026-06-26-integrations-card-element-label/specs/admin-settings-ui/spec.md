# admin-settings-ui Specification (delta)

## MODIFIED Requirements

### Requirement: Integrations Sub-Tab Surfaces Only Roadmapped Integrations

The Integrations sub-tab MUST list only integrations that are real or
roadmapped, and MUST NOT render a card for an integration that has been dropped
from the roadmap. Every listed integration that is not yet activated MUST use the
shared Coming-Soon affordance. The messaging-integration card MUST display the
planned channel name **Element**; the displayed name is decoupled from the
not-yet-built transport, so the Element card MUST NOT render any Telegram-derived
live status (the `admin.integrationsStatus` Telegram fields describe the internal
Telegram transport and MUST NOT surface under the Element name). The Element card
is heading + description + Coming-Soon badge; it asserts no messaging status.

#### Scenario: Slack and CI cards are absent

- **WHEN** an admin opens the Integrations sub-tab
- **THEN** no "Slack" card and no "CI Integration" card are rendered
- **AND** the `admin.integrationsStatus` payload contains no `ci` field

#### Scenario: Element and AI cards are present as Coming-Soon

- **WHEN** an admin opens the Integrations sub-tab
- **THEN** a card headed "Element" is rendered (not "Telegram") with a
  description and a Coming-Soon badge
- **AND** an "AI" card is rendered describing a provider/model selection applied
  to all AI features (summary, risk extraction, RAG) and carries a Coming-Soon
  badge

#### Scenario: the Element card renders no Telegram-derived status

- **WHEN** an admin opens the Integrations sub-tab and the Telegram transport is
  configured with active bindings (`admin.integrationsStatus` reports
  configured/bindings)
- **THEN** the "Element" card does NOT show those Telegram-derived "configured" /
  "active bindings" values — it renders no live messaging status under the
  Element name
- **AND** the card asserts no active/working messaging status (heading +
  description + Coming-Soon badge only)
