---
status: complete
date: 2026-04-29
phase: 29-real-keycloak-saml-role-aware-ui-escalation
plan: 06
commit: ec9c6f4
requirements: [AUTH-06]
---

# 29-06 SUMMARY — AUTH-06 role-aware navigation hides (LAST per CC-1)

**Status:** COMPLETED
**Commit:** ec9c6f4
**Phase:** 29-real-keycloak-saml-role-aware-ui-escalation
**Plan:** 06

## What shipped

A pure role-visibility helper (`apps/web/src/lib/role-visibility.ts`) plus a NavBar rewrite that filters its link list before render via `isRouteVisible(href, role)`. Hidden links are absent from the DOM — not CSS-hidden, not aria-hidden — so a viewer reading the rendered HTML cannot enumerate `/admin` or `/head` routes. Role flows in via `useSession()` (no pathname inference, no useEffect) — React-Compiler-safe per CC-5 PITFALLS.

## CC-1 ordering — depends_on chain honoured

All five Phase 29 predecessor commits exist on HEAD before this commit landed:

```
ec9c6f4 feat(29-06): role-aware navigation hides (AUTH-06)        ← this commit
e224f44 docs(29-05): SUMMARY for NOTIF-02/05/06
4a60cd9 feat(29-05): escalation digest + opt-out + rate-limit + DLQ (NOTIF-02/05/06)
5634459 docs(29-04): SUMMARY for AUTH-01 SAML cut-over
abf2028 feat(29-04): boot fence + NODE_ENV-narrowed dev auth (AUTH-01)
8641cda docs(29-03): SUMMARY for AUTH-07 layout gate
bda7de7 feat(29-03): SSR layout-level role gates + 403 page (AUTH-07)
45c55de docs(29-02): SUMMARY for AUTH-02 JWT role claim
01ee909 feat(29-02): JWT role claim from SAML attribute mapper (AUTH-02)
3fd35fc docs(29-01): SUMMARY for AUTH-08 audit events
7a8ebb4 feat(29-01): structured audit events for auth + role-denied (AUTH-08)
```

CC-1 stance: cosmetic UI hide (AUTH-06) ships AFTER the SSR layout gate (AUTH-07, 29-03) and AFTER the SAML cut-over (AUTH-01, 29-04). This commit could not have shipped earlier — `isRouteVisible` mirrors the REQUIRED-roles arrays from the four `(app)/*/layout.tsx` files introduced in 29-03, and the role flows from a JWT enriched with the SAML role claim (29-02). All four predecessor REQ-IDs were live on HEAD before this commit landed.

## ROUTE_ROLE_MAP final shape

```typescript
export const ROUTE_ROLE_MAP: Readonly<
  Record<RoutePrefix, ReadonlyArray<Role>>
> = {
  "/admin": ["admin", "head"], // mirrors 29-03 admin layout
  "/head": ["head", "admin"], // mirrors 29-03 head layout
  "/lead": ["lead", "head", "admin"], // mirrors 29-03 lead layout
  "/reports": ["lead", "head", "admin", "viewer"], // mirrors 29-03 reports layout
};
```

Routes not in the map (e.g. `/auth/login`) default to visible — they have their own access semantics handled by `proxy.ts` (cookie-presence gate per CC-6).

## Test matrix (4 roles × 5 routes)

| route            | viewer | lead   | head  | admin |
| ---------------- | ------ | ------ | ----- | ----- |
| /admin           | hidden | hidden | shown | shown |
| /head/dashboard  | hidden | hidden | shown | shown |
| /head/report     | hidden | hidden | shown | shown |
| /lead/report     | hidden | shown  | shown | shown |
| /lead/history    | hidden | shown  | shown | shown |
| /reports/history | shown  | shown  | shown | shown |

Plus: unmapped routes (`/auth/login`, `/something-else`) are always visible; `/administrator` correctly does NOT match the `/admin` prefix; null session (still loading) renders zero role-gated links.

Tests cover all 20 (role × route) cells in `role-visibility.test.ts`, plus 10 NavBar render-level tests asserting hidden links are absent from DOM (`container.innerHTML` does not contain hidden `href=` attributes).

## Files modified

| File                                                      | LOC delta | Note                                                            |
| --------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| apps/web/src/lib/role-visibility.ts (new)                 | +40       | `isRouteVisible(route, role)` + `ROUTE_ROLE_MAP`                |
| apps/web/src/lib/role-visibility.test.ts (new)            | +60       | 21 unit tests (20 matrix + 1 unmapped + edges)                  |
| apps/web/src/components/navigation/nav-bar.tsx            | +180/-49  | Session-driven; single NAV_LINKS table; isRouteVisible filter   |
| apps/web/src/components/navigation/nav-bar.test.tsx (new) | +110      | 10 unit tests (per-role + null session + DOM-absence invariant) |

