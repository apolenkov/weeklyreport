## MODIFIED Requirements

### Requirement: Import boundaries enforce the monorepo dependency map

The standard MUST declare these import boundaries (verified clean in code at declaration time): `packages/*` MUST NOT import from `apps/*`; `packages/shared` and `packages/ui` MUST NOT import each other; `apps/api` MUST NOT import `packages/ui` or `apps/web`; `apps/web` MUST NOT import `apps/api` **except via `import type`** (the AppRouter tRPC contract at `apps/web/src/lib/trpc.ts`). The type-only carve-out MUST be rule-enforced (e.g. `@typescript-eslint/no-restricted-imports` with `allowTypeImports: true`), not a per-site disable. In addition, API infrastructure and bootstrap roots MUST consume contracts owned by `apps/api/src/modules/*` through each module's curated `index.ts` public API; direct imports of module-internal service, port, or error files MUST be rejected except for a documented checked exception.

#### Scenario: a value import across the web→api boundary is rejected

- **WHEN** Phase 3 enforces import boundaries
- **THEN** `import { something } from "@customreport/api/..."` in `apps/web` is reported
- **AND** `import type { AppRouter } from "@customreport/api/..."` is allowed
- **AND** any `import` from `apps/*` inside `packages/*` is reported

#### Scenario: API infrastructure bypasses a module public barrel

- **WHEN** `apps/api/src/infrastructure/trpc/trpc.router.ts`, a child router, the error mapper, or another infrastructure/bootstrap consumer imports `apps/api/src/modules/<name>/<internal-file>`
- **THEN** the ratchet reports the import
- **AND** importing the supported symbol from `apps/api/src/modules/<name>/index` is allowed
