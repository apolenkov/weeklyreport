# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [ ] Read the v7.0.0 release notes / CHANGELOG for `@bull-board/api` and
      `@bull-board/express` (upstream `felixmosh/bull-board`), focusing on the
      base-path/prefix breaking change (#1153) and any `ExpressAdapter` or
      adapter-registration API changes.
- [ ] Confirm v7 peer-dependency and Node baseline are satisfied by the repo
      (`node >=24` engines, `.nvmrc`).
- [ ] Record current behavior baseline: start the API, log in as `head`, and
      confirm `/admin/queues` renders both `pdf-export` and `email-reminder`
      queues.

## Bump (lockstep)

- [ ] In `apps/api/package.json`, set `@bull-board/api` to `^7.1.5`.
- [ ] In `apps/api/package.json`, set `@bull-board/express` to `^7.1.5`
      (must match `@bull-board/api` major exactly).
- [ ] Run `pnpm install` to regenerate `pnpm-lock.yaml`; confirm both packages
      resolve to the same `7.x` and no peer-dep warnings remain.

## Breaking-change migration

- [ ] In `apps/api/src/infrastructure/bullmq/bull-board.module.ts`, verify the
      `ExpressAdapter` import and construction still compile under v7; apply
      any constructor/option changes.
- [ ] Verify `serverAdapter.setBasePath("/admin/queues")` still matches the
      mount path used in `expressApp.use("/admin/queues", ...)`; adjust to v7
      base-path/prefix semantics so the served UI and its assets resolve under
      `/admin/queues`.
- [ ] Verify the `createBullBoard({ queues: [...], serverAdapter })` call shape
      and the `BullMQAdapter` import path (`@bull-board/api/bullMQAdapter`)
      against v7; update if relocated or renamed.
- [ ] Verify `serverAdapter.getRouter()` is still the correct way to obtain the
      Express router and that it composes with the `requireHead` guard.

## Verification

- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0 with no new warnings.
- [ ] `pnpm test` exits 0 (full suite).
- [ ] Manual smoke: start the API, hit `/admin/queues` unauthenticated -> 401;
      as a non-`head` role -> 403; as `head` -> Bull-Board UI loads with both
      queues and static assets resolve under `/admin/queues`.
- [ ] `pnpm build` (apps/api) succeeds.

## Decision

- [ ] Surface the green gate result and route smoke to the user; the merge
      decision for this isolated upgrade is the user's.
