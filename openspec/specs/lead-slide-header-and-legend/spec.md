# lead-slide-header-and-legend Specification

## Purpose

Defines the slide article header summary, the priority strip, counter labels, the contributor legend and the summaries that cover every visible own record.

## Requirements

### Requirement: Header summarizes the owner's period

The header MUST show: a worst-status pill derived from all product, activity, and risk
signals on the slide, the owner's name, counters for current items, risks, and
priorities, and an "N of M products on track" chip. A slide with blocked or
at-risk signals MUST retain that severity in the summary even when it has no
current or next items. Deck-owned controls MAY render at the end of the header,
but mode/scope ownership stays outside the article. All colors MUST come from
existing design tokens.

#### Scenario: worst status wins the pill

- **WHEN** the slide has products on track and one blocked product
- **THEN** the header pill shows the blocked treatment

#### Scenario: an at-risk activity raises the pill

- **WHEN** every product is on track and one activity is at risk
- **THEN** the header pill shows the at-risk treatment

#### Scenario: all products on track

- **WHEN** every product with data is on track
- **THEN** the "N of M products on track" chip drops the alert tint

#### Scenario: a blocked risk is the only update

- **WHEN** a slide has a blocked risk and no current or next items
- **THEN** its summary tone is blocked
- **AND** review ordering places it before warning and ordinary empty slides

### Requirement: Priority strip shows all ranked items

The priority strip MUST render one card per item carrying a `priorityRank`,
across all products in the authorized section projection; risks and decisions MUST NOT enter the strip.
On a Lead deck, only the lead's own section items supply ranks, including in
Everyone mode: foreign rows MUST NOT expose private ranks or add priority cards.
Head Product scope MAY aggregate ranked items from its authorized source sections
while preserving each item's original author. Cards order by ascending rank;
ties retain source order. Ranks are personal, so two P1 cards from different
authors in Head Product scope are valid. Each card MUST
show the P-badge tinted with the author's color, the full item text wrapping
without truncation, the product name, and the author's initials badge.

#### Scenario: Head Product scope contains two P1s from different authors

- **WHEN** two authorized source sections each contribute a rank-1 item to the Product slide
- **THEN** both cards render with their original authors in stable source order

#### Scenario: Lead Everyone does not disclose foreign priorities

- **WHEN** a Lead switches to Everyone on a shared Product
- **THEN** foreign items may appear as ordinary rows without private rank metadata
- **AND** the priority strip and priority counter still use only the lead's own ranked items

#### Scenario: risks never enter the strip

- **WHEN** a slide has risks and zero ranked items
- **THEN** the priority strip renders nothing

### Requirement: Legend names contributors with their roles

The slide footer MUST render a legend listing each contributor: initials badge in the contributor's assigned color, short name as defined by `user-name-display`, and the persisted `authorRole` suffix. Every current cross-author content row MUST carry a valid `DbRole`; missing roles are invalid input and MUST NOT be represented by a placeholder.

#### Scenario: contributor role is rendered

- **GIVEN** a contributor has persisted role `viewer`
- **WHEN** the contributor legend is rendered
- **THEN** the entry shows the badge, short name, and `viewer` role suffix

#### Scenario: visible legend uses canonical short names

- **GIVEN** a contributor's full name is Иванов Василий Петрович
- **WHEN** the contributor legend is rendered
- **THEN** its visible name label is Иванов В.П.
- **AND** its existing initials, assigned color and persisted role remain unchanged

### Requirement: Header counter labels match their counts

The slide header MUST preserve the numeric current-item, risk, and priority
counts. Risk and priority labels MUST use singular English at exactly one and
plural English at zero or more than one.

#### Scenario: risk and priority counts vary

- **WHEN** a risk or priority counter is zero, one, or greater than one
- **THEN** its number remains unchanged
- **AND** one reads `risk` or `priority`
- **AND** zero and greater counts read `risks` or `priorities`

### Requirement: Slide summaries cover every visible own record

The slide-level counters, readiness, and urgency MUST use the same own-record
scope as the by-product grid. Records parented to an Activity MUST contribute
exactly once just like Product-parented records, while retaining their existing
Activity subsection and Product-or-Shared home. Activity status and risks MUST
NOT change the derived health of a linked Product.

#### Scenario: Activity rows appear in the grid

- **WHEN** an Activity has current work, a risk, a decision, and a ranked item
- **THEN** every row appears in its existing Activity subsection
- **AND** the slide-level counters and readiness include every visible record
  exactly once

#### Scenario: Activity risk is blocked

- **WHEN** a blocked risk is parented to an Activity
- **THEN** the slide summary retains blocked urgency and risk readiness
- **AND** no linked Product's derived health changes because of the Activity risk
