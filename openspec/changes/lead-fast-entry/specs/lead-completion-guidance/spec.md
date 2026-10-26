## MODIFIED Requirements

### Requirement: Sticky actions and submission explanation stay separate

The editable Lead Report submission explanation MUST stay at the end of content in normal flow. The completion rail MUST occupy its own layout row beside `lead-completion-scrollport`, not a fixed overlay. It MUST share canonical Submit state and handlers with the header, show pending review count, and use Retry only for autosave recovery, not a permanent Save action.

#### Scenario: The lead scrolls through a long report

- **WHEN** the canonical header actions leave the viewport
- **THEN** completion actions remain available in the separate rail row without covering report content
- **AND** the explanation stays at the end of the content scrollport in normal flow
- **AND** the rail does not introduce a second validator or submit handler

#### Scenario: Continuations await review

- **WHEN** two suggested continuations are unconfirmed
- **THEN** the completion actions show `2 to review` beside Submit
- **AND** the end-of-form explanation names the same items and stays in document flow
- **AND** the indicator disappears at zero without adding another banner

#### Scenario: Keyboard focus passes through the report

- **WHEN** the lead tabs through content while the completion rail is visible
- **THEN** scrolling keeps focused controls visible above the separate rail and below the period toolbar
- **AND** the form end remains reachable without fixed-overlay compensation

## ADDED Requirements

### Requirement: Completion layout MUST accommodate safe areas and short viewports

The Lead Report completion layout MUST reserve content and action rows rather than overlay them. The rail MUST respect the bottom safe area and remain scrollable if tall. Content focus scrolling MUST use its own scrollport clearance. At short viewport heights or high zoom, the layout MUST permit normal document flow instead of trapping content behind the keyboard.

#### Scenario: A disabled reason wraps or the safe area grows

- **WHEN** the rail grows because its reason wraps or the bottom safe-area inset increases
- **THEN** the content row shrinks without placing content behind the rail
- **AND** tall rail content remains scrollable and its actions reachable

#### Scenario: A keyboard reduces the visual viewport

- **WHEN** the viewport height is below the layout's short-height breakpoint, including high zoom or an on-screen keyboard
- **THEN** content can flow and scroll in the document instead of a constrained full-height scrollport
- **AND** focused inputs and completion actions remain reachable
