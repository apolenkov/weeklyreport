# Delta Spec: report-toolbar-layout

## ADDED Requirements

### Requirement: Sticky toolbar scroll offset reflects breakpoint stickiness

The sticky context toolbar MUST publish the `--sticky-toolbar-offset` CSS variable on the root document element only when the viewport matches the sticky breakpoint (`width >= 48rem`). When the viewport drops below `48rem`, the variable MUST be removed so static mobile layouts do not retain an offset.

#### Scenario: Sticky toolbar at narrow mobile width

- **WHEN** a report toolbar with `sticky=true` renders on a viewport narrower than `48rem` (e.g. 375px)
- **THEN** `--sticky-toolbar-offset` is not set on the document element (or is cleared)
- **AND** resizing to desktop (`>= 48rem`) measures and sets `--sticky-toolbar-offset`
