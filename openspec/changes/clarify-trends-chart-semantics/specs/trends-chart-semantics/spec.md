## ADDED Requirements

### Requirement: Trends chart interaction exposes the same domain facts

Traffic-light history and Lead velocity charts SHALL retain keyboard interaction outside any aria-hidden subtree and SHALL expose distinct accessible names. The full text-data alternatives SHALL remain available to assistive technologies inside clipped non-table containers which do not expand the document width.

#### Scenario: A keyboard user reads a chart

- **WHEN** the user tabs into either populated chart and navigates its points with the arrow keys
- **THEN** focus is on a named chart outside an aria-hidden subtree
- **AND** the traffic-light tooltip describes Red, Yellow or Green while velocity keeps numeric counts
- **AND** each tooltip agrees with the corresponding table entry

#### Scenario: A wide data table is visually hidden

- **GIVEN** many columns or long product or lead names
- **WHEN** Trends renders at desktop widths 1024, 1440 or 1728 CSS pixels or at native 200 percent zoom
- **THEN** the visually hidden text table does not increase the document's scroll width
- **AND** its caption, headers and values remain accessible

### Requirement: Period comparison identifies its two periods

The comparison table SHALL visibly identify the previous and latest period end dates from the same pair used for its query. It SHALL label status and risk columns by that direction and explain that risk change is latest minus previous.

#### Scenario: The compared pair changes

- **WHEN** the query uses a different previous and latest period pair
- **THEN** the table displays those exact dates beside the corresponding comparison values
- **AND** no unexplained A or B column remains
