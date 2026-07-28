# Tasks

## 1. Configuration inventory

- [ ] Enumerate all 26 `files:` blocks with selectors, parser/project context,
      plugins, rule deltas, ignores, and representative matching files.
- [ ] Compute effective config for positive and nearby negative representatives.
- [ ] Classify every block as enforcement, policy, specialization, duplicate,
      or relaxation debt with source evidence.

## 2. Policy-preserving cleanup

- [ ] Consolidate only blocks whose effective intended configuration is
      identical and whose merge does not widen or narrow coverage.
- [ ] Remove or redesign every relaxation-debt block; do not relocate its
      exceptions to inline suppressions or ignores.
- [ ] Keep necessary source, package-public-API, web, API, architecture, domain,
      test, config, UAT, and e2e distinctions explicit.

## 3. Verification

- [ ] Store the 26-block classification ledger and validate it against current
      `eslint.config.ts`.
- [ ] Plant positive/negative scope probes for every retained block family.
- [ ] Re-run `pnpm lint:eslint`, `pnpm catalogue`,
      `pnpm lint:exemplary-floor`, `pnpm lint`, and `pnpm typecheck`.
- [ ] Update `overrideBlocks` to the exact measured retained count with no
      enforcement regression.
- [ ] Run `openspec validate refactor-eslint-policy-scopes --strict`.
