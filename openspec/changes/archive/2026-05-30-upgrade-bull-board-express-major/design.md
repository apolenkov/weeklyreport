# Design

## Context

`@bull-board/express` and `@bull-board/api` form a coupled pair. The `api`
package owns `createBullBoard` and the queue adapters; the `express` package
provides the `ExpressAdapter` (server adapter) that `createBullBoard` is handed
and whose `getRouter()` is mounted on the Express app. The server-adapter
contract is shared across the two packages at the major-version level, so a
6.x `express` adapter passed into a 7.x `createBullBoard` (or vice versa) is a
runtime mismatch, not just a type error.

The repo's wiring lives in
`apps/api/src/infrastructure/bullmq/bull-board.module.ts`:

- constructs `ExpressAdapter`, calls `setBasePath("/admin/queues")`,
- passes `BullMQAdapter`-wrapped `pdf-export` and `email-reminder` queues to
  `createBullBoard`,
- mounts `serverAdapter.getRouter()` behind a `requireHead` JWT middleware at
  `expressApp.use("/admin/queues", ...)`.

v7 is a major rewrite whose release notes flag a breaking change to
prefix/base-path handling (upstream #1153) — the exact surface this module
relies on. That makes base-path correctness the primary acceptance risk.

## Decision

Bump both `@bull-board/api` and `@bull-board/express` to `^7.1.5` together, in
one isolated change on its own branch. Keep the existing architecture: direct
`Queue` instantiation (to avoid the `@nestjs/bullmq` DiscoveryService bug noted
in the module), the `requireHead` guard, and the `/admin/queues` mount point.
Adapt only what v7 forces — adapter construction and base-path/prefix wiring.

Acceptance is the full gate plus a manual route smoke covering all three auth
outcomes (401 unauthenticated, 403 non-head, 200 head with assets resolving).
The route is not covered by an automated test today; a manual smoke is the
proportionate verification for an observability-only route, consistent with the
existing module having no unit test.

Isolation rationale: a single breaking dependency upgrade should not be able to
sink a batch of unrelated bumps. Merging this change is the user's call once the
gate is green.

## Alternatives considered

- **Bump only `@bull-board/express`.** Rejected: the shared server-adapter
  contract means the `api` package must move to the same major or the adapter
  mismatch surfaces at runtime.
- **Bundle into the broader dependency wave.** Rejected per the locked
  single-breaking-dep-isolation rule; one flaky major would block the batch.
- **Add an automated integration test for `/admin/queues`.** Out of scope for
  this upgrade; the route has no existing test harness, and standing one up is
  a separate concern. A manual smoke is the proportionate gate here.
- **Pin to an exact `7.1.5` instead of `^7.1.5`.** Rejected: the repo
  convention uses caret ranges; staying consistent keeps patch-level fixes
  flowing while the lockfile pins the resolved version.
