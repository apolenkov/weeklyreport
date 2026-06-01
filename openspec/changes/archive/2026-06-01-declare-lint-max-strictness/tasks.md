# Tasks — Phase 2: Declare the Lint Max-Strictness Standard

Spec-first. **No live strict rule is enabled** — the gate stays as green as
Phase 1 left it. Model: Opus (concept/declaration; cheap, no fixup work).

## 1. Spec capability

- [x] D1a Land the `lint-max-strictness-standard` delta spec (this change) and
      run `openspec validate declare-lint-max-strictness --strict`.
      → spec.md present; `openspec validate --strict` green (2026-06-01).
- [x] D1b Cross-check every grilled decision (base, plugin surface, thresholds,
      JSDoc scope, boundary map, unicorn off-list, severity reconciliation) is
      represented as a requirement with ≥1 scenario.
      → 7 ADDED requirements, each with ≥1 scenario, cover all 7 decisions.

## 2. Non-gating config scaffold (optional, no behavior change)

- [x] D2a Add a comment block to `eslint.config.ts` pointing at the
      `lint-max-strictness-standard` spec and listing the Phase-3 ratchet targets
      (the rule families + thresholds). Enable **no** live rule.
      → comment block added before `export default`; no live rule enabled.
- [x] D2b Record the documented exclude-list seed (the inherited a11y carve-outs)
      next to the existing inline rationales, so Phase 3 starts from a known list.
      → exclude-list seed listed in the same comment block (the 2 jsx-a11y off
      rules + the test-file full-a11y-off override).
- [x] D2c (carried from Phase-1 micro-item) Editor-only TS diagnostics on
      `eslint.config.ts` / `artifacts-eslint.config.ts`: `[7016]` (jsx-a11y has no
      type decls) and `[2322]` (react-hooks upstream `Plugin` type mismatch). The
      `pnpm typecheck` gate does NOT catch them.
      → DECIDED: leave as-is. `[7016]`/`[2322]` are editor-only (not caught by
      `pnpm typecheck`, confirmed); silencing them buys zero gate benefit and a
      cast/`@ts-expect-error` would add noise. No editor-clean config requested.

## 3. Verify the boundary mechanism is real (de-risk Phase 3)

- [x] D3a Confirm `@typescript-eslint/no-restricted-imports` supports
      `allowTypeImports: true` for the `apps/web` → `apps/api` AppRouter carve-out
      (or pick `eslint-plugin-boundaries`); record the chosen mechanism in the
      spec note. No enforcement is turned on yet.
      → CONFIRMED: `allowTypeImports` present in installed
      `@typescript-eslint/eslint-plugin@8.60.0` (`dist/rules/no-restricted-imports.js`).
      Mechanism chosen: `@typescript-eslint/no-restricted-imports` (not
      eslint-plugin-boundaries). Recorded in the eslint.config.ts comment block.

## 4. Gate

- [x] D4a `pnpm lint` output is byte-for-byte unchanged from Phase 1 (no new
      firings). `pnpm typecheck` / `pnpm build` still green.
      → `eslint .` = 0 errors, 288 warnings (matches the Phase-1 baseline). The
      D2a edit is comment-only, so it cannot alter typecheck/build/test output.
- [x] D4b Confirm sequencing: this change depends on `migrate-lint-to-eslint-prettier`
      (Complete) and is referenced as the prerequisite of `ratchet-lint-to-strict`.
      → ratchet-lint-to-strict task R0a names this change as its precondition;
      proposal Impact section states "Blocks ratchet-lint-to-strict (Phase 3)".
