# desktop-surface-composition Specification

## Purpose

Keep desktop pages aligned, readable, and stable during primary navigation.

## Requirements

### Requirement: Desktop navigation preserves the application frame

Primary navigation between History, Dashboard, and Status MUST leave the
desktop viewport at the document top with the complete application header
visible. Route transitions MUST NOT focus-scroll `main#main-content` beneath
the persistent header, while the skip link MUST retain a focusable main target.

#### Scenario: a head changes route at the top of the page

- **WHEN** a head activates a primary route while `window.scrollY` is zero
- **THEN** the destination keeps `window.scrollY` at zero
- **AND** the navigation header remains visible above `main#main-content`

### Requirement: Decorative background has no product meaning

Desktop routes MAY use a restrained CSS-only decorative background subordinate
to card surfaces. It MUST expose no semantic content or interaction, preserve
foreground contrast, and remain static.

#### Scenario: decoration is unavailable

- **WHEN** background decoration is disabled or ignored by assistive technology
- **THEN** information, controls, reading order, and completion status remain
  unchanged

### Requirement: Desktop surfaces share aligned geometry

Desktop navigation and primary application pages MUST share the same content
width. Head report context controls MUST remain usable on one row at showcase
desktop width without hiding visible labels.

#### Scenario: the head opens report controls

- **WHEN** a head views a report at showcase desktop width
- **THEN** navigation, context controls, and report content share aligned edges
- **AND** visible control labels remain available

### Requirement: Empty history uses the current empty-state surface

The `/reports` empty state MUST occupy the same visual grid row as its summary
rail, present one centered message, use `--color-surface-empty`, and show no
fabricated report data or action.

#### Scenario: history has no current entries

- **WHEN** `/reports` renders without current history at desktop width
- **THEN** the empty panel and summary rail share aligned boundaries
- **AND** the panel uses `bg-[var(--color-surface-empty)]`
