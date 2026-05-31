# Tasks — Phase 2: Declare the Lint Max-Strictness Standard

Spec-first. **No live strict rule is enabled** — the gate stays as green as
Phase 1 left it. Model: Opus (concept/declaration; cheap, no fixup work).

## 1. Spec capability

- [ ] D1a Land the `lint-max-strictness-standard` delta spec (this change) and
      run `openspec validate declare-lint-max-strictness --strict`.
- [ ] D1b Cross-check every grilled decision (base, plugin surface, thresholds,
      JSDoc scope, boundary map, unicorn off-list, severity reconciliation) is
      represented as a requirement with ≥1 scenario.

## 2. Non-gating config scaffold (optional, no behavior change)

- [ ] D2a Add a comment block to `eslint.config.ts` pointing at the
      `lint-max-strictness-standard` spec and listing the Phase-3 ratchet targets
      (the rule families + thresholds). Enable **no** live rule.
- [ ] D2b Record the documented exclude-list seed (the inherited a11y carve-outs)
      next to the existing inline rationales, so Phase 3 starts from a known list.
- [ ] D2c (carried from Phase-1 micro-item) Editor-only TS diagnostics on
      `eslint.config.ts` / `artifacts-eslint.config.ts`: `[7016]` (jsx-a11y has no
      type decls) and `[2322]` (react-hooks upstream `Plugin` type mismatch). The
      `pnpm typecheck` gate does NOT catch them. Decide explicitly: a
      `declare module "eslint-plugin-jsx-a11y"` one-liner silences `[7016]` only;
      `[2322]` needs a cast/`@ts-expect-error` for zero gate benefit. Default:
      leave as-is unless an editor-clean config is wanted.

## 3. Verify the boundary mechanism is real (de-risk Phase 3)

- [ ] D3a Confirm `@typescript-eslint/no-restricted-imports` supports
      `allowTypeImports: true` for the `apps/web` → `apps/api` AppRouter carve-out
      (or pick `eslint-plugin-boundaries`); record the chosen mechanism in the
      spec note. No enforcement is turned on yet.

## 4. Gate

- [ ] D4a `pnpm lint` output is byte-for-byte unchanged from Phase 1 (no new
      firings). `pnpm typecheck` / `pnpm build` still green.
- [ ] D4b Confirm sequencing: this change depends on `migrate-lint-to-eslint-prettier`
      (Complete) and is referenced as the prerequisite of `ratchet-lint-to-strict`.
