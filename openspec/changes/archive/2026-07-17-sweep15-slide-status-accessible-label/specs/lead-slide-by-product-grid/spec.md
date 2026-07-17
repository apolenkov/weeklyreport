## REMOVED Requirements

### Requirement: Product cards carry status by color only

Each product card MUST show its status as a left stripe and a status dot beside the product name, using existing status tokens; textual status chips MUST NOT appear on the card. A product with no data for the period MUST render as a collapsed dashed-border row reading "no status for this period". Products with no status MUST render without a status stripe.

#### Scenario: blocked product card

- **WHEN** a product's derived status is blocked
- **THEN** its card shows the blocked-token stripe and dot
- **AND** no textual status chip appears on the card

#### Scenario: product without data collapses

- **WHEN** a product assigned to the owner has no records this period
- **THEN** it renders as a collapsed dashed row with the no-status copy

**Reason**: Color-only status is inaccessible to color-vision-deficient users and unreliable in projection.

**Migration**: Replace the dot-only mandate with the added compact shape-distinct icon and accessible status label while retaining the stripe.

## ADDED Requirements

### Requirement: Product cards expose status without relying on color

Each product card MUST show a shape-distinct compact status icon with accessible English status text beside the product name, and MUST retain the existing status-colored left stripe as reinforcement. On Track, At Risk, and Blocked MUST have distinguishable icon shapes and accessible labels. A product with no data for the period MUST render as a collapsed dashed-border row reading "no status for this period" and MUST render without a status stripe or status icon.

#### Scenario: Blocked product has redundant status channels

- **WHEN** a product's derived status is blocked
- **THEN** its card shows the blocked stripe and the distinct blocked icon beside the product name
- **AND** assistive technology announces `Blocked` without relying on color

#### Scenario: Statuses remain distinguishable without color

- **WHEN** on-track, at-risk, and blocked product cards are viewed without color information
- **THEN** their compact icons remain shape-distinct
- **AND** each icon exposes its corresponding `On Track`, `At Risk`, or `Blocked` accessible text

#### Scenario: Product without data collapses

- **WHEN** a product assigned to the owner has no records this period
- **THEN** it renders as a collapsed dashed row with the no-status copy
- **AND** it renders no status stripe or status icon
