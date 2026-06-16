# Proposal: unify-slide-status-colors

## Why

The slide surfaces render the same workflow status in **different colours**, so
"blocked" is not one red on the slides experience:

- `lead-product-grid.tsx` `StatusBadge` — blocked bg `#fee2e2`, text `#7f1d1d`;
  at-risk bg `#fef3c7`, text `#78350f`.
- `status-slide-deck.tsx` status pill — blocked bg `#fff1f0`, text `#c82014`;
  at-risk bg `#fff7df`, text `#725313`.

Both live in the same "slides" experience (the lead/head deck plus the lead
product grid), so a presenter flipping through sees two different blocked-reds
and two different at-risk ambers. The durable `status-color-semantics` spec
already forbids inlined status literals and mandates one alarm hue, but these
slide surfaces pre-date that work and were never brought into compliance. This
is a visual inconsistency to reconcile, not loose tokenization.

This is **not** part of the print template (`print/[reportId]/print-report-
template.tsx`, deliberately self-contained inline hex for the PDF worker) nor
the item-card priority/control affordances (priority-gold badge, delete-hover) —
those are separate concerns and out of scope here.

## What Changes

- **Define the canonical status colour set as named tokens.** Reuse the existing
  `--color-status-blocked-bg` / `--color-destructive` for blocked; add the two
  missing at-risk tokens (`--color-status-at-risk-bg`,
  `--color-status-at-risk-fg`) so the swap is clean rather than re-inventing a
  literal.
- **Converge both slide surfaces onto that token set.** `lead-product-grid`
  `StatusBadge` and the `status-slide-deck` status pill render blocked / at-risk /
  on-track / neutral through the same `--color-*` tokens — no inlined status hex.
- **Bring slides explicitly under the spec's coverage** so future slide work
  cannot drift back to literals.

## Impact

- Affected specs: `status-color-semantics` (MODIFIED — name slide surfaces in
  coverage; ADDED — slide status colours come from the shared token set).
- Affected code: `packages/ui/src/styles/globals.css` (two new at-risk tokens),
  `apps/web/src/components/slides/lead-product-grid.tsx`,
  `apps/web/src/components/slides/status-slide-deck.tsx`, plus their unit tests.
- Sign-off: authorized this session (2026-06-16) — user chose "завести OpenSpec-
  изменение" for the slide red/amber divergence. Per the spec's third
  requirement, before/after same-viewport screenshots are produced for
  acceptance before archiving.
