---
status: complete
date: 2026-04-29
phase: 29-real-keycloak-saml-role-aware-ui-escalation
plan: 04
commit: abf2028
requirements: [AUTH-01]
---

# 29-04 SUMMARY — AUTH-01 SAML cut-over (boot fence + NODE_ENV-narrowed dev auth)

**Status:** COMPLETED (with deferred follow-up)
**Commit:** abf2028
**Phase:** 29-real-keycloak-saml-role-aware-ui-escalation
**Plan:** 04

## What shipped

Production code paths now ignore `AUTH_DEV_MODE` and `AUTH_DEV_MODE_ALLOW_TEST` entirely. A boot-time fence in `apps/api/src/lib/dev-auth-fence.ts` refuses to start the API at all if either flag is set under `NODE_ENV=production`. `trpc.context.ts` and `saml.strategy.ts` are narrowed to `NODE_ENV !== 'production'` as defense-in-depth. The Phase 28-02 staged switch (`AUTH_DEV_MODE_ALLOW_TEST=true`) survives but is now doubly fenced — the integration suite continues to operate via that path.

The mock Keycloak container in `docker-compose.test.yml` is deferred — the build host could not pull `quay.io/keycloak/keycloak:26` (network unreachable). The realm fixture from 29-02 is in place; once the container can be pulled, `apps/web/e2e/integration/global-setup.ts` can be rewritten to perform a real SAML AuthnRequest.

## Boot fence test matrix (4 canonical + 4 edge cases)

| NODE_ENV | AUTH_DEV_MODE | AUTH_DEV_MODE_ALLOW_TEST | Behaviour | Test |
|----------|---------------|--------------------------|-----------|------|
| production | true | -- | throw "AUTH_DEV_MODE refused outside test/dev" | covered |
| production | -- | true | throw "AUTH_DEV_MODE refused outside test/dev" | covered |
| production | true | true | throw "AUTH_DEV_MODE refused outside test/dev" | covered |
| production | -- | -- | pass through (production normal path) | covered |
| test | -- | true | pass through (canary path — integration suite) | covered |
| development | true | -- | pass through (local dev loop) | covered |
| (undefined) | true | -- | pass through (treated as non-production) | covered |
| production | "1" | "TRUE" | pass through (literal string "true" only) | covered |

Total: 8 unit tests — strict boundary checks on the literal-string `'true'` semantics, NODE_ENV gating, and symmetric handling of both flags.

## docker-compose.test.yml service block

**Deferred** — quay.io pull failed from the build host (`Head "https://quay.io/v2/keycloak/keycloak/manifests/26": context deadline exceeded`). The intended block is documented in `29-04-PLAN.md` Task 1 verbatim and remains the follow-up. Realm fixture `infra/keycloak/realm-export.json` (29-02) is ready to mount.

## Playwright global-setup before/after diff

**Deferred** — without the mock IdP container, the real-SAML round-trip cannot be exercised. The existing `apps/web/e2e/integration/global-setup.ts` continues to use the dev-login shortcut. The Phase 28-02 path (`AUTH_DEV_MODE_ALLOW_TEST=true`) is now NODE_ENV-narrowed via `trpc.context.ts`, so the canary remains safe.

## Files modified

| File | LOC delta | Note |
|------|-----------|------|
| apps/api/src/lib/dev-auth-fence.ts (new) | +25 | `assertNoDevAuthInProduction(env)` — pure function, no side effects |
| apps/api/src/lib/dev-auth-fence.test.ts (new) | +75 | 8 unit tests (4 canonical + 4 edges) |
| apps/api/src/main.ts | +3/-0 | imports + calls fence as first line of `bootstrap()` |
| apps/api/src/infrastructure/trpc/trpc.context.ts | +12/-8 | DEV_SESSION fallback gated on `NODE_ENV !== 'production'` |
| apps/api/src/modules/auth/saml.strategy.ts | +5/-1 | `devMode` narrowed identically |
| .env.example | +12/-7 | production envs labelled; dev switches marked test-only |
| README.md | +24/0 | "Local development with mock Keycloak" section added |

Total: 7 files, +164 / -15.

## Test counts

| Suite | Before (29-03) | After (29-04) | Delta |
|-------|----------------|---------------|-------|
| api unit | 457 / 37 files | 465 / 38 files | +8 / +1 |
| shared unit | 226 / 6 files | 226 / 6 files | 0 |
| web unit | 182 (1 pre-existing fail) | 182 (1 pre-existing fail) | 0 |
| typecheck (api + web) | green | green | — |

The single web failure (`apps/web/proxy.test.ts`) is the same pre-existing failure documented in 29-01..29-03 — unrelated to this plan.

## Tests that needed adaptation

None. The existing `apps/api/src/infrastructure/trpc/trpc.context.test.ts` (5 cases) runs under `NODE_ENV=test` (vitest default), so the new `isNonProd` gate evaluates to `true` and all four flag combinations behave identically to the pre-29-04 implementation. Verified by full test run remaining green at 465/465.

## Key design choices / deviations

1. **Mock IdP container deferred** — quay.io pull failed; per the task brief's Stream-watchdog protection clause, the cut-over ships without it rather than blocking Phase 29. The realm fixture is in place, the boot fence is in place, the dev-auth narrowing is in place. The container is the only missing piece.

2. **`assertNoDevAuthInProduction` extracted as a pure module** rather than inlined in `main.ts`. Reason: `main.ts` runs `import 'reflect-metadata'` and pulls the entire NestJS DI tree at import time, which makes a "load main.ts in unit test" approach heavy and brittle. A pure module is unit-testable in milliseconds and the contract is cleaner.

3. **Defense-in-depth NODE_ENV gating** — even with the boot fence, both `trpc.context.ts` and `saml.strategy.ts` re-check `NODE_ENV !== 'production'`. If the fence is somehow disabled (e.g., a future PR removes it inadvertently), the runtime guards still hold.

4. **`docker-compose.dev.yml`/`docker-compose.yml` not modified** — those continue to set `AUTH_DEV_MODE=true` for the local dev loop. Only the production stack (`docker-compose.prod.yml`, already at `AUTH_DEV_MODE: "false"`) is the target of the cut-over.

5. **`.env.example` reorganised** — production envs first (REQUIRED), then a clearly-fenced "Local-only test/dev switches" block. The legacy `AUTH_DEV_MODE=true` line is preserved for the dev loop but reframed as a test/dev-only switch.

## Verification

- `pnpm --filter @customreport/api typecheck` exit 0
- `pnpm --filter @customreport/api test` 465/465 green (was 457)
- `pnpm --filter @customreport/web typecheck` exit 0
- `pnpm --filter @customreport/shared test` 226/226 unaffected
- One commit (abf2028) — atomic, no amends

## Follow-up tickets (deferred from this plan)

- **mock IdP container**: pull `quay.io/keycloak/keycloak:26`, mount realm fixture, add healthcheck. Trivial once registry access is available.
- **Playwright real-SAML global-setup**: rewrite `apps/web/e2e/integration/global-setup.ts` to perform a real SAML AuthnRequest against the mock. Deferred until the container is available.
- **PDF integration smoke against real SAML**: after the two above land, re-validate the cookie-injection seam from Phase 28-02 (A-3 mitigation).
