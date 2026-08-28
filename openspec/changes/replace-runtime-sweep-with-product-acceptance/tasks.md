## 1. Owner direction and contract

- [x] 1.1 Delete the 859-file `e2e/runtime-sweep/` platform and every live campaign/continuation consumer.
- [x] 1.2 Record the owner's final boundary: no root E2E, Playwright test, UAT, catalog, acceptance, integration harness, or replacement smoke; keep only product-adjacent tests.
- [x] 1.3 Reconcile proposal, design, and affected delta specs to the no-harness contract; verify `pnpm exec openspec validate replace-runtime-sweep-with-product-acceptance --strict` passes.

## 2. Remove the separate test platform

- [x] 2.1 Delete the entire root `e2e/` tree and `apps/web/uat-suite/`; verify both paths contain zero files.
- [x] 2.2 Remove Playwright test dependencies and all E2E/UAT/catalog/acceptance/integration-harness package commands while retaining the API production PDF `playwright` dependency; verify package manifests contain no `@playwright/test` or `@axe-core/playwright`.
- [x] 2.3 Remove dedicated browser CI jobs, pre-push steps, lint gates, TypeScript/Vitest/Knip entries, ownership catalogues, suppressions, and test-platform baselines; verify no live config references a deleted path.
- [x] 2.4 Update repository, onboarding, SDLC, quality, and contribution guidance to describe colocated product tests only; verify no documented command points into `e2e/` or UAT/catalog tooling.

## 3. Product-code quality policy

- [x] 3.1 Preserve strict production structural, complexity, immutability, import-boundary, and canonical-role enforcement while retaining democratic test rules; verify effective ESLint config for representative product and test files.
- [x] 3.2 Remove obsolete test-platform policy probes without weakening product-source probes; verify ESLint scope and exemplary-structure planted checks pass.

## 4. Verification and integration

- [x] 4.1 Run `pnpm format:check`, `pnpm typecheck`, full non-fail-fast `pnpm lint`, `pnpm test`, and an explicitly configured production `pnpm build`; verify every remaining gate exits zero.
- [x] 4.2 Run `pnpm exec openspec validate --all --strict`, prove a clean exact branch/HEAD/tree, confirm six mobile changes / 15 tasks stayed untouched, and create a local integration checkpoint with remote/CI evidence reported separately.
