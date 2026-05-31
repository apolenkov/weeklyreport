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

## Grill findings — 2026-05-30

Adversarial review of the explorer's `archive` recommendation. Surviving
findings:

- **BLOCKER — this is a duplicate, not an archivable change.** The actual
  upgrade landed in commit `12d90447`, whose message states "Implements
  openspec change **upgrade-bull-board-api-major**." `upgrade-bull-board-api-major`
  is marked `✓ Complete` in `openspec list`; this `express-major` change is a
  redundant twin describing identical scope (bump both `@bull-board/*` to
  `^7.1.5` lockstep + migrate `bull-board.module.ts`). The honest disposition
  for a duplicate whose work shipped under another change is **cancel**, not
  archive.
- **Spec-delta collision confirms duplication.** Both changes add the _same_
  `ADDED Requirements` headers ("Bull-Board Packages MUST Move In Lockstep…",
  route-mounted-and-guarded, full-gate) to the _same_ capability
  `dependency-currency`. The durable `openspec/specs/dependency-currency/spec.md`
  does **not** yet contain these requirements, so exactly one change should
  seed them on archive. api-major owns the implementation commit and is
  Complete, so it is the survivor; archiving express-major in addition would
  double-add identical requirement headers.
- **sharedFiles understated.** Explorer listed only `pnpm-lock.yaml`. Reality:
  `apps/api/package.json` (dependency lines 16-17) **and** the
  `dependency-currency` spec delta are also shared with
  `upgrade-bull-board-api-major`. These two changes cannot run as parallel git
  worktrees — hard collision on all three.
- **dependsOn edge mischaracterized.** The relation to
  `upgrade-bull-board-api-major` is not build-order; it is _duplicate-of /
  superseded-by_. No "implement after api-major" sequencing applies.
- **currentState `done-in-reality` is honest for the code.** Both packages are
  at `^7.1.5` (apps/api/package.json:16-17), the lockfile resolves a single
  `7.1.5` line with no v6 residue, and `bull-board.module.ts` is byte-identical
  and compiles under v7 (v7 preserved `createBullBoard`/`BullMQAdapter`
  subpath/`ExpressAdapter`/`setBasePath`/`getRouter`). The dishonest part was
  the `archive` recommendation, not the state.

**Revised recommendation: cancel.** The work is shipped under
`upgrade-bull-board-api-major`; archive `upgrade-bull-board-api-major` (its
delta seeds the `dependency-currency` requirements) and cancel/remove this
`express-major` twin to avoid a double-add of identical requirements. The two
unchecked manual-smoke tasks in this change's tasks.md are moot once the change
is cancelled.
