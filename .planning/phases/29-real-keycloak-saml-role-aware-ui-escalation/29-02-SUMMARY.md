# 29-02 SUMMARY — AUTH-02 JWT role claim from SAML attribute mapper

**Status:** COMPLETED
**Commit:** 01ee909
**Phase:** 29-real-keycloak-saml-role-aware-ui-escalation
**Plan:** 02

## What shipped

A typed, enforced JWT role claim end-to-end: Keycloak realm fixture defines a SAML attribute mapper named `saml-role-mapper` that emits attribute name `role`; the SAML strategy parses every non-dev profile through a Zod schema; the JWT carries `role: Role` and `ctx.session.role` is populated for every authenticated tRPC procedure.

## Final SamlProfileSchema shape

```typescript
import { z } from 'zod';
import { sessionRoleSchema, type Role } from '../schemas/auth';

export const SamlProfileSchema = z
  .object({
    nameID: z.string().min(1),
    email: z.email(),
    displayName: z.string().optional(),
    role: z
      .string()
      .transform((s) => s.toLowerCase())
      .pipe(sessionRoleSchema),
  })
  .strict();

export type SamlProfile = z.infer<typeof SamlProfileSchema>;
```

## Role ownership

`Role` was NOT duplicated. It remains owned by `packages/shared/src/schemas/auth.ts` (Phase 27 widening, where `sessionRoleSchema` is the source of truth — `['lead','head','admin','viewer']`). The new `packages/shared/src/auth/saml-profile.ts` imports and re-exports it for ergonomic access from the new auth submodule. One source of truth preserved.

## saml.strategy.ts dev vs non-dev branch

| Branch | Behaviour | Mitigation |
|--------|-----------|------------|
| `devMode=true`, role missing | Defaults to `'viewer'` | Phase 26 / 28 ergonomics preserved (CC-2 staged removal). Retired in Phase 29-04. |
| `devMode=true`, role present (any case) | Lowercased, validated against enum, fallback to `'viewer'` if unrecognised | Same staged-removal stance |
| `devMode=false`, role missing | `Error('SAML profile missing required role attribute')` | A-2 mitigation: fails closed |
| `devMode=false`, role present + recognised (case-insensitive) | Lowercased, validated, returned typed Role | T2 mitigation |
| `devMode=false`, role unrecognised | `Error('SAML profile missing required role attribute')` | A-2 mitigation |
| Both branches, profile null/missing | `Error('SAML profile is missing')` | Pre-existing guard |

The verify callback was extracted into a pure `verifySamlProfile(options, rawProfile)` that returns a discriminated union `{ ok: true, profile }` or `{ ok: false, error }`. This makes the path testable without instantiating the passport-saml Strategy (which requires an idp cert at construction time).

## Files modified

| File | LOC delta | Note |
|------|-----------|------|
| packages/shared/src/auth/saml-profile.ts (new) | +37 | SamlProfileSchema + Role re-export |
| packages/shared/src/auth/saml-profile.test.ts (new) | +85 | 8 unit tests covering A-2 + T2 |
| packages/shared/src/auth/index.ts (new) | +1 | barrel |
| packages/shared/src/index.ts | +1 | adds `export * from './auth'` |
| apps/api/src/modules/auth/saml.strategy.ts | +60/-5 | strict path via verifySamlProfile + dev fallback |
| apps/api/src/modules/auth/saml.strategy.test.ts (new) | +110 | 8 unit tests on dev + production branches |
| apps/api/src/infrastructure/trpc/__tests__/role-claim.contract.test.ts (new) | +110 | 5 contract tests on full SAML→JWT round-trip |
| infra/keycloak/realm-export.json (new) | +159 | Realm fixture with saml-role-mapper + 4 test users |

## Test counts

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| api unit | 444 / 35 files | 457 / 37 files | +13 / +2 |
| shared unit | 218 / 5 files | 226 / 6 files | +8 / +1 |
| web unit | 168 (1 pre-existing fail) | 168 (same fail) | 0 |
| typecheck (api + web) | green | green | — |

## Key design choices / deviations

1. **`SamlProfileSchema` lives at `packages/shared/src/auth/`** (new directory) and is exported through the package barrel. Required adding `export * from './auth'` to `packages/shared/src/index.ts`.

2. **Verify callback extracted into `verifySamlProfile`** — a pure function returning a discriminated union. Plan suggested inlining, but extraction makes the dev/prod branches unit-testable without `new SamlStrategy(...)` (which requires real options).

3. **Dev fallback retains lowercasing.** The plan said dev mode keeps the original permissive shape; I kept it permissive but also lowercased and enum-checked the role before returning, so dev behaviour is closer to production. If `devMode=true` and role is unrecognised, it still falls back to `'viewer'` per CC-2 — the only behaviour change is "viewer" is reached via lowercase normalisation rather than a raw cast.

4. **No JWT shape changes were needed** — `auth.controller.ts` already runs `userSessionSchema.parse(payload)` before signing and after verifying, and the schema's role enum is the same `sessionRoleSchema` the new SamlProfileSchema pipes into. The contract test proves the round trip.

5. **Realm fixture is config-only**, not loaded at app boot. Phase 29-04 will mount it into `quay.io/keycloak/keycloak:26` via `docker-compose.test.yml`.

## Verification

- `pnpm --filter @customreport/api typecheck` exit 0
- `pnpm --filter @customreport/web typecheck` exit 0
- `pnpm --filter @customreport/api test` 457/457 green
- `pnpm --filter @customreport/shared test` 226/226 green
- `node -e "JSON.parse(...realm-export.json)"` valid
- One commit (01ee909) — atomic, no amends
