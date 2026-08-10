## Purpose

Keep readable wide content available on compact screens without transferring its intrinsic width to the entire document.

## ADDED Requirements

### Requirement: Wide surfaces own horizontal overflow locally

An intrinsically wide slide canvas or admin data table MUST remain inside a visible local horizontal scroll host at compact widths. The host MUST preserve access to the complete content while the document scroll width remains equal to its viewport width.

#### Scenario: a lead opens slides on a compact viewport

- **WHEN** the slide article keeps its readable minimum canvas width
- **THEN** the lead deck owns the horizontal scroll range locally
- **AND** the document does not widen beyond the viewport

#### Scenario: a head or viewer opens slides on a compact viewport

- **WHEN** the shared report slide keeps its readable minimum canvas width
- **THEN** the head slide frame owns the horizontal scroll range locally
- **AND** the document does not widen beyond the viewport

#### Scenario: an admin opens the users table on a compact viewport

- **WHEN** all user-table columns require more width than the viewport provides
- **THEN** the users-table card owns the horizontal scroll range locally
- **AND** the document does not widen beyond the viewport
