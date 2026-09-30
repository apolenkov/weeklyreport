## ADDED Requirements

### Requirement: Lead preview navigation remains readable on mobile

The outer header at `/lead/report/[reportId]/preview` MUST stack its title and
description above the Back to form link below 640 CSS pixels. The link MUST
retain one unwrapped label, a minimum height of 44 CSS pixels, and its existing
form destination. At wider widths, the existing horizontal header MAY remain.

#### Scenario: A lead returns from mobile preview

- **WHEN** a Lead opens Section Preview at 375 CSS pixels
- **THEN** its header text and Back to form link fit without squeezing or overlap
- **AND** Back to form remains a single-line, reachable link to the addressed form

## MODIFIED Requirements

### Requirement: All toolbar controls stay reachable at narrow viewport widths

The header action group and the context-control bar MUST each keep every control
reachable at narrow widths; controls MUST NOT be clipped out of reach.
The report title and department context MUST wrap at narrow widths rather
than lose meaningful names to truncation.

1. When the header action group's controls exceed the available width, the header
   line MUST wrap so no document action becomes unreachable.
2. When the context bar's controls exceed the available width, the bar MUST allow
   horizontal scrolling or wrapping so no context control becomes unreachable; it
   MUST NOT clip controls with no way to reach them.

#### Scenario: the context bar overflows on a narrow screen

- **WHEN** the context-control bar has more controls than fit the viewport width
- **THEN** every control remains reachable via horizontal scroll or wrapping,
  none is clipped out of reach

#### Scenario: the header action group overflows on a narrow screen

- **WHEN** the header line's action group has more controls than fit beside the
  title block
- **THEN** the header line wraps so every document action remains reachable

#### Scenario: A mobile report has a long department name

- **WHEN** a report header renders at 375 CSS pixels with a long department context
- **THEN** the complete title and context remain readable without clipping the document actions
