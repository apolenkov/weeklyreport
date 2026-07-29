# Tasks

## 1. Configuration inventory

- [x] Enumerate all 26 `files:` blocks with selectors, parser/project context,
      plugins, rule deltas, ignores, and representative matching files.
- [x] Compute effective config for positive and nearby negative representatives.
- [x] Classify every block as enforcement, policy, specialization, duplicate,
      or relaxation debt with source evidence.

## 2. Policy-preserving cleanup

- [x] Consolidate only blocks whose effective intended configuration is
      identical and whose merge does not widen or narrow coverage.
- [x] Remove or redesign every relaxation-debt block; do not relocate its
      exceptions to inline suppressions or ignores.
- [x] Keep necessary source, package-public-API, web, API, architecture, domain,
      test, config, UAT, and e2e distinctions explicit.

## 3. Verification

- [x] Store the 26-block classification ledger and validate it against current
      `eslint.config.ts`.
- [x] Plant positive/negative scope probes for every retained block family.
- [x] Re-run `pnpm lint:eslint`, `pnpm catalogue`,
      `pnpm lint:exemplary-floor`, `pnpm lint`, and `pnpm typecheck`.
- [x] Update `overrideBlocks` to the exact measured retained count with no
      enforcement regression.
- [x] Run `openspec validate refactor-eslint-policy-scopes --strict`.

Evidence (2026-07-29):

- `scripts/eslint-policy-scope-ledger.json`: 26/26 blocks, 6 enforcement,
  14 policy, 6 specialization, 0 duplicate, 0 relaxation debt.
- `pnpm lint:eslint-scopes`: 32 production-config planted checks pass.
- `pnpm catalogue` and `pnpm lint:exemplary-floor`: 851/930 product files on
  floor, 26 retained scope blocks, 72 live suppressions.
- `pnpm typecheck`: 5/5 tasks pass.
- `pnpm lint:eslint`: pass after the scope probe implementation.
- `openspec validate refactor-eslint-policy-scopes --strict`: pass.
