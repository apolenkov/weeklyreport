## MODIFIED Requirements

### Requirement: The Blocked & At Risk issues are grouped into per-product cards

The expanded `BlockedAtRiskTable` MUST cluster its issues into one card per
product, in the report `ProductAccordion` idiom, so a product carrying several
issues shows its name once instead of repeating it on every row. Each product
card header MUST carry an avatar, the product name, a worst-severity status dot
(blocked / at-risk), and the line of contributing assignees. Each issue row MUST
show a left status rail (red for blocked, amber for at-risk), a
stage-over-assignee gutter, the issue description, and a Blocked / At risk badge
— the same row vocabulary the report accordion uses. Product cards MUST preserve
the first-appearance order of the source data, and the trigger's issue count
MUST remain the total across all cards. Each admitted risk occurrence MUST remain a distinct row during list updates even when its displayed fields match another row. Product avatars MUST use the same canonical name-to-initials owner as report accordions.

#### Scenario: a product with several issues shows its name once

- **WHEN** the head expands the Blocked & At Risk block and one product has more
  than one blocked or at-risk issue
- **THEN** that product name appears once in a single product-card header above
  its issue rows
- **AND** each issue row under it shows its own stage, assignee, and description
  without repeating the product name

#### Scenario: each product card reads in the report accordion idiom

- **WHEN** the head views an expanded product card
- **THEN** its header shows an avatar, the product name, a status dot, and the
  contributing assignees
- **AND** each issue row shows a status rail, a stage-over-assignee gutter, the
  description, and a Blocked / At risk badge

#### Scenario: Two admitted risks have identical display fields

- **WHEN** a product has two distinct risks with identical displayed fields and the list is updated
- **THEN** both occurrences remain separate rows without duplicate React keys
- **AND** occurrence removal and re-addition preserve the actual row count

#### Scenario: The product has one word or an astral character

- **WHEN** the product name is Billing, Marketing Portal or starts with an emoji
- **THEN** its dashboard avatar agrees with the canonical report avatar
