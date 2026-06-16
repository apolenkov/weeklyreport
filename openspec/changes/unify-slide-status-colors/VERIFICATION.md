# Verification: unify-slide-status-colors

## Outcome

All slide status-badge surfaces now draw blocked / at-risk / on-track / neutral
from one canonical token set; the cross-surface red/amber divergence is gone.

## Surfaces converged (4, not the 2 the note named)

The implementation audit found a third badge surface beyond the original note:

- `lead-slide-hero.tsx` `toneConfig` — the badge **actually visible on the lead
  slide** (`LeadSlideArticle` renders `LeadSlideHero`).
- `status-slide-deck.tsx` `toneClass` — the **head** layout status pill — plus
  the `readinessDot` "needs-work" bubble (`#fff1f0` → blocked-bg).
- `lead-product-grid.tsx` `StatusBadge`.

## Canon

| status   | bg                          | text                        | border (color-mix)               |
| -------- | --------------------------- | --------------------------- | -------------------------------- |
| blocked  | `--color-status-blocked-bg` | `--color-destructive`       | `--color-destructive` 24%        |
| at-risk  | `--color-status-at-risk-bg` | `--color-status-at-risk-fg` | `--color-status-dot-at-risk` 38% |
| on-track | `--color-success`           | `--color-primary`           | `--color-starbucks-accent` 28%   |
| neutral  | `--color-muted`             | `--color-muted-foreground`  | plain grey (non-status chrome)   |

blocked text = `--color-destructive` matches the token-clean `lead/item-card.tsx`
reference; `#7f1d1d` was the outlier. New tokens: `--color-status-at-risk-bg`
(#fef3c7), `--color-status-at-risk-fg` (#78350f).

## Evidence

- **Unit (per status, all three files):** `lead-product-grid.test.tsx`,
  `status-slide-deck.test.tsx` (head tone pill, rendered `mode="head"`),
  `lead-slide-hero.test.tsx` — each asserts the badge resolves bg + text through
  the named token AND carries no raw status hex. 43/43 pass.
- **Compiled CSS (proves the novel `color-mix` Tailwind class actually
  compiles, borders did not silently vanish):** `apps/web/.next/static/css/*`
  contains `color-mix(in srgb,var(--color-destructive) 24%,transparent)`,
  `... var(--color-starbucks-accent) 28% ...`,
  `... var(--color-status-dot-at-risk) 38% ...`,
  `background-color:var(--color-status-at-risk-bg)`,
  `color:var(--color-status-at-risk-fg)`.
- **Grep:** no status hex/rgba remains in `slides/*.tsx` (only the selected-card
  focus ring, non-status chrome).
- **Gate:** `prisma generate` + `typecheck` + `lint` (no issues) + `test`
  (1145 pass) + `build` all green.

## Visual acceptance (spec requirement 3)

Accepted on the structural proof above (user sign-off 2026-06-16). Live
blocked/at-risk screenshots were not feasible — the small demo seed is all-green
and the huge seed is flaky under dev + would clobber the demo dataset.

**Visible shift for the record:** blocked text in hero/grid is brighter
(`#7f1d1d` → `#c82014`); the deck blocked pill bg is slightly pinker
(`#fff1f0` → `#fee2e2`); on-track bg moves to `--color-success`. Both reds clear
WCAG AA on the `#fee2e2` fill (≈8.2 for the old, ≈4.7 for destructive).
