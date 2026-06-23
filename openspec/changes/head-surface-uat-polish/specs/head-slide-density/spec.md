# head-slide-density Specification

## ADDED Requirements

### Requirement: The inline head slide renders within a fixed slide frame

The active head status slide MUST render inside the fixed-aspect `.slide-frame`
(`aspect-ratio: var(--slide-aspect)`, the same 16:10 token the lead deck uses) in
the standard inline (non-fullscreen) slides view, so the slide reads as a fixed
presentation canvas rather than a content-height card that leaves a large empty
gap below it. This brings the inline head slide to parity with the inline lead
slide (`LeadSlideArticle`, which already carries `.slide-frame`).

Inside the frame the slide header and portfolio-metrics strip MUST keep their
natural height, and the 2×2 section grid (Current / Next / Risks / Decisions)
MUST stretch to fill the remaining frame height (`flex-1`, `min-h-0`,
`auto-rows-fr`). A section whose rows exceed its zone MUST become vertically
scrollable inside its own card and MUST NOT expand the frame or push content past
the slide edge.

#### Scenario: the head opens the inline slides view

- **WHEN** the head opens `/head/report/{id}?mode=slides` and a slide is active
- **THEN** the active slide renders inside the fixed-aspect `.slide-frame`
- **AND** the slide does not leave a large empty gap below it at standard width

#### Scenario: a head section overflows its zone

- **WHEN** a section (e.g. Decisions) has more rows than fit in its zone height
  inside the fixed-aspect frame
- **THEN** that section becomes vertically scrollable inside its framed card
- **AND** the frame keeps its aspect ratio and the other sections keep their
  even `auto-rows-fr` zones
