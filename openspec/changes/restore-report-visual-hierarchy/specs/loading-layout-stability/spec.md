## Purpose

Keep loading feedback visually faithful to the report surface it replaces so users retain stable landmarks and avoid unnecessary layout jumps while data resolves.

## ADDED Requirements

### Requirement: Report skeletons preserve the loaded surface hierarchy

The lead, head, and viewer report loading skeletons MUST preserve the loaded surface's outer width, vertical spacing, header title/action split, compact single context bar, and primary content-card order. A skeleton MAY use a bounded data-independent placeholder count, but it MUST NOT introduce a center label, oversized toolbar, or control grouping absent from the loaded page.

#### Scenario: a lead report finishes loading

- **WHEN** the lead form changes from its skeleton to loaded content
- **THEN** the title/action landmarks and the period/view toolbar clusters keep the same alignment and approximate height
- **AND** the first primary content card begins in the same visual region

#### Scenario: a head or viewer report finishes loading

- **WHEN** the shared weekly report changes from its skeleton to loaded content
- **THEN** the header, context bar, portfolio overview, and section list retain the same order and width allocation

#### Scenario: a head or viewer slide route renders its outer fallback

- **WHEN** the shared weekly report skeleton renders in slides mode
- **THEN** its header omits the form-only report status placeholder
- **AND** resolving the slide route does not remove an extra header landmark or change compact header wrapping

### Requirement: Slide skeletons mirror the current full-width article

The lead and head slide loading skeleton MUST represent the current full-width slide article with its hero, summary strip, four-column headings, and product-card body. It MUST NOT render the retired sidebar-plus-canvas layout. At compact widths, the placeholder MUST remain contained without horizontal page overflow.

#### Scenario: slide data resolves

- **WHEN** a slide deck replaces the loading skeleton with the current article
- **THEN** the main content stays full width and the hero/article landmarks remain in the same order
- **AND** no sidebar disappears during the transition because none was shown in the skeleton

#### Scenario: slide skeleton renders on a compact viewport

- **WHEN** the slide skeleton renders at a supported compact width
- **THEN** its article shell remains within the viewport and every placeholder column is reachable without document-level clipping
