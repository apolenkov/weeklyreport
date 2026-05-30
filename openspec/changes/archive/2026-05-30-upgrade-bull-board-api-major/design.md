# Design: lockstep @bull-board v7 upgrade

## Context

`@customreport/api` mounts a Bull Board monitoring UI at `/admin/queues` from a
single module, `apps/api/src/infrastructure/bullmq/bull-board.module.ts`. That
module wires three pieces from two packages:

- `createBullBoard` and `BullMQAdapter` from `@bull-board/api` (the latter via
  the `@bull-board/api/bullMQAdapter` subpath export).
- `ExpressAdapter` from `@bull-board/express`, whose router is mounted on the
  Nest/Express instance behind a head-role auth middleware.

The two packages are at `^6.21.0`. Upstream v7 (7.1.5) is a rewrite that changed
the adapter/registration API and the peer-dependency alignment between the `api`
core and the `express` server adapter. The `api` core consumes the `express`
adapter at runtime, so a mixed-major install (v7 core + v6 adapter) is a runtime
mismatch, not just a type mismatch.

This change is one item in a wave of dependency upgrades. The wave policy is to
**isolate** each genuinely-breaking major into its own change so a single failed
bump cannot block unrelated green bumps, and so the merge call is per-item.

## Decision

Bump `@bull-board/api` and `@bull-board/express` **together** to `^7.1.5` in
`apps/api/package.json`, migrate the single consumer module to the v7 API, and
validate through the full gate suite plus a manual mount smoke-check. Keep
everything else in the module (queue construction workaround, head-role gate,
route/base-path) behaviorally unchanged.

ADR-style record:

- **Status**: Proposed (planning only; implementation deferred to the upgrade
  integration branch).
- **Context**: v6 -> v7 is a coupled major across two packages used by exactly
  one infrastructure module; mixed majors break at runtime.
- **Decision**: Move both packages to the same v7 line in one isolated change;
  migrate only `bull-board.module.ts`; gate and smoke-test the mount.
- **Consequences**: The queue board is the only surface that can regress. If v7
  proves problematic, this single change is dropped without affecting the rest
  of the upgrade wave. No HOT-ZONE or product/data code is touched.

## Alternatives considered

- **Bump only `@bull-board/api`, leave `@bull-board/express` on v6.** Rejected:
  the v7 core and v6 adapter are not peer-compatible; this yields a runtime
  adapter mismatch — the exact failure this change exists to prevent.
- **Fold the `@bull-board/*` pair into a larger "Wave-3 majors" batch change.**
  Rejected per the isolation policy: one breaking dependency must not be able to
  sink the batch, and the user wants a per-item merge decision.
- **Pin to an exact `7.1.5` instead of `^7.1.5`.** Rejected: the repo's
  convention is caret ranges; staying within the v7 major is sufficient to avoid
  the cross-major mismatch, and the lockfile pins the resolved version.
- **Replace Bull Board with a different queue dashboard.** Out of scope; this is
  a currency bump, not a tooling re-selection.
