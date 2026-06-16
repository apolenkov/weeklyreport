# report-card-clarity Specification

## Purpose

TBD - created by archiving change report-card-clarity. Update Purpose after archive.

## Requirements

### Requirement: The stage chip is an identity label, not a status signal

An item's stage chip SHALL render with a single uniform treatment that names the
SDLC stage (and the contributing lead's initials), independent of the item's
workflow status. The item's workflow status (`in-progress` / `completed` /
`blocked` / `planned`) SHALL be conveyed by a separate signal on the row (left
stripe or a dedicated marker), never by the stage chip's fill.

#### Scenario: two items in different workflow states

- **WHEN** a product card renders a completed item and an in-progress item on the
  same stage
- **THEN** both stage chips render with the same uniform treatment
- **AND** the difference in workflow status is shown by the row stripe/marker,
  not by the chip color

### Requirement: Needs Attention never duplicates an item

The "Needs Attention" banner SHALL be suppressed (or condensed to a non-duplicate
summary) when its text matches the text of an item already rendered in the same
product card. When it renders, it SHALL add information beyond what the item rows
already show.

#### Scenario: escalation text equals a shown item

- **WHEN** a product's escalation text is identical to a current-week item's text
- **THEN** the banner does not render that duplicate text

#### Scenario: escalation adds information

- **WHEN** a product's escalation is a distinct head-facing summary
- **THEN** the banner renders it above the item rows

### Requirement: By-lead scope slices each product to one lead

In the head report "by lead" scope, a product card under a lead SHALL show only
that lead's own contribution to the product (their items, risks, decisions, and
stages). The "by product" scope SHALL continue to show the full cross-lead
aggregate of each product.

#### Scenario: a lead owns two products

- **WHEN** the head views the report grouped by lead and a lead owns two products
- **THEN** two product cards render under that lead, each limited to that lead's
  items and stages

#### Scenario: a product has multiple contributing leads

- **WHEN** a product was authored by two leads and the head groups by lead
- **THEN** each lead's card for that product shows only their own items
- **AND** no other lead's items appear in it

### Requirement: Add-item and add-risk offer stages scoped to the product

When a lead adds an item or risk, the SDLC stage options offered SHALL depend on
the selected product — only the stages relevant to that product (the author's
owned stages on it) are selectable.

#### Scenario: selecting a single-stage product

- **WHEN** a lead opens the add-item dialog and selects a product owned on one
  stage
- **THEN** only that stage is offered

#### Scenario: selecting a two-stage product

- **WHEN** a lead selects a product owned on Development and Testing
- **THEN** both Development and Testing are offered, and no unrelated stage is

### Requirement: A product card is scannable at a glance

The product card SHALL present its content so the head can read it at a glance:
no duplicated content, a clear hierarchy carried by typography and spacing rather
than competing fills, and the status signal legible without a legend.

#### Scenario: a presenter scans a card

- **WHEN** the head opens a product card with items, risks, and a decision
- **THEN** each section reads as a distinct block with no repeated content
- **AND** the alarm hue (red) appears only on blocked content
