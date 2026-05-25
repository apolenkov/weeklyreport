# Audit scope-filter migration

## Problem

`weekly-report.prisma-repository.ts:71` reads draft sections and periods
without verifying current user's scope. Subsequent scope checks exist but don't
guard the query entry point. Security: a read-all audit pass is needed before
relying on downstream scoping.

## Solution

1. Map all tRPC endpoints that consume `PrismaRepository.findDraftSections()`,
   `findReports()`, and period queries.
2. Audit each call site: does the middleware chain already enforce scope via
   `@UseGuards(RoleBasedAccessGuard)` + `groupScope` context?
3. Add scope-guard assertions at the repository layer for defensive depth.
4. Migrate queries to use `groupScope.productIds` when filtering periods and
   sections.

## Non-goals

- Rewrite the scope middleware itself — focus is defensive hardening, not
  refactor.
- Audit auth module (`saml.ts`) — only report-domain data access.

## Status

Open — TODO(scope-filter-migration / scopeAccessed audit) in codebase.
