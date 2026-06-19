## ADDED Requirements

### Requirement: The lead slide hero sits at the same inset in every scope

The lead slide hero (status strip + scope toggle) MUST render at the same horizontal and vertical inset within the `.slide-frame` regardless of the active scope (Summary/own vs Product), so toggling scope never shifts the status strip or the scope toggle.

1. The hero's left inset and top offset relative to the `.slide-frame` MUST be
   identical (±1px) across scopes; the two scopes MUST NOT wrap the hero in
   wrappers with different padding.
2. Only the hero box position is unified — the per-scope CONTENT below the hero
   is unchanged (own scope shows the summary quadrants; product scope shows the
   product grid).

#### Scenario: Toggling Summary ↔ Product does not move the hero

- **WHEN** a lead in slides mode toggles the scope between Summary and Product
- **THEN** the status strip and scope toggle stay at the same on-screen position
- **AND** only the content area below the hero changes between the two scopes
