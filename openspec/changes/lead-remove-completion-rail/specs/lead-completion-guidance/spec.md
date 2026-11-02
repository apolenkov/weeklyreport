## REMOVED Requirements

### Requirement: Sticky actions and submission explanation stay separate

**Reason**: The owner removed the completion rail; it covered report content to offer a once-a-week Submit already present in the header.

**Migration**: Completion actions render in the header only; the end-of-content explanation is covered by "Submission explanation stays in normal flow".

### Requirement: Completion layout MUST accommodate safe areas and short viewports

**Reason**: Its rail sizing and safe-area rules have no rail left to govern.

**Migration**: "Completion layout keeps the content row clear" keeps the scrollport clearance and short-viewport flow.

## ADDED Requirements

### Requirement: Submission explanation stays in normal flow

The editable Lead Report submission explanation MUST stay at the end of content in normal flow. Completion actions MUST share canonical Submit state and handlers in the header, show pending review count, and use Retry only for autosave recovery, not a permanent Save action. No completion rail, fixed overlay or bottom Submit card MUST cover report content.

#### Scenario: The lead scrolls through a long report

- **WHEN** the header actions leave the viewport
- **THEN** no completion rail appears and report content uses the full viewport height
- **AND** the explanation stays at the end of the content scrollport in normal flow

#### Scenario: Continuations await review

- **WHEN** two suggested continuations are unconfirmed
- **THEN** the header completion actions show `2 to review` beside Submit
- **AND** the end-of-form explanation names the same items and stays in document flow
- **AND** the indicator disappears at zero without adding another banner

### Requirement: Completion layout keeps the content row clear

The Lead Report completion layout MUST give the content scrollport the full row with no action overlay. Content focus scrolling MUST use its own scrollport clearance below the period toolbar. At short viewport heights or high zoom, the layout MUST permit normal document flow instead of trapping content behind the keyboard.

#### Scenario: Keyboard focus passes through the report

- **WHEN** the lead tabs through content
- **THEN** scrolling keeps focused controls visible below the period toolbar
- **AND** the form end remains reachable without fixed-overlay compensation

#### Scenario: A keyboard reduces the visual viewport

- **WHEN** the viewport height is below the layout's short-height breakpoint, including high zoom or an on-screen keyboard
- **THEN** content can flow and scroll in the document instead of a constrained full-height scrollport
- **AND** focused inputs and header completion actions remain reachable

### Requirement: A failed autosave stays visible at the top of the viewport

While the editable Lead draft's autosave is in the error state, a persistent notification at the top of the viewport MUST say the draft is not saved and MUST offer a Retry action that resends the draft through the canonical save path. It MUST stay visible at any scroll position until autosave leaves the error state, then close by itself. Read-only and Slides views MUST NOT raise it. The header Retry remains.

#### Scenario: the lead scrolls while a save has failed

- **GIVEN** autosave of the editable draft has failed
- **WHEN** the lead scrolls the report so the header leaves the viewport
- **THEN** the "Draft not saved" notification with Retry stays visible at the top
- **AND** activating Retry resends the draft immediately

#### Scenario: the draft saves again

- **GIVEN** the "Draft not saved" notification is visible
- **WHEN** a later save succeeds
- **THEN** the notification closes without user action
