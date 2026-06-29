## ADDED Requirements

### Requirement: No parallel never-wired authorization implementation exists

The repository MUST NOT keep a second, never-wired authorization implementation
that production never exercises. The `AuthModule` + passport-JWT
`jwt.strategy.ts`, and the module-level `admin.router.ts` /
`review.router.ts` (imported only by tests, using `assertHeadAccess`), MUST be
removed once proven unused; the inline `adminProcedure` / `headProcedure`-gated
tRPC routers remain the single source of truth. These stale routers MUST NOT be
wired in as the production path, because their authorization semantics diverge
from the live ones: `admin.router.ts` gates with `createRoleGuard("head")` /
`assertHeadAccess`, whereas the live `adminProcedure` is admin-only, so wiring
the stale router in would silently re-open admin endpoints to heads. "Proven
unused" means grep over all references plus imports and build config, per the
repo's surgical-changes rule.

#### Scenario: a dead auth router is removed with evidence

- **GIVEN** `admin.router.ts` / `review.router.ts` and the passport-JWT plumbing
  are imported only by tests and not by any production wiring
- **WHEN** the cleanup runs
- **THEN** grep confirms no production reference, and the dead files are deleted
  (not wired in, since their head-gated semantics diverge from the live
  admin-only `adminProcedure`) and their tests point at the real procedure path
- **AND** production authorization continues to run through the inline
  `adminProcedure` / `headProcedure` routers only

### Requirement: Unimported components and dead redirect targets are removed

Components, modules, and redirect query parameters proven unused MUST be removed
so the codebase does not imply behavior it does not have. This covers the
unimported dashboard/navigation components, the dead Zod session parser vs the
triplicated cookie name, the dead tRPC `target` URL object, the undeclared
`reportId` emitted by the dashboard mapper, the `/head/slides` and
`/reports/history` redirects carrying a `mode`/`tab` query the merged `/reports`
page ignores, and the dead null branch in activity `lastEdit`.

#### Scenario: an unimported component is pruned

- **GIVEN** a component such as `ToggleAllButton`, `ReportArchiveSection`, or
  `AppShell` with no importing site
- **WHEN** the cleanup runs and grep confirms no reference
- **THEN** the component is deleted (or wired) and the build still passes

#### Scenario: a redirect drops a query the target ignores

- **GIVEN** `/head/slides` and `/reports/history` redirect to `/reports` with a
  `mode`/`tab` query the merged `/reports` page does not read
- **WHEN** the cleanup runs
- **THEN** the redirects target bare `/reports` and the stale comments are fixed

#### Scenario: the SSR cookie name is sourced once

- **GIVEN** `apps/web/src/server/auth/session.ts` is the only Zod session parser
  yet is dead while the SSR helpers triplicate the cookie name
- **WHEN** the cleanup runs
- **THEN** the SSR helpers source the cookie name from one place (adopting the
  session parser or a shared constant) with no triplicated literal
