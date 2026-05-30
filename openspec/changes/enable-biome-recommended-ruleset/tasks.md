## 1. Config flip (biome.json)

- [ ] 1.1 Set `linter.rules.recommended: true` in `biome.json`
- [ ] 1.2 Disable `correctness.useExhaustiveDependencies` and
  `correctness.useHookAtTopLevel` (set to `"off"`) — ESLint owns hooks
- [ ] 1.3 Add `complexity.noExcessiveCognitiveComplexity` at `"warn"` with
  `options.maxAllowedComplexity: 15`
- [ ] 1.4 Confirm existing overrides are intact: AI-module `noRestrictedImports`,
  `noExplicitAny: error`, `noNonNullAssertion: warn`

## 2. Autofix the mechanical bulk

- [ ] 2.1 Run safe `biome check --write .`; record the resolved count
- [ ] 2.2 Review `biome check --write --unsafe .` candidates per-fix; apply only
  the semantically-safe ones (reject anything that changes behavior)
- [ ] 2.3 Re-run `biome check .`; confirm the only remaining errors are the
  manual buckets (a11y + the ~12 non-a11y manual) and `warn`-level cognitive

## 3. Hand-fix a11y at error (apps/web first, then apps/api)

- [ ] 3.1 `noSvgWithoutTitle` (~34): add `<title>` / `aria-label`, English text
- [ ] 3.2 `useAriaPropsSupportedByRole` (~29): correct aria props for the role
- [ ] 3.3 `noStaticElementInteractions` (~13) + `useKeyWithClickEvents` (~11):
  add keyboard handlers / semantic elements
- [ ] 3.4 `useSemanticElements` (~4), `useButtonType` (~2), `useHtmlLang` (~1)
- [ ] 3.5 Flag any a11y fix needing a real UX decision in the PR instead of
  guessing silently
- [ ] 3.6 Verify no Russian leaked into production UI strings:
  `grep -nE '[а-яА-Я]' <changed apps/web/**/*.tsx>` — every match must be data,
  comment, or test

## 4. Resolve the remaining non-a11y manual findings

- [ ] 4.1 Fix the ~12 remaining `suspicious` / `correctness` / `security`
  findings (e.g. `noArrayIndexKey`, `noDangerouslySetInnerHtml`) by hand

## 5. Docs + durable spec

- [ ] 5.1 Update the `eslint.config.ts` header comment to reference the
  `lint-toolchain-ownership` spec (Biome owns recommended; ESLint owns the four;
  `tsc` separate)
- [ ] 5.2 Confirm `complexity/noExcessiveCognitiveComplexity` warnings (65) are
  visible and explicitly out of scope here (handed to architecture change B)

## 6. Verification (run and paste output)

- [ ] 6.1 `pnpm typecheck` — 0 errors
- [ ] 6.2 `pnpm lint` — 0 errors (cognitive-complexity warnings are non-blocking)
- [ ] 6.3 `pnpm test` — green
- [ ] 6.4 `pnpm build` — green
- [ ] 6.5 `pnpm lint:md` — green (this change's markdown)
- [ ] 6.6 Land as a single commit; confirm config + all fixes are atomic for
  clean rollback
