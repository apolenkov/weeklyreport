# Phase 20: Seed & Type Foundation - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Database contains mockup-aligned seed data and a tested mapper layer translates between API types and presentation types. This is pure infrastructure — no user-facing UI changes.

Key deliverables:

1. Rewrite prisma/seed.ts with 12 products, 6 leads (real names), 7 SDLC stages, stage assignments, 2 report periods with realistic data
2. DEV_SESSION UUIDs in trpc.context.ts must match seeded user/report IDs
3. Mapper module in packages/shared that translates Zod/Prisma enums to presentation model (green→on-track, etc.)
4. Unit tests for every mapping direction

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research findings to incorporate:

- Mock types use "on-track"/"at-risk"/"blocked"/"empty" while Zod/Prisma use "green"/"yellow"/"red"
- Mock ItemStatus has "planned" which has NO database enum — it is computed
- DEV_SESSION hardcodes userId UUID — seed must create user with that exact UUID
- activeReportSectionId is null in DEV_SESSION — context factory may need update to resolve from DB
- Admin mock uses different product names than lead/dashboard mocks — pick ONE canonical set from mockup

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- prisma/seed.ts — existing seed script (generic data, needs rewrite)
- apps/api/src/infrastructure/trpc/trpc.context.ts — DEV_SESSION with hardcoded UUIDs
- packages/shared/src/schemas/ — Zod schemas with all enum types
- apps/web/src/components/\*/mock-data.ts — 7+ mock-data files with presentation types

### Established Patterns

- Seed uses PrismaPg adapter, tsx for execution
- Zod schemas define canonical types in packages/shared
- Mock data files define presentation-layer types locally

### Integration Points

- Mapper will live in packages/shared (used by both frontend containers and backend)
- Seed must create data that matches both DEV_SESSION UUIDs and mockup screenshots
- After seed, tRPC queries like reports.getActive should return real data

</code_context>

<specifics>
## Specific Ideas

Product names from mockup: CRM Platform, Data Analytics Suite, Mobile Banking App, E-Commerce Platform, Cloud Infrastructure, AI/ML Pipeline, DevOps Toolkit, Security Gateway, Payment Processing, Partner Portal, HR Management System, Inventory Tracker

Lead names from mockup: Polenkov A., Ivanova E., Petrov D., Sidorova M., Kozlov V., Novikova A.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
