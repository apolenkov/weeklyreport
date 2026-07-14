## ADDED Requirements

### Requirement: Every Redis-backed service instance MUST be DI-managed, not constructed with `new`

Any code path that needs a `SessionRevocationService` (or another Redis-backed, DI-registered service) MUST resolve it via `app.get(...)` from the Nest DI container, and MUST NOT construct a fresh instance with `new`, because a `new` instance owns its own unmanaged ioredis client that is never closed by application shutdown hooks.

#### Scenario: The PDF download handler reuses the DI-managed singleton

- **GIVEN** the PDF download route handler needs `SessionRevocationService`
- **WHEN** the handler is wired in `main.ts`
- **THEN** it resolves the instance via `app.get(SessionRevocationService)`
- **AND** no `new SessionRevocationService(...)` call exists in `main.ts`

#### Scenario: The tRPC context factory reuses the DI-managed singleton

- **GIVEN** the tRPC context factory needs `SessionRevocationService`
- **WHEN** `createContextFactory` builds a request context
- **THEN** it resolves the instance via `app.get(SessionRevocationService)`
- **AND** no `new SessionRevocationService(...)` call exists in `trpc.context.ts`
