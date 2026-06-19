## ADDED Requirements

### Requirement: The collapsed-stages indicator reveals through the styled tooltip

The `+N more` collapsed-stages indicator MUST reveal the hidden stages' names and statuses through the same styled tooltip used by the stage chips (`useSdlcTooltip`), not the native `title` attribute, so hovering it reads identically to hovering a chip.

1. On hover/focus the indicator MUST show the hidden stages as "name: status"
   pairs via the shared `sdlc-tooltip` portal; on leave/blur it MUST hide.
2. The non-visual `aria-label` listing the hidden stages MUST be retained for
   screen readers.

#### Scenario: Hovering +N more shows the styled tooltip

- **WHEN** a lead in Mine mode hovers the `+N more` collapsed-stages indicator
- **THEN** the same styled tooltip the chips use appears, listing each hidden
  stage as "name: status"
- **AND** moving the pointer away hides it
