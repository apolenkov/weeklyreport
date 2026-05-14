# Coding Conventions

**Analysis Date:** 2026-04-24

## 2026-05-14 Refresh

Current closure conventions:

- Chat/docs for the user stay Russian where appropriate; code, paths, commands,
  config keys, UI strings, and static product UI copy stay English.
- Static UI strings in source remain English until an i18n phase exists.
- Deferred features require code-visible TODO markers, loud stubs, and metrics
  when the touched surface is an activation path.
- Planning edits must pass pnpm lint:md.
- Do not stage or revert pre-existing dirty regression evidence JSON unless a
  phase explicitly owns those files.
- Non-prod Docker/env database wiring must suffix both `POSTGRES_DB` and the
  database name inside `DATABASE_URL` with `_uat`, `_dev`, or `_test`
  whenever the host is not truly local; `prisma/_destructive-guard.ts` parses
  `DATABASE_URL` for wipe/reset safety.
- Database names must match the environment purpose; do not use a UAT suffix for
  ordinary dev wiring or a dev suffix for dedicated UAT/staging.
- For v8.1, do not add a runtime director role; director-facing UAT goes
  through the viewer read-only path.
- Phase 40 background/dark-theme work remains research-only unless explicitly
  reopened.

## Naming Patterns

**Files:**

- Use kebab-case for all file names: `admin.service.ts`, `trpc.error-mapper.ts`, `email-reminder.processor.ts`
- Suffix files by role: `.service.ts`, `.router.ts`, `.module.ts`, `.prisma-repository.ts`, `.controller.ts`, `.guard.ts`, `.strategy.ts`, `.middleware.ts`
- Test files co-located with source: `admin.service.test.ts` (unit), `admin.integration.test.ts`, `archive.contract.test.ts`
- React components: kebab-case files, PascalCase exports: `api-readiness-placeholder.tsx` exports `ApiReadinessPlaceholder`

**Functions:**

- camelCase: `createAppLogger()`, `mapDomainError()`, `validateSubmitInput()`
- Factory functions prefixed with `create`: `createRepository()`, `createTestPrisma()`, `createAppRouter()`, `createContextFactory()`
- Boolean helpers: `shouldRedirectToLogin()`, `noInvisibleOnly()`, `noNullBytes()`

**Variables:**

- camelCase for locals and parameters: `currentSection`, `headSession`, `logDir`
- UPPER_SNAKE_CASE for constants: `TEST_IDS`, `LEVEL_PRIORITY`, `API_URL`, `AUTH_DIR`
- UUID test fixtures use recognizable patterns: `'11111111-1111-4111-8111-111111111111'`

**Types:**

- PascalCase for types and interfaces: `AdminSnapshot`, `UserSession`, `AppLogger`
- Interface names describe the contract (no `I` prefix): `AdminRepository`, `ReportSectionsRepository`
- Zod schema names use camelCase + `Schema` suffix: `adminSnapshotSchema`, `draftSaveSchema`
- Inferred types exported as: `export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>`

**Enums:**

- Prisma enums in PascalCase: `Role`, `ReportStatus`, `TrafficLightStatus`
- Zod enum values in snake_case: `'in_progress'`, `'follow_up'`, `'at_risk'`

## TypeScript Strict Mode

**Base config** (`tsconfig.base.json`):

```json
{
  "strict": true,
  "noImplicitOverride": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true,
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler"
}
```

**API overrides** (`apps/api/tsconfig.json`):

- `experimentalDecorators: true` and `emitDecoratorMetadata: true` for NestJS decorators
- `outDir: "dist"` for build output

**Web overrides** (`apps/web/tsconfig.json`):

- `jsx: "preserve"` for Next.js
- `incremental: true`
- Adds `@customreport/api/*` path alias (API does not have this)

**Shared package** (`packages/shared/tsconfig.json`):

- `declaration: true` and `declarationMap: true` for package consumption

**Rules:**

- Never use `any` -- ESLint enforces `@typescript-eslint/no-explicit-any: 'error'`
- Prefix unused parameters with `_`: `argsIgnorePattern: '^_'`
- No floating promises: `@typescript-eslint/no-floating-promises: 'error'`
- Use `type` imports for type-only imports: enforced by `verbatimModuleSyntax`

## Code Style

**Formatting:**

