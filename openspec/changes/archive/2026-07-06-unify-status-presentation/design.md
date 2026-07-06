## Context

Status display vocabulary is re-derived across 8 in-scope surfaces. Each holds
its own label lookup, tone/dot `Record`, and icon choice — and, critically, they
do NOT agree on either the status KEY set or the LABEL text:

| Surface                            | Key set                                        | Duplicated derivation                              |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `status-slide-deck.tsx`            | `SlideTone` ready/warning/blocked/empty        | `toneClass`, `toneLabel`                           |
| `slide-activity-pills.tsx`         | `PillStatus` green/yellow/red/empty            | `PILL_DOT_CLASS`, `PILL_STATUS_LABEL`              |
| `slide-product-chips.tsx`          | `ProductStatus` blocked/at-risk/on-track/empty | `STATUS_DOT_CLASS`, `STATUS_LABEL`                 |
| `lead-slide-hero.tsx`              | `ToneVariant` blocked/at-risk/on-track/empty   | `toneConfig` (label + className + icon)            |
| `lead-product-grid.tsx`            | (product status)                               | inline status badge JSX                            |
| `blocked-at-risk-product-card.tsx` | `Severity` blocked/at-risk                     | `SEVERITY_BADGE`, `SEVERITY_TONE`, `AVATAR_CONFIG` |
| `weekly-report.ts`                 | on-track/at-risk/blocked                       | `productStatusLabel` (Title case)                  |
| `weekly-report-groupers.ts`        | on-track/at-risk/blocked                       | `statusLabelFor` (Title case)                      |

The same conceptual status renders under **different labels** today: on-track is
`Ready` (deck), `On track` (pills/chips/hero), `On Track` (weekly print);
blocked is `Blocked` everywhere except `Blockers` (hero); at-risk is `Review`
(deck section-readiness) vs `At risk` / `At Risk`. A single `statusLabel(status)`
therefore cannot reproduce byte-for-byte output — the label layer is genuinely
variant-shaped, not a single string per status. What IS structurally identical
across surfaces is the tone-token key, icon, and dot each status resolves to;
that is what the map unifies.

The tokens each map keys onto are defined by `status-color-semantics` and (for
the color values) `unify-web-status-color-tokens`. What is missing is a single
tone/icon/dot derivation layer above the tokens.

## Goals / Non-goals

**Goals**

- One canonical status map: `status → { toneTokenKey, icon, dotClassName,
labels }`, keyed on `blocked` / `at-risk` / `on-track` / `empty`, with thin
  helpers.
- Variant-aware labels so every surface's existing label is reproduced, not
  collapsed.
- Shared `SlideStatusBadge` and `SlideEmptyState` components.
- Every in-scope surface reads tone/icon/dot from the map; none re-derives them.

**Non-goals**

- No color value changes. Tokens stay owned by `status-color-semantics` /
  `unify-web-status-color-tokens`; this map only keys onto them.
- No new status states, no relabeling, no icon/dot redesign — output parity is a
  hard requirement.
- No API, Prisma, shared-schema, or dependency change.
- NOT a repo-wide status-map sweep. Surfaces outside the 8 (product-accordion,
  lead-summary-table, item-card / item-card-style, sdlc-pipeline-health,
  activity-status-strip, dashboard-leads `TRAFFIC_ICON`) keep their own maps and
  are out of scope; the only repo-wide clause is the forward-looking "a new
  surface MUST reuse the map."

## Decisions

**D1 — Map lives in `apps/web/src/lib`, not `packages/ui`.** The status set is
CustomReport-domain vocabulary (blocked / at-risk / on-track / empty), not a
generic UI primitive. Keeping it in web-lib avoids widening the shared `ui`
surface for a domain concept. `SlideStatusBadge` / `SlideEmptyState` are web
slide components for the same reason.

**D2 — Helpers wrap the map, callers do not read raw records.** Surfaces call
`statusLabel(status, variant)` / `statusToneClassName(status)` /
`statusIcon(status)` / `statusDotClassName(status)` rather than indexing a
`Record`, so the map's shape can evolve without touching callers.

**D3 — `SlideStatusBadge` takes a status, not a pre-formatted tone/color.**
Accepting a canonical status (plus a label variant) and resolving icon/tone
internally is what makes the map the single source; a `color`-prop API would let
a caller bypass it and re-introduce drift.

**D4 — Tone keys map to existing tokens; no new token.** The map's `toneTokenKey`
resolves to the tokens `status-color-semantics` already fixes
(`--color-destructive` for blocked, `--color-status-dot-at-risk` /
`--color-status-at-risk-*` for at-risk, `--color-primary` / `--color-success`
for on-track, muted for empty). This change introduces none. Exception carried
for parity: `blocked-at-risk-product-card`'s at-risk badge foreground is a raw
hex `#8a6d1b` today, not a token — see D8; the map can only key it onto a token
after `unify-web-status-color-tokens` replaces it.

