## ADDED Requirements

### Requirement: Shared SearchInput popup relationships resolve to mounted popups

Shared SearchInput MUST emit aria-controls only while its expanded popup is mounted, and that value MUST reference the existing popup ID. When the popup is unmounted, the relation MUST be omitted. The change MUST preserve existing popup identity, aria-expanded, scopes, result contents, debounce and navigation behavior.

#### Scenario: Search popup opens and closes

- **GIVEN** the shared SearchInput initially has no popup
- **WHEN** a valid query opens its popup and Escape later closes it
- **THEN** the expanded control references the mounted popup
- **AND** neither the initial nor escaped collapsed control has a dangling popup reference
- **AND** existing result selection and navigation behavior remain unchanged
