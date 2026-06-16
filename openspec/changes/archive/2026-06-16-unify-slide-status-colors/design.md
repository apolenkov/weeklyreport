# Design: unify-slide-status-colors

## Canon: which value wins per status

The `status-slide-deck` pill is already partly token-aligned (blocked text uses
`--color-destructive`, on-track text uses `--color-primary`), so the canon
follows the token-aligned values and `lead-product-grid` is pulled to match.
`#c82014` IS `--color-destructive`, so blocked text already converges.

Each current border literal maps **exactly** to an existing token at a known
alpha, so converging to `color-mix` is zero visual drift on the borders:

- blocked border `rgba(200,32,20,0.24)` = `--color-destructive` (#c82014) @ 24%
- at-risk border `rgba(212,160,23,0.38)` = `--color-status-dot-at-risk` (#d4a017) @ 38%
- on-track border `rgba(0,117,74,0.28)` = `--color-starbucks-accent` (#00754a) @ 28%

| status   | bg token                      | text token                    | border (color-mix of a token)                                          |
| -------- | ----------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| blocked  | `--color-status-blocked-bg`   | `--color-destructive`         | `color-mix(in srgb, var(--color-destructive) 24%, transparent)`        |
| at-risk  | `--color-status-at-risk-bg`\* | `--color-status-at-risk-fg`\* | `color-mix(in srgb, var(--color-status-dot-at-risk) 38%, transparent)` |
| on-track | `--color-success`             | `--color-primary`             | `color-mix(in srgb, var(--color-starbucks-accent) 28%, transparent)`   |
| neutral  | `--color-muted`               | `--color-muted-foreground`    | `rgba(0,0,0,0.14)` kept (neutral chrome, not a status hue)             |

`*` = new tokens (below). bg converges the two surfaces' divergent values to one:
blocked `#fee2e2` over `#fff1f0`, at-risk `#fef3c7` over `#fff7df`, on-track to
`--color-success`. The neutral "no status" border stays a plain grey literal —
it is non-status chrome, outside this requirement.

Same-file note: `status-slide-deck`'s `readinessDot` "needs-work" bubble also
inlines the blocked bg `#fff1f0`; it converges to `--color-status-blocked-bg`
too (task 2.3 "no remaining status hex").

## Scope correction found during implementation

The memory note named two files; a full audit of `apps/web/src/components/slides/`
found a **third status-badge surface** carrying the same divergent literals:
`lead-slide-hero.tsx` `toneConfig` — and it is the badge actually visible on the
lead slide (`LeadSlideArticle` renders `LeadSlideHero`, not the `toneClass`
pill, which is the **head** layout). All three badge surfaces — hero (lead),
`toneClass` pill (head), and `lead-product-grid` `StatusBadge` — now share the
canon set.

**Canon for blocked text = `--color-destructive`, confirmed against the
reference.** The token-clean `lead/item-card.tsx` `STATUS_BADGES` already ships
blocked as `bg --color-status-blocked-bg` / `text --color-destructive`, so
converging the slides to destructive ALIGNS with the app, it does not regress.
The hero/grid had been the outliers using a darker `#7f1d1d` (red-950); both the
old `#7f1d1d` and `--color-destructive` (#c82014) clear WCAG AA on the
`#fee2e2` fill (≈8.2 and ≈4.7), so no new `blocked-fg` token is needed.

## New tokens

Added to the design-system token block in `packages/ui/src/styles/globals.css`,
next to the existing `--color-status-*` entries:

- `--color-status-at-risk-bg: #fef3c7;` — the warmer of the two existing amber
  fills (`#fef3c7` over `#fff7df`); reads as a fill, not a flooded alarm.
- `--color-status-at-risk-fg: #78350f;` — the deeper of the two amber texts;
  passes contrast on the `#fef3c7` fill.

These keep amber strictly as the at-risk accent per the spec's "one alarm hue"
requirement (red stays blocked-only).

## Why not tokenize print / item-card here

- **print** — `print-report-template.tsx` is the PDF worker's render template.
  It inherits the root layout, so tokens are technically reachable, but its
  inline hex is a deliberate self-containment choice for PDF portability.
  Changing it is a separate decision, not folded in.
- **item-card** — the priority-gold badge and delete-button hover are priority
  and control affordances, not workflow-status surfaces, so they fall outside
  `status-color-semantics`.

## Verification

- Unit: `lead-product-grid.test.tsx` + `status-slide-deck.test.tsx` (head tone
  pill) + `lead-slide-hero.test.tsx` assert each status renders through the named
  token (no raw status hex in the className).
- Render proof: the novel `color-mix` arbitrary classes + the new at-risk tokens
  are confirmed present in the compiled `.next` CSS (borders did not silently
  vanish).
- Visual: accepted on the structural proof above (spec requirement 3, user
  sign-off). Live blocked/at-risk screenshots were not feasible — the small demo
  seed is all-green and the huge seed is flaky under dev. See `VERIFICATION.md`.
- Gate: `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
