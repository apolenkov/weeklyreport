# Upgrade @bull-board to v7 (api + express, lockstep)

## Why

`@customreport/api` pins `@bull-board/api` and `@bull-board/express` at
`^6.21.0` (resolved 6.21.3). Upstream has shipped a v7 major (7.1.5) that is a
rewrite of `@bull-board`: the adapter/registration API and the peer-dependency
alignment between `@bull-board/api` and `@bull-board/express` changed.

The two packages share a tightly-coupled contract — `@bull-board/express`'s
`ExpressAdapter` is consumed by `@bull-board/api`'s `createBullBoard`. A v7
`api` paired with a v6 `express` (or vice versa) produces a runtime adapter
mismatch. They MUST move together to the same major in a single change.

This is a **Wave-3 ISOLATED** upgrade: a single breaking dependency is given its
own change so it cannot sink a larger batch. The merge decision is the user's.

## What Changes

- Bump `@bull-board/api` `^6.21.0` -> `^7.1.5` in
  `apps/api/package.json`.
- Bump `@bull-board/express` `^6.21.0` -> `^7.1.5` in
  `apps/api/package.json` (lockstep — same major).
- Apply the v7 breaking-change migration to the only consumer,
  `apps/api/src/infrastructure/bullmq/bull-board.module.ts`: verify and update
  the `createBullBoard`, `BullMQAdapter`, and `ExpressAdapter` import paths and
  call shapes against the v7 API (subpath imports such as
  `@bull-board/api/bullMQAdapter` are the most likely to have moved).
- Refresh the lockfile via `pnpm install` (no other dependency changes).
- Run the full gate suite and confirm the queue board still mounts and is
  head-role gated.

## Impact

- **Package**: `@customreport/api` (`apps/api`) only. No other workspace
  declares `@bull-board/*`.
- **Files**: `apps/api/package.json`,
  `apps/api/src/infrastructure/bullmq/bull-board.module.ts`, root `pnpm-lock.yaml`.
- **Surface**: the Bull Board monitoring UI mounted at `/admin/queues`
  (observability only; not a product/data path). The head-role auth middleware
  in the same module is unrelated to the bump and MUST stay byte-identical.
- **Risk**: Medium. v7 is a rewrite, but the blast radius is one ~60-LOC
  infrastructure module with no domain logic and a single mount site. Isolation
  limits the failure mode to the queue board; no HOT-ZONE
  (product/group/report-period/query-semantics) code is touched.

## Non-goals

- No other dependency bumps. `bullmq` (5.77.x) and `@nestjs/bullmq` are out of
  scope; only the `@bull-board/*` pair moves.
- No change to how queues are constructed (the direct `new Queue(...)` workaround
  for the `@nestjs/bullmq` DiscoveryService bug stays as documented).
- No change to the `/admin/queues` route, base path, or the head-role gate.
