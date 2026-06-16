# Tasks: unify-slide-status-colors

## 1. Tokens

- [x] 1.1 Add `--color-status-at-risk-bg` (#fef3c7) and `--color-status-at-risk-fg`
      (#78350f) to the `--color-status-*` block in
      `packages/ui/src/styles/globals.css`.

## 2. Converge the slide surfaces

- [x] 2.1 `lead-product-grid.tsx` `StatusBadge` — replace blocked / at-risk /
      on-track inline hex with the canon tokens from `design.md`; keep neutral on
      `--color-muted`/`--color-muted-foreground`.
- [x] 2.2 `status-slide-deck.tsx` — head `toneClass` pill + `readinessDot`
      needs-work bubble onto the canon tokens.
- [x] 2.3 `lead-slide-hero.tsx` `toneConfig` — the lead-visible badge (found in
      the implementation audit, not in the original note); same canon tokens.
- [x] 2.4 Verify no remaining status hex/rgba across `slides/` (`grep` reports
      CLEAN; only non-status chrome like the selected-card focus ring remains).

## 3. Tests

- [x] 3.1 `lead-product-grid.test.tsx` — assert each status badge resolves its
      colour through the named token, not a raw status hex.
- [x] 3.2 `status-slide-deck.test.tsx` — same assertion for the head tone pill.
- [x] 3.3 `lead-slide-hero.test.tsx` — same assertion for the lead tone badge.

## 4. Verify (spec requirement 3 — sign-off + visual acceptance)

- [x] 4.1 Visual acceptance — accepted on STRUCTURAL proof (user sign-off
      2026-06-16). Live blocked/at-risk screenshots were not feasible: the small
      demo seed is all-green (0 blocked / 0 at-risk) and the huge seed is flaky
      under the dev server + would clobber the demo dataset. Convergence is
      proven instead by (a) per-status unit tests in all three test files and
      (b) the compiled `.next` CSS carrying the exact resolved declarations
      (`color-mix(... destructive 24% ...)`, `... starbucks-accent 28% ...`,
      `... status-dot-at-risk 38% ...`, `background-color:var(--color-status-at-risk-bg)`,
      `color:var(--color-status-at-risk-fg)`). All surfaces reference one token
      set, so "same status = same color" holds by construction.
- [x] 4.2 Full gate green
      (`npx prisma generate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`).
