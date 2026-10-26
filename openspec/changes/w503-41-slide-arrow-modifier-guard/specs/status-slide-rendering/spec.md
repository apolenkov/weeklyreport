# Spec Delta

## ADDED Requirements

### Requirement: Slide paging shortcuts preserve browser and assistive input

The lead and head deck arrow-key paging MUST page only for an UNMODIFIED
`ArrowLeft` or `ArrowRight` keydown outside form controls and contenteditable
content. It MUST ignore Ctrl, Meta, Alt or Shift modifiers: a modified arrow
keydown MUST NOT emit a slide selection, change the rendered slide, or call
`preventDefault`, so the browser and assistive technology keep their own
handling of the event. Unmodified paging and the empty-deck no-op MUST stay
unchanged.

#### Scenario: Modified arrows keep their browser and AT behavior

- **WHEN** the deck has focus and the user presses a modified `ArrowLeft` or
  `ArrowRight` (Ctrl, Meta, Alt or Shift)
- **THEN** the deck emits no slide selection and the rendered slide does not
  change
- **AND** the event is not prevented, so browser/AT handling continues

#### Scenario: Plain arrows still page

- **WHEN** the deck has focus and the user presses an unmodified `ArrowRight` or
  `ArrowLeft`
- **THEN** the next or previous valid slide index is emitted
- **AND** the deck prevents the browser default for that navigation

#### Scenario: Editor input keeps its arrow behavior

- **WHEN** an arrow keydown originates in a form control or contenteditable
  element
- **THEN** the deck does not page and does not prevent the default