- No Prettier configuration file detected. Code formatting is not enforced by automated tooling.
- The CLAUDE.md aspirational stack references Prettier 4.x, but no `.prettierrc` or `prettier.config.*` exists.
- Observed style: single quotes, trailing commas, 2-space indentation, ~100-char line width.

**Linting:**

- ESLint 10.x with flat config: `eslint.config.ts`
- Uses `typescript-eslint` strict preset: `tseslint.configs.strict`
- React-specific plugins: `eslint-plugin-react-hooks` (rules-of-hooks error, exhaustive-deps warn) and `eslint-plugin-react-compiler` (error)
- `@typescript-eslint/no-extraneous-class: 'off'` -- allows NestJS empty module/service classes
- Global ignores: `node_modules`, `dist`, `.next`, `coverage`, `.turbo`, `prisma/generated`, `e2e`

**Lint + typecheck command:**

```bash
pnpm run lint        # Runs turbo lint across all packages
# Per-app: tsc --noEmit + eslint .
```

## Import Organization

**Order (observed pattern):**

1. Node built-ins: `import { appendFileSync } from 'node:fs'`
2. External packages: `import { z } from 'zod'`, `import { Injectable } from '@nestjs/common'`
3. Monorepo packages: `import { adminSnapshotSchema } from '@customreport/shared'`
4. Relative imports: `import { PrismaService } from '../../infrastructure/prisma/prisma.service'`

**Path Aliases:**

- `@customreport/shared` -> `packages/shared/src/index.ts`
- `@customreport/shared/*` -> `packages/shared/src/*`
- `@customreport/ui` -> `packages/ui/src/index.ts`
- `@customreport/ui/*` -> `packages/ui/src/*`
- `@customreport/api/*` -> `apps/api/src/*` (web tsconfig only)

**API import style:**

- Use `.js` extension for relative imports in API source: `import { mapDomainError } from './trpc.error-mapper.js'`
- This is required by ESM module resolution with `"type": "module"` in `apps/api/package.json`
- Test files do NOT use `.js` extensions (vitest handles resolution)

**Type-only imports:**

- Use `import type { ... }` for types: `import type { AdminSnapshot } from '@customreport/shared'`
- Enforced by `verbatimModuleSyntax: true` in tsconfig

## Error Handling

**Domain Error Pattern:**
Each service module defines its own domain error class extending `Error`:

```typescript
// In {module}.service.ts
export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}
```

Existing domain errors:

- `ReportSectionDomainError` (`apps/api/src/modules/report-sections/report-sections.service.ts`) -- includes error `code` field
- `ReviewAccessError` (`apps/api/src/modules/review/review.service.ts`)
- `PublicationAccessError` (`apps/api/src/modules/publication/publication.service.ts`)
- `AdminAccessError` (`apps/api/src/modules/admin/admin.service.ts`)
- `PdfExportDomainError` (`apps/api/src/modules/pdf-export/pdf-export.service.ts`)
- `ReminderDomainError` (`apps/api/src/modules/reminders/reminders.service.ts`)
- `CarryOverDomainError` (`apps/api/src/modules/carry-over/carry-over.service.ts`)
- `ArchiveDomainError` (`apps/api/src/modules/archive/archive.service.ts`)

**Error Mapping (tRPC layer):**
All domain errors are mapped to tRPC errors in `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`:

```typescript
export function mapDomainError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof ReportSectionDomainError)
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  if (error instanceof ReviewAccessError || error instanceof AdminAccessError)
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: error,
    });
  // ... etc
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected error",
  });
}
```

**Rules:**

- Never expose internal error details to clients (the fallback is always `'Unexpected error'`)
- Always wrap tRPC procedure bodies in `try { ... } catch (error) { throw mapDomainError(error); }`
- Preserve `cause` reference for debugging
- Domain errors throw at the service layer; tRPC mapping happens at the router layer

## Zod Validation at Every Boundary

**Core pattern:** Parse all data through Zod schemas at every layer boundary.

- **Service layer:** Parse repository output before returning: `adminSnapshotSchema.parse(await this.repository.getSnapshot())`
- **Repository layer:** Parse DB results before returning: `appSettingsSchema.parse({ ... })`
- **Router layer (tRPC):** Input schemas on procedures: `.input(draftSaveSchema)`
- **Shared schemas:** Single source of truth in `packages/shared/src/schemas/`

