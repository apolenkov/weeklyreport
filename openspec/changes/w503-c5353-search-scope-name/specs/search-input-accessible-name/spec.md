## ADDED Requirements

### Requirement: The shared search control takes its accessible name from the scope

The shared `SearchInput` combobox MUST derive its accessible name from the
effective `scope`, not from a fixed string or the caller's `placeholder`. The
`all` scope MUST be named "Search reports and products", because it can return
product hits. The report scopes `mine` and `published` MUST be named "Search
reports". An overridden `placeholder` MUST NOT change either name.

#### Scenario: The products scope names products

- **WHEN** the shared search control renders with `scope="all"` and the products
  placeholder "Any product or report…"
- **THEN** its combobox accessible name is "Search reports and products"

#### Scenario: Report scopes keep the report name

- **WHEN** the shared search control renders with `scope="mine"` or
  `scope="published"`
- **THEN** its combobox accessible name is "Search reports"

#### Scenario: A caller placeholder does not rename the control

- **WHEN** a caller overrides the placeholder while the scope is unchanged
- **THEN** the combobox accessible name stays the scope's name
