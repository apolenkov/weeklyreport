# Upgrade @bull-board/express (and @bull-board/api) 6.x -> 7.x

## Why

The Bull-Board queue-monitoring UI mounted at `/admin/queues`
(`apps/api/src/infrastructure/bullmq/bull-board.module.ts`) pins
`@bull-board/express` and `@bull-board/api` at `^6.21.0`. Upstream has shipped
`7.1.5`, a major rewrite. The two packages are a coupled pair: they share a
single major-version contract for the server adapter, so a runtime adapter
mismatch results if only one is bumped. The v7 line also reworks base-path /
prefix handling (upstream #1153), which is exactly the surface this repo uses
via `serverAdapter.setBasePath("/admin/queues")`.

This change is isolated on its own branch so that a single breaking dependency
cannot sink a larger dependency batch. The merge decision is the user's.

This is a PLANNING-ONLY change: it specifies the upgrade and its acceptance
criteria. No source, config, `package.json`, or lockfile is modified here, and
no install is run. Implementation happens later on the integration branch.

## What Changes

- Bump `@bull-board/api` `^6.21.0` -> `^7.1.5` in `apps/api/package.json`.
- Bump `@bull-board/express` `^6.21.0` -> `^7.1.5` in `apps/api/package.json`,
  in lockstep with `@bull-board/api` (same major).
- Migrate the Bull-Board wiring in
  `apps/api/src/infrastructure/bullmq/bull-board.module.ts` for any v7
  breaking changes: `ExpressAdapter` construction, `setBasePath` /
  prefix semantics, `createBullBoard({ queues, serverAdapter })` shape,
  `BullMQAdapter` import path, and `serverAdapter.getRouter()` usage.
- Verify the route still mounts behind the `requireHead` JWT guard at
  `/admin/queues` and serves the Bull-Board UI.
- Run the full gate (`pnpm typecheck && pnpm lint && pnpm test`) plus a manual
  smoke of the `/admin/queues` route.

## Impact

- Affected package: `apps/api` (`@customreport/api`).
- Affected files:
  - `apps/api/package.json` (two dependency lines)
  - `apps/api/src/infrastructure/bullmq/bull-board.module.ts` (adapter wiring)
  - `pnpm-lock.yaml` (lockfile, regenerated on install)
- Risk: Medium. The base-path/prefix rework in v7 can change the URL the UI
  router serves under; if mis-migrated the page 404s or loads with broken
  asset paths while the API otherwise stays green. Mitigated by a manual
  route smoke and by keeping the two packages on the same major. Blast radius
  is contained to the observability route; no domain or HOT-ZONE code is
  touched.
