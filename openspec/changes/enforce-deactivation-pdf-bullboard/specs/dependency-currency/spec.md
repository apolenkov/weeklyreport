## MODIFIED Requirements

### Requirement: Bull Board Mount Survives the v8 Migration Behaviorally Unchanged

The queue monitoring UI MUST still mount at `/admin/queues` after migrating
`apps/api/src/infrastructure/bullmq/bull-board.module.ts` to the `@bull-board`
v8 API, remain gated to the head role, and list the existing queues — with no
change to the route, base path, or queue construction. The `requireHead` guard's
auth middleware is no longer required to be byte-identical to its pre-upgrade
form: this security-hardening change (`enforce-deactivation-pdf-bullboard`)
deliberately makes `requireHead` async and adds the shared
deactivation-enforcement check after the head-role gate so a deactivated or
revoked head is denied. The route, base path, `createBullBoard` /
`BullMQAdapter` / `ExpressAdapter` wiring, and the direct `new Queue(...)`
construction remain unchanged.

#### Scenario: The board mounts and lists queues under v8

- **WHEN** the API starts with `@bull-board/*` on v8 and an authenticated, active
  head session requests `/admin/queues`
- **THEN** the v8 Bull Board UI renders and lists the `pdf-export` and
  `email-reminder` queues
- **AND** the `createBullBoard` / `BullMQAdapter` / `ExpressAdapter` wiring uses
  the v8 import paths and call shapes

#### Scenario: The head-role gate still rejects non-head and unauthenticated requests

- **WHEN** `/admin/queues` is requested without a head session after the upgrade
- **THEN** the request is rejected with 401 (no session) or 403 (non-head role)
  exactly as before the bump
- **AND** the direct `new Queue(...)` construction and the route/base-path wiring
  are byte-identical to their pre-upgrade form

#### Scenario: The hardened guard additionally rejects a deactivated head

- **GIVEN** a valid session JWT for a head whose `User.isActive` is now `false`
- **WHEN** the request reaches the now-async `requireHead` guard on
  `/admin/queues`
- **THEN** the guard responds 401 and the queue dashboard is never reached
- **AND** this is the deliberate, spec-sanctioned departure from the pre-upgrade
  byte-identical `requireHead` middleware
