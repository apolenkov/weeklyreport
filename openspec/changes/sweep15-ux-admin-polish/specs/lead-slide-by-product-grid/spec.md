## ADDED Requirements

### Requirement: Presentation density paginates every product record

The slide deck MUST offer an explicit Presentation density that pages by product and caps records per view with deterministic continuation pages, while the existing Document density keeps the auto-height all-content article. Presentation density MUST preserve every record exactly once, product/record order, author attribution, status, and Mine/Everyone scoping.

#### Scenario: One product exceeds the presentation cap

- **WHEN** a product contains more records than one presentation view allows
- **THEN** the model creates labeled continuation pages for that product
- **AND** flattening the pages yields every source record identity exactly once in source order

#### Scenario: The user switches density

- **WHEN** the viewer switches between Document and Presentation
- **THEN** the control exposes the active mode and is reversible
- **AND** no report data is re-fetched or discarded solely because density changed

#### Scenario: Document density remains available

- **WHEN** a slide is used for document reading or print-oriented review
- **THEN** the auto-height article continues to render all products and records without count-based truncation
