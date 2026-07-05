## ADDED Requirements

### Requirement: One canonical map is the single source for status tone, icon, and dot

The system MUST derive a workflow status's tone-token key, icon, and dot class
from one canonical map keyed on the canonical status set (`blocked` / `at-risk`
/ `on-track` / `empty`), so no in-scope surface re-derives tone, icon, or dot
from its own `Record<status, …>`. The canonical map lives in a single module
under `apps/web/src/lib`. The enumerated consumers — `status-slide-deck`,
`slide-activity-pills`, `slide-product-chips`, `lead-slide-hero`,
`lead-product-grid`, `blocked-at-risk-product-card` (its `SEVERITY_BADGE`
label/tone only), and the label helpers in `weekly-report` /
`weekly-report-groupers` — MUST read tone/icon/dot from it rather than hold a
private copy.

Labels are variant-aware, not collapsed to one string per status. The map holds
the label variants the surfaces render today (screen sentence-case `On track` /
`At risk` / `Blocked` / `No status`; print Title-case `On Track` / `At Risk`;
`status-slide-deck`'s section-readiness vocabulary `Ready` / `Review` / `Blocked`
/ `Empty`; `lead-slide-hero`'s `Blockers`), addressed through a variant key
(`statusLabel(status, variant)`), so parity is preserved by reproducing each
existing label — not by unifying them. Which surface uses which variant is
captured by the pre-change inventory (tasks 1.1); this requirement does not
change any rendered label.

A raw status source that is not already a canonical key (a traffic-light color,
`SlideTone`, `PillStatus`, or `Severity`) MUST be mapped to a canonical key by a
normalizer (e.g. `toPillStatus`, the raw-color→`ProductStatus` function,
severity→key). That key-normalization is status derivation, not vocabulary
lookup, and is explicitly permitted; the private-copy prohibition targets
label/tone/icon/dot Records, not the enum→key normalizers.

Adding a new status-bearing surface MUST reuse the canonical map — this clause
holds repo-wide, not only for the enumerated consumers — and MUST NOT introduce
a second tone/icon/dot lookup for the canonical status set.

The color VALUES themselves stay owned by `status-color-semantics` and the
tokens introduced by `unify-web-status-color-tokens`; this map keys onto those
tokens and does not restate the token rule.

#### Scenario: an in-scope surface renders a status tone, icon, or dot

- **WHEN** an enumerated consumer renders a canonical workflow status's tone
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

### Requirement: Consolidation preserves rendered output parity per status

The system MUST render the same tone, label, icon, and dot for each in-scope
surface after the consolidation as before it, so moving the derivation into the
canonical map changes no pixel. Parity is reproduction, not unification: every
label a surface renders today MUST still render, resolved through its variant
key, and no color value, icon choice, or dot treatment changes for any canonical
status. The consolidation MUST NOT move a color onto or off any surface. Because
output is unchanged, this change is outside the `status-color-semantics` palette
sign-off gate (no visual drift is introduced).

`blocked-at-risk-product-card`'s at-risk badge foreground is a raw hex literal
(`#8a6d1b`) today; folding it into the canonical map under parity is only
possible after `unify-web-status-color-tokens` consolidates that hex onto
`--color-status-at-risk-fg`. Until then this card is gated on that predecessor
(tasks 3.6).

#### Scenario: the same canonical status renders identically across surfaces

- **WHEN** the same canonical workflow status (`blocked` / `at-risk` /
  `on-track` / `empty`) is rendered on two in-scope surfaces after consolidation
- **THEN** each surface renders the tone, label variant, icon, and dot it
  rendered before the change
- **AND** no surface's rendered status appearance differs from its pre-change
  appearance

#### Scenario: no color value moves during the refactor

- **WHEN** the consolidation re-points a surface at the canonical map
- **THEN** the token each canonical status resolves to is unchanged
- **AND** no color literal is added, removed, or moved between surfaces

### Requirement: Shared status badge and empty-state components back the in-scope surfaces

The system MUST render the slide status badge through one shared
`SlideStatusBadge` component and the empty status section through one shared
`SlideEmptyState` component, so the badge and empty-section markup are defined
once. The in-scope surfaces that previously inlined their own status badge
(`lead-product-grid` badge JSX, the `status-slide-deck` tone badge) or their own
empty placeholder MUST render the shared components. `SlideStatusBadge` MUST take
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
