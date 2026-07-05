## Why

The same status vocabulary — tone, label, icon, and dot — is re-derived by hand
in 8 slide, dashboard, and print surfaces. Each keeps its own
`Record<status, className>` map, its own label lookup, and its own icon/dot
choice, so a change to how a status reads has to be copied N times and the
surfaces silently drift apart. They have already drifted: the same status
renders under different keys (`SlideTone` / `PillStatus` / `ProductStatus` /
`Severity`) and different labels (`Ready` vs `On track` vs `On Track`; `Blocked`
vs `Blockers`).

## What Changes

- Add one canonical status map (tone-token key, icon, dot, and variant-keyed
  labels) plus small helpers (`statusLabel(status, variant)` /
  `statusToneClassName` / `statusIcon` / `statusDotClassName`) that every
  in-scope surface reads from for tone, icon, and dot.
- Add shared `SlideStatusBadge` and `SlideEmptyState` components so the badge
  and empty-section markup live in one place instead of being re-inlined.
- Retire the per-surface tone/icon/dot duplicates in `status-slide-deck`
  (`toneClass` / `toneLabel`), `slide-activity-pills` (`PILL_DOT_CLASS` /
  `PILL_STATUS_LABEL`), `slide-product-chips` (`STATUS_DOT_CLASS` /
  `STATUS_LABEL`), `lead-slide-hero` (`toneConfig`), `lead-product-grid`
  (inline badge JSX), `blocked-at-risk-product-card` (`SEVERITY_BADGE`
  label/tone only — the rail `SEVERITY_TONE` and `AVATAR_CONFIG` stay), and the
  label functions in `weekly-report` / `weekly-report-groupers` — each now reads
  the canonical map. Enum→canonical-key normalizers (e.g. `toPillStatus`) stay;
  they are derivation, not vocabulary lookup.
- **Structural de-duplication under output parity.** The rendered
  tone/label/icon/dot for each surface stays byte-for-byte identical — labels are
  reproduced through variant keys, not unified — so no color value moves and no
  surface looks different after the change.

## Capabilities

### New Capabilities

- `status-presentation-model`: the single source for the status tone-token key,
  icon, dot, and variant-keyed labels, plus the shared `SlideStatusBadge` /
  `SlideEmptyState` components that the 8 in-scope surfaces consume. Governs the
  tone/icon/dot derivation layer, not the color values.

### Modified Capabilities

None. This change touches no existing requirement header. `status-color-semantics`
stays the authority for which token a status resolves to; this capability sits
on top of it as the derivation layer and preserves output parity, so
`status-color-semantics`, `status-slide-rendering`, `head-slide-density`,
`status-risk-unification`, and `slide-capacity-signals` are unchanged. There is
no MODIFIED collision to flag.

## Dependencies

Depends on `unify-web-status-color-tokens` (`openspec/changes/`, Roadmap #3
predecessor), which owns the status color tokens and consolidates the raw
`#8a6d1b` at-risk foreground onto `--color-status-at-risk-fg`. This change
consumes those tokens through the canonical map; it must land after that change
so the tokens the map keys on already exist.

## Impact

- `apps/web/src/lib` — new canonical status map + helpers.
- `apps/web/src/components/{slides,dashboard}` and
  `apps/web/src/lib/mappers` — the 8 enumerated surfaces re-pointed at the map
  for tone/icon/dot.
- No API, Prisma, shared-schema, or dependency change. Planning-only until
  implemented; no color values change.