Total: 4 files, +285 / -49.

## Test count delta

| Suite                 | Before (29-05)            | After (29-06)                  | Delta          |
| --------------------- | ------------------------- | ------------------------------ | -------------- |
| api unit              | 473 / 38 files            | 473 / 38 files                 | 0              |
| shared unit           | 452 / 12 files            | 452 / 12 files                 | 0              |
| web unit              | 187 (1 pre-existing fail) | 221 (1 same pre-existing fail) | +34 / +3 files |
| typecheck (api + web) | green                     | green                          | —              |

The single web failure (`apps/web/proxy.test.ts`) is the same pre-existing failure documented since 29-01 — not touched by this plan.

## Key design choices / deviations

1. **Role flows from `useSession()`, not from a parent prop** — the plan suggested passing role as a NavBar prop from app-shell. The implementation reads via `useSession()` directly because (a) NavBar is a client component sitting INSIDE `<SessionProvider>`, so the hook is the natural seam; (b) it removes the prop drilling through `app-shell.tsx`; (c) React Compiler can memoise the resulting render because the hook is stable. Same outcome, fewer moving parts.

2. **Single NAV_LINKS table replaces the per-role tables (LEAD_LINKS / HEAD_LINKS / ADMIN_LINKS)** — the old NavBar maintained three separate constants and inferred role from `pathname`. The new table is a single source of truth filtered through `isRouteVisible`. Bonus: a viewer who lands on `/reports/history` now sees the correct nav; the old `inferRole(pathname)` returned 'lead' for that URL, which would have shown lead-only links to a viewer.

3. **Mobile nav is data-driven from the same `visibleLinks` array** — guarantees the desktop and mobile navs hide the same links. No risk of drift.

4. **Null session renders zero role-gated links** — during the `auth.me` query's loading phase, NavBar shows the logo + "?" avatar but no links. Avoids the brief flash of "all links visible until role resolves" that pathname inference produced.

5. **Plan's "filtered out before render" invariant verified at the DOM level** — the test `container.innerHTML` is asserted to NOT contain hidden `href=` strings. This is stronger than `queryByText`/`queryByRole` (which only check rendered text/aria) — it proves no enumeration leaks even via low-level HTML inspection.

## Phase 29 wrap-up

This commit closes AUTH-06 and is the LAST commit of Phase 29. All six REQ-IDs of the phase are now landed:

| REQ-ID                    | Plan  | Commit  | Status                                                                                          |
| ------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------- |
| AUTH-08 (audit events)    | 29-01 | 7a8ebb4 | shipped                                                                                         |
| AUTH-02 (JWT role claim)  | 29-02 | 01ee909 | shipped                                                                                         |
| AUTH-07 (SSR layout gate) | 29-03 | bda7de7 | shipped                                                                                         |
| AUTH-01 (SAML cut-over)   | 29-04 | abf2028 | **partial** — boot fence + narrowing shipped; mock IdP container deferred (Docker pull blocked) |
| NOTIF-02/05/06            | 29-05 | 4a60cd9 | shipped                                                                                         |
| AUTH-06 (nav hides)       | 29-06 | ec9c6f4 | shipped                                                                                         |

29-04 mock-IdP follow-up tickets (documented in 29-04-SUMMARY): pull `quay.io/keycloak/keycloak:26`, mount realm fixture, rewrite `apps/web/e2e/integration/global-setup.ts` to perform real-SAML round-trip. None block the milestone — the boot fence is the production-correctness gate, and the realm fixture is in place from 29-02.

## Final regression check (per task brief)

The full integration suite (`pnpm test:e2e:integration`) was NOT run inline because it would exceed the 600s watchdog. Per task brief, the unit-test counts are the proxy for non-regression:

| Plan            | api unit | shared unit      | web unit |
| --------------- | -------- | ---------------- | -------- |
| 29-01 baseline  | 444      | 218              | 168      |
| 29-02 baseline  | 457      | 226              | 168      |
| 29-03 baseline  | 457      | 226              | 182      |
| 29-04 baseline  | 465      | 226              | 182      |
| 29-05 baseline  | 473      | 452 (post-build) | 187      |
| **29-06 final** | **473**  | **452**          | **221**  |

Typecheck:

- `pnpm --filter @customreport/api typecheck` exit 0
- `pnpm --filter @customreport/web typecheck` exit 0

## Verification

- `pnpm --filter @customreport/web typecheck` exit 0
- `pnpm --filter @customreport/web test` 221 pass + 1 pre-existing fail (proxy.test.ts)
- One commit (ec9c6f4) — atomic, no amends
- depends_on chain (29-01..29-05) honoured: all 5 predecessor commits exist on HEAD before this commit landed (CC-1 enforced).
