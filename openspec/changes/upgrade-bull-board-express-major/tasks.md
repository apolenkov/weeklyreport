# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [x] Read the v7.0.0 release notes / CHANGELOG for `@bull-board/api` and
      `@bull-board/express` (upstream `felixmosh/bull-board`), focusing on the
      base-path/prefix breaking change (#1153) and any `ExpressAdapter` or
      adapter-registration API changes. Verified directly against the installed
      v7.1.5 type declarations: `ExpressAdapter` is still exported from
      `@bull-board/express`, the `./bullMQAdapter` subpath export persists in
      `@bull-board/api`, and `createBullBoard`/`setBasePath`/`getRouter` keep
      their shapes — the existing wiring is API-compatible with no migration
      forced.
- [x] Confirm v7 peer-dependency and Node baseline are satisfied by the repo
      (`node >=24` engines, `.nvmrc`). `.nvmrc` pins node 25; v7 declares no
      restricting node engine; the `@bull-board/ui@7.1.5` peer resolves cleanly
      with no peer-dep warnings.
- [ ] Record current behavior baseline: start the API, log in as `head`, and
      confirm `/admin/queues` renders both `pdf-export` and `email-reminder`
      queues. NOT PERFORMED in this environment (no running API/Redis/auth);
      manual smoke is the proportionate check per design.md.

## Bump (lockstep)

- [x] In `apps/api/package.json`, set `@bull-board/api` to `^7.1.5`.
- [x] In `apps/api/package.json`, set `@bull-board/express` to `^7.1.5`
      (must match `@bull-board/api` major exactly).
- [x] Run `pnpm install` to regenerate `pnpm-lock.yaml`; confirm both packages
      resolve to the same `7.x` and no peer-dep warnings remain. Lockfile and
      `node_modules` both resolve `@bull-board/api@7.1.5` and
      `@bull-board/express@7.1.5`.

## Breaking-change migration

- [x] In `apps/api/src/infrastructure/bullmq/bull-board.module.ts`, verify the
      `ExpressAdapter` import and construction still compile under v7; apply
      any constructor/option changes. No constructor change needed; compiles
      under v7.1.5 (fresh `tsc --noEmit` on `apps/api`: 0 errors).
- [x] Verify `serverAdapter.setBasePath("/admin/queues")` still matches the
      mount path used in `expressApp.use("/admin/queues", ...)`; adjust to v7
      base-path/prefix semantics so the served UI and its assets resolve under
      `/admin/queues`. `setBasePath` retained in v7 type surface; base path and
      mount path remain aligned at `/admin/queues`.
- [x] Verify the `createBullBoard({ queues: [...], serverAdapter })` call shape
      and the `BullMQAdapter` import path (`@bull-board/api/bullMQAdapter`)
      against v7; update if relocated or renamed. Both unchanged in v7.1.5; the
      `./bullMQAdapter` subpath export still resolves.
- [x] Verify `serverAdapter.getRouter()` is still the correct way to obtain the
      Express router and that it composes with the `requireHead` guard.
      `getRouter()` unchanged; composes with `requireHead` as before.

## Verification

- [x] `pnpm typecheck` exits 0 (also confirmed with a fresh, uncached
      `tsc --noEmit` on `apps/api`).
- [x] `pnpm lint` exits 0 with no new warnings.
- [x] `pnpm test` exits 0 (full suite).
- [ ] Manual smoke: start the API, hit `/admin/queues` unauthenticated -> 401;
      as a non-`head` role -> 403; as `head` -> Bull-Board UI loads with both
      queues and static assets resolve under `/admin/queues`. NOT PERFORMED in
      this environment (no running API/Redis/auth); deferred to the user per
      design.md's proportionate manual-smoke approach.
- [x] `pnpm build` (apps/api) succeeds.

## Decision

- [x] Surface the green gate result and route smoke to the user; the merge
      decision for this isolated upgrade is the user's. Gate green
      (typecheck/lint/test/build); manual route smoke left to the user.