**Safe text validation:**

```typescript
const safeText = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .min(opts.min ?? 1)
    .max(opts.max ?? 500)
    .refine(noNullBytes, { message: "Text must not contain null bytes" })
    .refine(noInvisibleOnly, {
      message: "Text must contain visible characters",
    });
```

Use `safeText()` for all user-facing text fields. It rejects null bytes (PostgreSQL incompatible) and zero-width-space-only strings.

## Repository Interface Pattern

**Every API module follows this structure:**

1. Define `XxxRepository` interface in the service file (`*.service.ts`)
2. Implement as `XxxPrismaRepository` in `*.prisma-repository.ts` with `@Injectable()` decorator
3. Wire via NestJS module (`*.module.ts`) using `useFactory`

```typescript
// admin.service.ts
export interface AdminRepository {
  getSnapshot(): Promise<AdminSnapshot>;
  saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot>;
  // ...
}

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}
}
```

```typescript
// admin.prisma-repository.ts
@Injectable()
export class AdminPrismaRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaService) {}
  // ...
}
```

```typescript
// admin.module.ts
@Module({
  providers: [
    AdminPrismaRepository,
    {
      provide: AdminService,
      useFactory: (repo: AdminPrismaRepository) => new AdminService(repo),
      inject: [AdminPrismaRepository],
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}
```

## Logging

**Framework:** Custom `AppLogger` in `apps/api/src/lib/logger.ts`

**Patterns:**

- Structured JSON logs to stdout (info/debug/warn) and stderr (error)
- Daily rotating log files when `logDir` is configured
- Configurable `minLevel`: debug | info | warn | error
- `child()` method for scoped context: `logger.child({ module: 'reminders' })`
- `createNullLogger()` for tests (no-op)

**Usage:**

```typescript
// In service constructors (optional logger):
constructor(
  private readonly repository: AdminRepository,
  logger?: AppLogger,
) {
  this.logger = logger ?? createNullLogger();
}

// Log with context:
this.logger.info('upserted user', { userId: parsedUser.id });
```

## Comments

**When to Comment:**

- JSDoc on public methods: `/** API-11: Get application settings singleton. */`
- Section dividers in test files using ASCII comment blocks:

  ```typescript
  // ---------------------------------------------------------------------------
  // P0/P1 Regression -- ADM scenarios
  // ---------------------------------------------------------------------------
  ```

- Reference regression scenario IDs in test names: `'getSnapshot -- regression (ADM-010)'`
- Reference design document IDs in schema sections: `// v4.0: Stage & Assignment schemas (D-63)`

**No TSDoc/JSDoc enforcement.** Not all functions have docs. Add JSDoc for public service methods and exported schemas.

## Module Design

**Exports:**

- Shared package uses barrel file: `packages/shared/src/index.ts` re-exports all schemas and types
- UI package uses barrel file: `packages/ui/src/index.ts` with named exports for every component
- API modules do NOT use barrel files -- import directly from specific files

**Module boundaries:**

- `packages/shared` -- Zod schemas, TypeScript types, shared validation functions. Zero runtime dependencies (only `zod`).
- `packages/ui` -- shadcn/ui components, composition components (DataTable, ConfirmDialog, CrudSheet, TrafficLightBadge). Depends on Radix UI primitives, Tailwind, clsx, tailwind-merge.
- `apps/api` -- NestJS + tRPC + Prisma. Domain logic in `src/modules/`, infrastructure in `src/infrastructure/`.
- `apps/web` -- Next.js 16. Pages in `src/app/`, components in `src/components/`, server logic in `src/server/`.

## React Component Patterns

**Props typing:**

```typescript
type ApiReadinessPlaceholderProps = {
  readonly pageTitle: string;
  readonly roleLabel: string;
  readonly currentPath: string;
};
```

Use `type` (not `interface`) for component props. Mark all props as `readonly`.

**Layout props:**

```typescript
type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;
```

**Component style:** Function declarations (not arrow functions) for page components and exported components:

```typescript
export function ApiReadinessPlaceholder({ ... }: Props) { ... }
export default function RootLayout({ children }: RootLayoutProps) { ... }
```

**CSS:** Tailwind utility classes with shadcn/ui design tokens. Use `cn()` utility from `@customreport/ui` for conditional class merging.

---

_Convention analysis: 2026-04-24_
