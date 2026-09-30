## ADDED Requirements

### Requirement: Trends history and velocity are readable tables

Traffic-light history and Lead velocity SHALL render as visible HTML tables
(rows: projects or leads; columns: period end dates) with a `<caption>`,
`scope="col"`/`scope="row"` headers, no legend and no per-series colours.
Status cells SHALL reuse the product status badge (label plus tone); numeric
cells SHALL show the count, including 0. Rows with a Red or Yellow status
in range SHALL precede fully Green rows. The table wrapper SHALL scroll
horizontally and be keyboard-focusable; the document width SHALL NOT grow.

#### Scenario: A keyboard user reads a table

- **WHEN** the user tabs to a populated section
- **THEN** focus lands on the table region named by the section heading
- **AND** every cell exposes its status word or count as text

#### Scenario: Narrow viewport

- **WHEN** Trends renders at 375 CSS pixels
- **THEN** the page has no horizontal overflow and the table scrolls inside its wrapper

### Requirement: Period comparison identifies its two periods

The comparison table SHALL visibly identify the previous and latest period end dates from the same pair used for its query. It SHALL label status and risk columns by that direction and explain that risk change is latest minus previous. Its status cells SHALL use the product status badge.

#### Scenario: The compared pair changes

- **WHEN** the query uses a different previous and latest period pair
- **THEN** the table displays those exact dates beside the corresponding comparison values
- **AND** no unexplained A or B column remains
- **AND** status cells use the product status badge
