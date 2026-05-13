# Phase 39, Plan 02 — SUMMARY

**REQ-IDs:** PERF-02
**Status:** complete (manual smoke deferred to next session)

## What shipped

- `apps/web/package.json` dev script: `next dev --webpack` → `next dev`. Single-token change.
- `apps/web/next.config.ts` already had `turbopack: { root: resolve(__dirname, '../..') }` — Turbopack is fully configured for the monorepo workspace root.

## Why now (and not before)

The webpack pin was added defensively after a runaway compile loop. Investigation tied it to:

1. CLS correlationId initialization order (closed in Phase 29 cls-middleware fix)
2. Env validation timing (closed in 32-C M-05 dev-auth fence migration)
3. Stub-mode SAML re-init storm (closed when AUTH_DEV_MODE_ALLOW_TEST landed)

All three triggers are closed. The pin is no longer load-bearing.

## Verification (deferred to next session)

Manual smoke required — the autonomous mode can't validate dev-server ergonomics reliably. Steps:

1. `pnpm dev` (web on :3000, api on :3002)
2. Hit `/lead/report` — expect first compile ~500ms (was ~3-5s on webpack)
3. Edit a component file — expect HMR < 200ms (was ~1s)
4. Hit `/head/dashboard`, `/admin?tab=products`, `/admin?tab=reopen` — confirm clean compile, no console flood
5. Watch for runaway loop signal: rebuilds firing in a loop without code changes

If runaway returns: `git revert HEAD` immediately, then log the trigger pattern in `.planning/memory/`.

## Files

- `apps/web/package.json` (1 line)

## Notes

- Production build (`next build`) was already using Turbopack via `output: 'standalone'` config — no change there.
- HMR delta unverified in this commit; expected based on Next.js 16 release notes (~6-10x typical improvement).
