# status-presentation-model Specification

## Purpose

Provide one presentation model for canonical status vocabulary, tones, icons, dots, badges, and empty states across user-facing surfaces.

## Requirements

### Requirement: One canonical map is the single source for status tone, icon, and dot

The system MUST derive a workflow status's tone-token key, icon, and dot class
from one canonical map keyed on the canonical status set (`blocked` / `at-risk`
/ `on-track` / `empty`), so no in-scope surface re-derives tone, icon, or dot
from its own `Record<status, …>`. The canonical map lives in a single module
at `apps/web/src/shared/lib/status/status-presentation.ts`. Status-bearing
consumers MUST read tone/icon/dot from it rather than hold a private copy.

Labels are variant-aware, not collapsed to one string per status. The map holds
the label variants required by current surfaces (screen sentence-case `On track` /
`At risk` / `Blocked` / `No status`; print Title-case `On Track` / `At Risk`;
the worst-status pill's `Blockers`), addressed through a variant key
(`statusLabel(status, variant)`), so parity is preserved by reproducing each
existing label — not by unifying them. Which surface uses which variant is part
of this canonical contract.

A raw status source that is not already a canonical key (a traffic-light color,
`SlideTone`, `PillStatus`, or `Severity`) MUST be mapped to a canonical key by a
normalizer (e.g. `toPillStatus`, the raw-color→`ProductStatus` function,
severity→key). That key-normalization is status derivation, not vocabulary
lookup, and is explicitly permitted; the private-copy prohibition targets
label/tone/icon/dot records, not the enum-to-key normalizers.

Adding a new status-bearing surface MUST reuse the canonical map — this clause
holds repo-wide — and MUST NOT introduce
a second tone/icon/dot lookup for the canonical status set.

The color values themselves stay owned by `web-status-color-tokens`; this map
keys onto those tokens and does not restate the token rule.

#### Scenario: an in-scope surface renders a status tone, icon, or dot

- **WHEN** a status-bearing consumer renders a canonical workflow status's tone
  class, icon, or dot
- **THEN** the value is read from the canonical status map
- **AND** the surface holds no private tone/icon/dot `Record<status, …>` of its
  own for the canonical status set

#### Scenario: a surface normalizes a non-canonical status source

- **WHEN** a surface starts from a raw traffic-light color, `SlideTone`,
  `PillStatus`, or `Severity` rather than a canonical key
- **THEN** it maps that source to a canonical key through a normalizer
- **AND** it then reads tone/icon/dot from the canonical map for that key,
  holding no private vocabulary Record

#### Scenario: a new status surface is added

- **WHEN** a contributor adds a new surface that shows a canonical workflow
  status
- **THEN** it consumes the canonical map
- **AND** no second tone/icon/dot `Record<status, …>` is introduced

### Requirement: Each surface preserves its declared status presentation

The canonical map MUST preserve each surface's declared tone, label variant,
icon, and dot. Parity means using the appropriate surface variant rather than
forcing one label everywhere. Every status color MUST resolve through the
tokens owned by `web-status-color-tokens`; no canonical-map consumer may add a
private literal or move a color onto an unrelated surface.

#### Scenario: the same canonical status renders identically across surfaces

- **WHEN** the same canonical workflow status (`blocked` / `at-risk` /
  `on-track` / `empty`) is rendered on two in-scope surfaces
- **THEN** each surface renders its declared tone, label variant, icon, and dot
- **AND** both resolve their shared semantics through the canonical map

#### Scenario: the canonical map does not own color literals

- **WHEN** a surface resolves a canonical status color
- **THEN** the map returns the status token for that semantic role
- **AND** no color literal is declared in the map or the consuming surface

### Requirement: Shared status badge and empty-state components back the in-scope surfaces

The system MUST render the slide status badge through one shared
`SlideStatusBadge` component and the empty status section through one shared
`SlideEmptyState` component, so the badge and empty-section markup are defined
once. Any in-scope slide surface that renders a status badge or empty status
section MUST use those shared components instead of private badge or empty
placeholder markup. `SlideStatusBadge` MUST take
a canonical status (plus its label variant) and resolve label, icon, and tone
through the canonical map — it MUST NOT accept a pre-formatted tone/color prop
that would let a caller bypass the map.

#### Scenario: a surface renders a status badge

- **WHEN** an in-scope slide or dashboard surface renders a workflow-status badge
- **THEN** it renders the shared `SlideStatusBadge` component
- **AND** that badge resolves its label variant, icon, and tone through the
  canonical map

#### Scenario: a section has no rows

- **WHEN** a status section renders with zero rows
- **THEN** it renders the shared `SlideEmptyState` component
- **AND** no in-scope surface inlines its own empty-section placeholder markup

### Requirement: The canonical status vocabulary is declared once

The system MUST declare the canonical status union
(`"blocked" | "at-risk" | "on-track" | "empty"`) exactly once as
`CanonicalStatus` in
`packages/shared/src/schemas/status/canonical-status.ts`, exported by
`@customreport/shared`. The Web presentation map in
`apps/web/src/shared/lib/status/status-presentation.ts` MUST key its labels,
icons, and tones by that shared type. Every other name for the vocabulary MUST
be a type alias of `CanonicalStatus`; for example, `StageStatus` in
`features/report-sections/model/traffic-light.ts` is the feature-domain alias,
never a re-declared literal union. Application modules MUST import the canonical
type from `@customreport/shared`, not from another feature.

#### Scenario: a module needs the canonical status type

- **WHEN** an application module needs the vocabulary type
- **THEN** it imports `CanonicalStatus` from `@customreport/shared`
- **AND** no application module imports the canonical type from a feature module

#### Scenario: a feature-domain name is kept

- **WHEN** feature code refers to the vocabulary as `StageStatus`
- **THEN** that name resolves to a type alias of `CanonicalStatus`
- **AND** no second literal-union declaration of the four values exists
