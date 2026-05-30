# dependency-currency

## ADDED Requirements

### Requirement: The @bull-board Package Pair MUST Be On a Single Major

`@customreport/api` MUST declare `@bull-board/api` and `@bull-board/express` at
the same major version, and that major MUST be v7 (`^7.1.5`). The two packages
form a coupled runtime contract — `@bull-board/api`'s `createBullBoard` consumes
`@bull-board/express`'s `ExpressAdapter` — so a mixed-major install is forbidden
because it produces a runtime adapter mismatch.

#### Scenario: Declared versions share the v7 major

- **WHEN** `apps/api/package.json` is inspected after the upgrade
- **THEN** both `@bull-board/api` and `@bull-board/express` are pinned to a v7
  range (`^7.1.5`)
- **AND** the resolved lockfile contains a single 7.x line for the pair with no
  residual v6 copy

#### Scenario: A mixed-major install is rejected

- **WHEN** one of the two `@bull-board/*` packages is on v7 and the other is on
  v6
- **THEN** that state is treated as a defect and the change is not considered
  complete until both are on the same v7 major

### Requirement: Bull Board Mount Survives the v7 Migration Behaviorally Unchanged

The queue monitoring UI MUST still mount at `/admin/queues` after migrating
`apps/api/src/infrastructure/bullmq/bull-board.module.ts` to the v7 API, remain
gated to the head role, and list the existing queues — with no change to the
route, base path, queue construction, or auth middleware.

#### Scenario: The board mounts and lists queues under v7

- **WHEN** the API starts with `@bull-board/*` on v7 and an authenticated head
  session requests `/admin/queues`
- **THEN** the v7 Bull Board UI renders and lists the `pdf-export` and
  `email-reminder` queues
- **AND** the `createBullBoard` / `BullMQAdapter` / `ExpressAdapter` wiring uses
  the v7 import paths and call shapes

#### Scenario: The head-role gate is unchanged by the bump

- **WHEN** `/admin/queues` is requested without a head session after the upgrade
- **THEN** the request is rejected with 401 (no session) or 403 (non-head role)
  exactly as before the bump
- **AND** the `requireHead` middleware and the direct `new Queue(...)`
  construction are byte-identical to their pre-upgrade form

### Requirement: The v7 Bump MUST Pass All Gates Before Merge

The upgrade MUST clear the full gate suite — `pnpm typecheck`, `pnpm lint`,
`pnpm test`, and `pnpm build` — and the change is isolated so that a gate
failure blocks only this change, never an unrelated bump in the same wave.

#### Scenario: Gates run green on the isolated change

- **WHEN** the four gates are run after the bump and migration
- **THEN** all four exit 0
- **AND** if any gate fails, only this `@bull-board` change is held back; other
  wave items proceed independently
