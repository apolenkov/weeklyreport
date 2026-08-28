## ADDED Requirements

### Requirement: Catalog intent prose cannot invent product or data behavior

Every generated or edited scenario under `e2e/catalog/*.yaml` MUST be reviewed
against the live role route and its durable product, authorization, and data
contracts. A catalog intent MUST NOT invent a control, response field,
persistence field, data-retention obligation, or access boundary that is absent
from both the implemented surface and an accepted OpenSpec change. The catalog
review MUST reject such prose instead of turning it into an implicit product
requirement.

#### Scenario: Generated prose names an unsupported data field

- **WHEN** generated scenario prose asks a route to display or copy a field that
  neither the current route contract nor an accepted OpenSpec change defines
- **THEN** the scenario is rejected or corrected during review
- **AND** the unsupported field is not implemented solely to make the generated
  catalog appear accurate

#### Scenario: The Action Log catalog is reconciled

- **WHEN** `admin-actions-view` describes expandable and copyable event details
- **THEN** it names the whitelisted `admin.actionLog.list` metadata rather than
  a raw mutation, request, or response payload
- **AND** its search and cursor-pagination prose matches the observable `/admin`
  Action Log behavior
