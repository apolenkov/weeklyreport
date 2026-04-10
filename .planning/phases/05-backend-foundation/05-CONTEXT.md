# Phase 5: Backend Foundation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Domain services persist data in PostgreSQL through Prisma repositories; NestJS serves tRPC endpoints backed by real database; existing tests continue passing.

Requirements: DB-01, DB-02, DB-03, DB-04, API-01, API-02, API-03, API-04, API-05, API-06, API-07, REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06, REPO-07, REPO-08, REPO-09, QA-01, QA-04

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key architectural decisions from research:
- tRPC runs as Express middleware on NestJS (official `@trpc/server/adapters/express`), NOT through NestJS controller layer
- Auth as tRPC middleware (not NestJS guards) — guards are bypassed on tRPC routes (pitfall #3)
- Dev bypass mode (`AUTH_DEV_MODE=true`) provides hardcoded session for Phase 5 testing
- PrismaModule as global singleton with explicit `connection_limit`
- Prisma `directUrl` for migrations (never through PgBouncer)
- All repositories parse output through Zod schemas before returning

### Reference Implementation
reference-app (ghe.example.org/acme/platform/reference-app) uses OIDC+JWKS for Keycloak auth. For Phase 5, use dev bypass only. OIDC wiring deferred to Phase 6.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 8 domain services with repository interfaces (constructor injection)
- Zod schemas in `packages/shared` for all domain types
- tRPC router contract in `packages/shared/src/trpc/router.ts`
- Prisma schema at `prisma/schema.prisma` (9 models defined, 5 missing)
- Seed script stub at `prisma/seed.ts`
- Logger at `apps/api/src/lib/logger.ts` (structured JSON, file rotation)

### Established Patterns
- Repository interface pattern: `interface XRepository { ... }` in service files
- Services accept `(repository: XRepository, logger?: AppLogger)` via constructor
- NullLogger default for optional logging
- Zod parse on all inputs and outputs

### Integration Points
- `apps/api/src/main.ts` — currently empty bootstrap, needs full NestJS setup
- `packages/shared/src/trpc/router.ts` — defines 4 procedures, needs expansion to 16+
- Each service module needs NestJS module + Prisma repository implementation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow research recommendations from `.planning/research/SUMMARY.md`.

</specifics>

<deferred>
## Deferred Ideas

- OIDC/SAML auth wiring → Phase 6
- Frontend tRPC client → Phase 6
- BullMQ job processing → Phase 7
- Docker Compose → Phase 7

</deferred>
