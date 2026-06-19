## MODIFIED Requirements

### Requirement: The collapsed-stages indicator reveals through the styled tooltip

The `+N more` collapsed-stages indicator MUST reveal the hidden stages through the shared Radix `Tooltip` from `packages/ui` — the same component the stage chips use — as a multi-line list (one stage per line), and MUST distinguish an owned-but-unstatused stage from a vacant one so it never mislabels an occupied stage as empty.

1. On pointer hover/focus the indicator MUST show the hidden stages through the
   shared Radix tooltip, one stage per line; the custom `useSdlcTooltip` is no longer
   used for the pipeline.
2. A hidden stage that is OWNED by another author MUST read as that owner plus an
   explicit "no status set" note when the lead has set no status; it MUST NOT read as
   "empty".
3. A hidden stage with no owner MUST read as "unassigned" (vacant).
4. The non-visual `aria-label` listing the hidden stages MUST be retained as the
   screen-reader path (the indicator is inert and not a keyboard tab stop).

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

### Requirement: The collapsed-stages indicator surfaces the worst hidden severity

The `+N more` collapsed-stages indicator MUST color its border and text by the full status scale of the hidden stages, by precedence, so the product's left health stripe is traceable to the collapsed stages at a glance.

1. The color precedence MUST be: red when any hidden stage is `blocked`; otherwise
   yellow when any is `at-risk`; otherwise grey when any is unfilled
   (`empty`/unassigned); otherwise green when every hidden stage is `on-track`.
2. This reverses the prior "neutral grey unless blocked/at-risk" behaviour: a
   fully on-track hidden set now reads green, and a partially unfilled set reads grey.
3. This color is derived from the same hidden-stage set the indicator reveals; it
   MUST NOT change product health (left stripe) or the own-input completeness counter.

#### Scenario: All hidden stages on-track color the indicator green

- **WHEN** a lead in Mine mode has hidden stages that are all `on-track`
- **THEN** the `+N more` indicator renders green
- **AND** the product health stripe and the `N/M Your stages` counter are unchanged

#### Scenario: An unfilled hidden stage colors the indicator grey

- **WHEN** the worst hidden stage is no worse than `on-track` but at least one hidden
  stage is `empty` or unassigned
- **THEN** the `+N more` indicator renders grey

#### Scenario: A hidden blocked stage colors the indicator red

- **WHEN** any hidden stage is `blocked`
- **THEN** the `+N more` indicator renders in the blocked status color
