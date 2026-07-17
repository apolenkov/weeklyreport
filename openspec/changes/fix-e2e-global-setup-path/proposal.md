## Why

`e2e/integration/global-setup.ts:19` resolves the repo root as
`path.resolve(__dirname, "../../../..")` — four directories up from
`e2e/integration/`. That lands on `/home/user`, which has no
`package.json`/workspace. Commit `1bc4596f` ("move playwright suite to
repo-root e2e/") relocated the suite from `apps/web/e2e/integration/` to
`e2e/integration/`, shortening the real distance to the repo root from four
levels to two, but the path derivation (and its now-stale comment referencing
`apps/web/e2e/integration/global-setup.ts`) was never updated.

Every `execSync` call in `globalSetup` (`prisma migrate reset`, `prisma db
seed`) runs with `cwd: repoRoot`. With `repoRoot` pointing outside the
workspace, `pnpm exec prisma ...` throws because there is no `pnpm-workspace`
context to resolve from, failing `globalSetup` and the entire integration
suite before a single test runs.

## What Changes

- Replace the fixed `../../../..` (4-up) resolution in
  `e2e/integration/global-setup.ts` with a walk-up that finds the nearest
  ancestor directory containing `package.json` (or `.git`), instead of a
  hardcoded directory-depth literal.
- Throw a clear error if no such ancestor is found, rather than silently
  falling back to a guessed path.
- Delete the stale path comment that still describes the pre-move
  `apps/web/e2e/integration/global-setup.ts` location.
- Add a regression test/characterization pin so a future file move cannot
  silently reintroduce a hardcoded, drift-prone depth constant.

## Capabilities

### Modified Capabilities

- `uat-quality-gates` — the integration test gate's `globalSetup` must
  resolve the repo root robustly (nearest `package.json`/git root), not via a
  hardcoded directory-depth literal, so relocating the e2e suite cannot
  silently break `pnpm test:integration`.

## Impact

- `e2e/integration/global-setup.ts` — path derivation fix.
- New/updated test file colocated with `global-setup.ts` (or under
  `e2e/integration/`) pinning the root-resolution behavior.
- No API/web/shared runtime code touched; no schema or migration changes.

## Non-goals

- Not changing the `prisma migrate reset` / `prisma db seed` sequencing or
  the seed content itself.
- Not moving the e2e suite again or altering `playwright.integration.config.ts`.
- Not adding a general-purpose "find workspace root" utility for other
  call sites — scoped to this one file's failure.
