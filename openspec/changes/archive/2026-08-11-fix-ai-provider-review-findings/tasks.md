## 1. API provider lifecycle

- [x] 1.1 Preserve `active` lifecycle when recording a retest result, while retaining normal validated/failed transitions for inactive revisions.
- [x] 1.2 Add service and repository regression tests for successful and failed retests of the active revision.

## 2. Legacy bootstrap configuration

- [x] 2.1 Remove `MISTRAL_API_SERVER` from the environment contract, bootstrap dependencies, and related tests.
- [x] 2.2 Remove the obsolete variable from Compose, examples, and rollout documentation while retaining the global Mistral endpoint.

## 3. Lead assistant availability UI

- [x] 3.1 Enable the Chat trigger only after an explicit `available` response.
- [x] 3.2 Add UI regression coverage for unresolved and failed availability reads.

## 4. Verification

- [x] 4.1 Run the affected API and Web Vitest suites.
- [x] 4.2 Run `pnpm typecheck` and `pnpm lint`.