**D5 — Labels are variant-keyed, parity by reproduction not unification.** The
surfaces render genuinely different labels for the same status (screen
sentence-case, print Title-case, `status-slide-deck`'s section-readiness
`Ready`/`Review`, hero's `Blockers`). The map carries each existing label under
a variant key and `statusLabel(status, variant)` selects it, so every current
label still renders. `status-slide-deck`'s `SlideTone` is a section-_readiness_
vocabulary, not product health; it shares tone/icon/dot via a normalizer (D6)
but keeps its own `Ready`/`Review` labels — it is explicitly NOT relabeled to
the product-status words. Collapsing all surfaces onto one label per status is a
visible product change requiring owner sign-off and is deliberately out of scope
here; noted as a possible later simplification, not taken.

**D6 — Enum→key normalizers are permitted; the no-private-lookup rule targets
vocabulary Records, not derivation.** Surfaces that start from a non-canonical
source (`toPillStatus` for `PillStatus`, the raw-traffic-light→`ProductStatus`
function, `SlideTone`→key, `Severity`→key) keep those normalizers. Mapping a raw
enum to a canonical status is status derivation, not a label/tone/icon/dot
lookup, so it does not violate "no private copy." Without this, the four
incompatible key sets (`SlideTone` / `PillStatus` / `ProductStatus` / `Severity`)
could not feed one map at all.

**D7 — Requirement 1 is scoped to the 8 enumerated consumers plus a repo-wide
forward clause.** The blanket "no surface holds a private status Record" would be
false the day it archives — product-accordion, lead-summary-table, item-card,
sdlc-pipeline-health and others keep their maps and are out of scope. So the
"reads from the map" obligation binds only the enumerated 8; only "a NEW status
surface MUST reuse the map" is repo-wide.

**D8 — `blocked-at-risk-product-card` is partially in scope, gated on the
color-tokens change.** Only `SEVERITY_BADGE`'s label + tone folds into the map.
`SEVERITY_TONE` is a left-_rail_ color (destructive vs
`--color-status-at-risk-border`) and `AVATAR_CONFIG` is a separate bg/fg pair —
neither fits the map's `{ label, toneTokenKey, icon, dot }` shape, so both stay
as-is. The badge fold is gated on `unify-web-status-color-tokens` task 4.1 having
replaced the raw `#8a6d1b` foreground with `--color-status-at-risk-fg`; until
then folding it would either change the color (breaks parity) or import a hex
literal into the canonical module (breaks the tokens-only posture).

## Load-bearing invariants

None touched. This change does not go near period dual-state, the role-coverage
gate, the destructive-DB guard, or the deferred-feature pattern — it is a
web-only presentation-layer de-duplication. It preserves the
`status-color-semantics` invariants (tokens not literals; red = blocked only;
amber = at-risk accent) by output parity rather than by restating them.

## Risks

- **R1 — a surface's "identical" class string is subtly different** (e.g. a
  `color-mix` percentage differs between `lead-slide-hero` and
  `status-slide-deck`). Mitigation: inventory each surface's exact class string
  before folding it in; where two surfaces differ today, treat the divergence as
  a separate visible-change decision, not silently unified under this refactor.
- **R2 — the label divergence is silently unified.** Confirmed real (D5).
  Mitigation: the parity requirement is explicitly reproduction-not-unification;
  the 1.1 inventory records which variant each surface uses, and any surface
  whose exact label is not reproduced is a parity failure.
- **R3 — the palette sign-off gate misreads this as a palette edit.** Mitigation:
  the output-parity requirement makes the gate moot (no visual drift); the
  proposal and spec state this explicitly.

## Pre-existing debt carried for parity

`status-slide-deck` and `lead-slide-hero` both render the empty tone with a raw
`border-[rgba(0,0,0,0.14)]` literal. Centralizing the empty tone moves that
literal INTO the canonical module. Parity forbids changing it here; it is flagged
as pre-existing debt to be tokenized under `unify-web-status-color-tokens`
(which introduces `--color-border-subtle`), not fixed in this change.

## Review dispositions

- **Rejected: "dependency `unify-web-status-color-tokens` does not exist as an
  OpenSpec change."** It does — `openspec/changes/unify-web-status-color-tokens/`
  is a scaffolded change with a real `tasks.md` (task 4.1 consolidates `#8a6d1b`
  onto `--color-status-at-risk-fg`). The "must land after" ordering has a
  concrete predecessor to track.

## Rollout

Planning-only until implemented. Ordered AFTER `unify-web-status-color-tokens`:
the canonical map keys onto the tokens that change introduces (and needs the
`#8a6d1b` consolidation for the at-risk card), so it must land first. No
migration, no flag, no destructive op. Verify by snapshot/DOM parity on each
re-pointed surface plus the full web unit suite.
