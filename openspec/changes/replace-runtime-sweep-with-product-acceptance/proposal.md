## Why

WeeklyReport's separate browser/integration harness became a second product and consumed more engineering time than the application. The owner requires the repository to retain only tests directly attached to product code, with strict readability, immutability, and explicit role boundaries in production source and democratic style rules in tests.

## What Changes

- **BREAKING** Delete the entire root `e2e/` tree, `apps/web/uat-suite/`, Playwright test dependencies/configuration, browser/integration/acceptance/UAT/catalog commands, and their dedicated CI and gate scripts.
- Keep product-adjacent Vitest tests under `apps/*/src` and `packages/*/src`, including focused database-backed tests where they directly protect domain behavior.
- Keep strict architecture, structural, complexity, immutability, and explicit role-boundary enforcement on maintained product source.
- Keep tests free of production structural/complexity/immutability budgets and preference-style rules while retaining formatting, type safety, and failure-prevention checks.
- Preserve the retired-campaign prohibition and owner-deferred mobile scope.

### Non-goals

- No replacement smoke runner, route catalog, harness, scenario inventory, custom evidence, or browser matrix.
- No product behavior, API, auth, data-model, production PDF renderer, or guarded database-operation change.
- No deletion of focused tests that live with and directly protect product code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bounded-product-acceptance`: Retires the separate browser acceptance capability.
- `uat-quality-gates`: Removes browser/integration harness commands from final acceptance.
- `scenario-catalog`: Retires the catalog capability.
- `behavioral-ui-regression-gate`: Removes deterministic browser-harness requirements.
- `ai-driver-coverage`: Keeps AI browser review advisory only.
- `driver-env-feedback`: Keeps retired driver collectors out of acceptance.
- `sweep-runtime-correctness`: Assigns correctness to product-adjacent tests.
- `directory-architecture-standard`: Removes the separate acceptance tree.

## Impact

The root `e2e/` tree and UAT tooling are deleted with their package, CI, lint, TypeScript, Knip, suppression, ownership, and documentation wiring. Product source and its colocated tests remain.
