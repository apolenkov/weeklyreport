## ADDED Requirements

### Requirement: The collapsed-stages indicator reveals through the styled tooltip

The `+N more` collapsed-stages indicator MUST reveal the hidden stages' names and statuses through the same styled tooltip used by the stage chips (`useSdlcTooltip`), not the native `title` attribute, so hovering it reads identically to hovering a chip.

1. On pointer hover the indicator MUST show the hidden stages as "name: status"
   pairs via the shared `sdlc-tooltip` portal; on pointer leave it MUST hide.
2. The non-visual `aria-label` listing the hidden stages MUST be retained as the
   screen-reader path (the indicator is inert and not a keyboard tab stop, the
   same reach the prior native `title` had).

#### Scenario: Hovering +N more shows the styled tooltip

- **WHEN** a lead in Mine mode hovers the `+N more` collapsed-stages indicator
- **THEN** the same styled tooltip the chips use appears, listing each hidden
  stage as "name: status"
- **AND** moving the pointer away hides it

### Requirement: The collapsed-stages indicator surfaces the worst hidden severity

The `+N more` collapsed-stages indicator MUST take the status colour of the worst hidden stage when that worst status is `blocked` or `at-risk`, so a lead sees at a glance that a collapsed stage needs attention without expanding the group.

1. When the worst hidden stage is `blocked`, the indicator's border and text MUST
   use the blocked status colour; when it is `at-risk`, the at-risk colour.
2. When the worst hidden stage is `on-track` or `empty`, the indicator MUST stay
   neutral grey — a non-urgent hidden stage MUST NOT recolour it.
3. This colour is derived from the same hidden-stage set the indicator already
   reveals; it MUST NOT change product health (left stripe) or the own-input
   completeness counter.

#### Scenario: A hidden at-risk stage colours the indicator

- **WHEN** a lead in Mine mode has a hidden stage at `at-risk` and the rest of the
  hidden stages no worse
- **THEN** the `+N more` indicator renders in the at-risk status colour
- **AND** the product health stripe and the `N/M Your stages` counter are unchanged

#### Scenario: Only non-urgent hidden stages leave the indicator neutral

- **WHEN** every hidden stage is `on-track` or `empty`
- **THEN** the `+N more` indicator stays neutral grey
