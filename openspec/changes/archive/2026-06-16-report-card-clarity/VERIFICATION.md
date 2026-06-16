# Verification — report-card-clarity

## status-color-semantics sign-off (required before archive)

This change edits status-color application (the stage chip stops encoding
workflow status; the status signal moves to the item row's left stripe), so the
`status-color-semantics` requirement requires an authorizing sign-off plus
same-viewport before/after product-card screenshots.

- **Sign-off:** the live-demo-feedback grill session, 2026-06-16 (the same
  session that produced this change cluster; user authorized the chip→identity +
  stripe direction).
- **Screenshots (same viewport, same product card — head report, `small`
  seed, "Маркетинговый портал"):**
  - Before: `screenshots/product-card-before.png`
  - After: `screenshots/product-card-after.png`

### What the before/after shows

- **Before:** the stage chip "Development · ВИ" is filled RED because the item is
  blocked — text says stage, fill says status (the dual-meaning defect). The
  "Needs Attention" banner repeats the blocked item's text verbatim.
- **After:** the stage chip is a neutral bordered identity pill (uniform
  regardless of status). The blocked state reads from the row's red left stripe +
  blocked background. The duplicate "Needs Attention" banner is suppressed.

## Tokens

All new status colors resolve through named `--color-*` tokens
(`--color-destructive` blocked stripe, `--color-success` completed stripe,
`--color-border`/`--color-surface-empty`/`--color-muted-foreground` chip). No new
hardcoded hex/rgba status literal was added.

## Completed-vs-in-progress distinguishability

`small` has no completed current items, so the chip/stripe distinction for
completed is proven by unit assertion rather than the screenshot: see
`product-accordion.test.tsx` → "maps each workflow status to a distinct row
stripe and a uniform chip" (blocked → `--color-destructive`, completed →
`--color-success`, in-progress → `transparent`; all chips share one class).

## Gate

`prisma generate && typecheck && lint && test && build` — all green
(1132+ web tests, incl. the new dedup, by-lead-slice, and stripe-state tests).
