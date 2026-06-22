## MODIFIED Requirements

### Requirement: The collapsed-stages indicator reveals through the styled tooltip

The `+N more` collapsed-stages indicator MUST reveal the hidden stages through the shared Radix `Tooltip` from `packages/ui` — the same component the stage chips use — as a multi-line list (one stage per line), and MUST distinguish an owned-but-unstatused stage from a vacant one so it never mislabels an occupied stage as empty. The indicator's tooltip surface MUST use the app's light popover tokens (`bg-popover`/`text-popover-foreground` with a border and shadow), NOT the shared Radix dark default (`bg-foreground`/`text-background`), and the dark Radix arrow MUST be hidden — applied as a scoped override on this one indicator so the shared dark default still serves the stage chips and the sidebar.

1. On pointer hover/focus the indicator MUST show the hidden stages through the
   shared Radix tooltip, one stage per line; the custom `useSdlcTooltip` is no longer
   used for the pipeline.
2. A hidden stage that is OWNED by another author MUST read as that owner plus an
   explicit "no status set" note when the lead has set no status; it MUST NOT read as
   "empty".
3. A hidden stage with no owner MUST read as "unassigned" (vacant).
4. The non-visual `aria-label` listing the hidden stages MUST be retained as the
   screen-reader path (the indicator is inert and not a keyboard tab stop).
5. The indicator's tooltip surface MUST be the light popover surface (the same
   `bg-popover`/`text-popover-foreground` tokens as `dropdown-menu`/`select`),
   with the dark Radix arrow hidden. This restyle is SCOPED to the collapsed
   indicator via a `className` override and MUST NOT change the shared dark
   `TooltipContent` default used by stage chips and the sidebar; it introduces no
   new token, theme, or background.

#### Scenario: An owned hidden stage is not shown as empty

- **WHEN** a lead in Mine mode hovers the `+N more` indicator and a hidden stage is
  owned by another author with no status set
- **THEN** that line shows the owner and "no status set"
- **AND** it does not read as "empty"

#### Scenario: A vacant hidden stage reads as unassigned

- **WHEN** a hidden stage has no owner
- **THEN** its line reads "unassigned"

#### Scenario: The reveal is multi-line through the shared Radix tooltip

- **WHEN** the indicator is hovered
- **THEN** the hidden stages appear one per line via the shared Radix `Tooltip`
- **AND** moving the pointer away hides it

#### Scenario: The reveal uses the softer light popover surface

- **WHEN** a lead in Mine mode hovers the `+N more` indicator
- **THEN** the reveal renders on the light popover surface (`bg-popover`, not the dark `bg-foreground` default) with no dark arrow
- **AND** the stage-chip and sidebar tooltips keep the shared dark surface (the override is scoped to this indicator)
