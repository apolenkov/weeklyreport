# surface-token-integrity Specification

## Purpose

Require every report UI surface token reference to resolve to a design-system token whose name matches the surface's semantic role.

## Requirements

### Requirement: Report UI references only defined surface tokens

Every `var(--color-…)` surface reference in the web UI MUST resolve to a token defined in `packages/ui/src/styles/theme.css`; the undefined `--color-surface` custom property MUST NOT be referenced, and each former callsite MUST use the defined token that matches its semantic role.

1. The undefined `--color-surface` MUST be removed from all `apps/web/src`
   callsites; a new `--color-surface` token MUST NOT be introduced (the palette
   already defines `--color-card`, `--color-surface-empty`,
   `--color-surface-hover`, and `--color-surface-muted`).
2. Dashed empty-state panels (no submissions, no slides, empty grids) MUST use
   `--color-surface-empty`.
3. Elevated solid cards, tables, and skeletons (with a border/shadow) MUST use
   `--color-card`.
4. Text rendered on the brand-accent CTA (e.g. the dashboard retry button) MUST
   use a light on-accent colour (white), NOT a surface-background token, so the
   label keeps AA contrast on the green fill.

#### Scenario: no undefined surface token remains

- **WHEN** the web source is grepped for `var(--color-surface)` (the exact
  no-suffix token)
- **THEN** there are zero matches in `apps/web/src` and `packages/ui/src`

#### Scenario: an empty-state panel renders

- **WHEN** a dashed empty-state panel (e.g. "No submissions yet", an empty slide
  deck, an empty product grid) renders
- **THEN** its background resolves to the defined `--color-surface-empty`, not a
  transparent fallback from an undefined token

#### Scenario: the dashboard retry CTA renders

- **WHEN** the dashboard renders its brand-accent retry button
- **THEN** the button label is a light on-accent colour with AA contrast on the
  green fill, not an undefined token that falls back to an unreadable colour
