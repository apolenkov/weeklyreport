# Testing Patterns

**Analysis Date:** 2026-04-24

## 2026-05-14 Refresh

Current test inventory:

- Web unit/component tests: 49 files under apps/web/src.
- API unit/integration tests: 99 files under apps/api/src.
- Web E2E/Playwright specs: 56 files under apps/web/e2e.
- Shared package tests: 9 files under packages/shared/src.

Current closure commands:

- pnpm lint:md
- pnpm turbo typecheck
- pnpm turbo test
- pnpm --filter @customreport/web exec playwright test
- pnpm --filter @customreport/web exec playwright test --config=e2e/regression/playwright.regression.config.ts

Regression note: standalone regression config targets an already-running dev
stack and is the canonical runner for v8.1 browser regression closure.

## Test Framework

**Runner:**

- Vitest 4.x (unit, contract, integration tests)
- Playwright 1.55+ (E2E browser tests)

**Config files:**

- `apps/web/vitest.config.ts` -- jsdom environment, react plugin, path aliases
- `apps/web/playwright.config.ts` -- Chromium project, auth setup, webServer config
- `playwright.config.ts` (root) -- re-exports from `apps/web/playwright.config.ts`
- API has no vitest.config.ts -- uses root `vitest` from monorepo devDependencies with defaults

**Assertion Library:**

- Vitest built-in `expect` (no globals -- explicit imports required)
- `@testing-library/jest-dom` matchers for web component tests
- Playwright built-in `expect` for E2E

**Run Commands:**

```bash
pnpm run test                    # Run all unit tests via turbo (excludes integration)
pnpm --filter @customreport/api run test          # API unit tests only
pnpm --filter @customreport/api run test:integration  # API integration tests (needs DB)
pnpm --filter @customreport/web run test          # Web unit tests only
pnpm run test:e2e                # Playwright E2E tests
pnpm run test:e2e:ui             # Playwright E2E with interactive UI
```

**Important:** The API `test` script excludes integration tests: `vitest run --exclude '**/*.integration.test.ts'`. Integration tests require a running PostgreSQL database and are run separately with `test:integration`.

## Test File Organization

**Location:** Co-located with source files. Tests live in the same directory as the code they test.

**Naming convention (three tiers):**

| Suffix                     | Type        | Dependencies                 | Location Pattern                                                              |
| -------------------------- | ----------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `*.service.test.ts`        | Unit        | In-memory fakes              | `apps/api/src/modules/{module}/{module}.service.test.ts`                      |
| `*.contract.test.ts`       | Contract    | Zod schemas, in-memory fakes | `apps/api/src/modules/{module}/{module}.contract.test.ts`                     |
| `*.integration.test.ts`    | Integration | Real PostgreSQL via Prisma   | `apps/api/src/modules/{module}/{module}.integration.test.ts`                  |
| `*.test.ts`                | Unit        | Vitest, vi.spyOn for I/O     | `apps/api/src/lib/logger.test.ts`, `apps/api/src/infrastructure/**/*.test.ts` |
| `*.test.ts` / `*.test.tsx` | Component   | jsdom, MSW, testing-library  | `apps/web/src/**/*.test.ts`                                                   |
| `*.spec.ts`                | E2E         | Playwright, browser          | `apps/web/e2e/**/*.spec.ts`                                                   |

**Shared schema tests** in a `__tests__/` directory:

- `packages/shared/src/schemas/__tests__/report.test.ts`
- `packages/shared/src/schemas/__tests__/auth.test.ts`
- `packages/shared/src/schemas/__tests__/auth.contract.test.ts`

**Directory structure:**

```
apps/api/src/
  modules/admin/
    admin.service.ts
    admin.service.test.ts          # Unit: in-memory repo fake
    admin-settings.integration.test.ts  # Integration: real DB
    admin.integration.test.ts      # Integration: real DB
    stage-assignment.integration.test.ts
  modules/archive/
    archive.service.test.ts        # Unit
    archive.contract.test.ts       # Contract: Zod validation
    archive.integration.test.ts    # Integration
  modules/auth/
    auth.controller.test.ts        # Unit
    roles.guard.test.ts            # Unit
    auth.e2e.spec.ts               # E2E
  infrastructure/bullmq/
    email-reminder.processor.test.ts  # Unit
    pdf-export.processor.test.ts   # Unit
  infrastructure/trpc/
    trpc.error-mapper.test.ts      # Unit
    trpc.middleware.test.ts        # Unit
  lib/
    logger.test.ts                 # Unit with vi.spyOn

apps/web/
  src/server/auth/session.test.ts  # Unit
  src/test/
    fixtures.ts                    # Test data factories
    msw-handlers.ts                # MSW mock server handlers
  vitest.setup.ts                  # Global setup (MSW, cleanup)
  e2e/
    fixtures.ts                    # Playwright role fixtures
    lead-journey.spec.ts           # E2E
    head-dashboard.spec.ts         # E2E
    weekly-report.spec.ts          # E2E
    ...

packages/shared/src/
  schemas/__tests__/
    report.test.ts                 # Schema boundary tests
    auth.test.ts                   # Auth schema tests
    auth.contract.test.ts          # Auth contract tests
  trpc/
    router.test.ts                 # Shared tRPC contract tests
```

## Test Structure

**Vitest globals are disabled.** Always import test utilities explicitly:

```typescript
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
```

**Suite Organization:**

```typescript
import { describe, expect, it } from 'vitest';
import type { AdminSnapshot, UserSession } from '@customreport/shared';
import { AdminService, type AdminRepository } from './admin.service';

// Fixture data at top of file
const headSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

// In-memory repository factory
function createRepository(snapshot: AdminSnapshot): AdminRepository {
  let currentSnapshot = structuredClone(snapshot);
  return {
    async getSnapshot() { return structuredClone(currentSnapshot); },
    async saveSnapshot(next) { currentSnapshot = structuredClone(next); return structuredClone(currentSnapshot); },
    // ... all interface methods
  };
}

describe('AdminService', () => {
  it('adds and removes users', async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const result = await service.upsertUser({ ... });
    expect(result.users).toHaveLength(2);
  });

  // Regression group with scenario IDs
  describe('getSnapshot -- regression (ADM-010)', () => {
    it('returns snapshot with all entity types', async () => { ... });
    it('returns empty snapshot when no entities exist', async () => { ... });
  });
});
```

**Patterns:**

- **Setup:** Fixtures defined as module-level constants or factory functions. No `beforeEach` for unit tests (each test creates its own service instance).
- **Teardown:** Integration tests use `beforeEach(cleanDatabase)` and `afterAll(disconnectTestPrisma)`.
- **Assertions:** Prefer `expect(x).toBe(y)` for primitives, `expect(x).toEqual(y)` for objects, `expect(x).toMatchObject(y)` for partial matches.
- **Async:** All service tests are `async` since repository methods return Promises.

## Mocking

### API Tests: In-Memory Repository Fakes

**The primary mocking strategy for API unit tests.** No `vi.mock()` or `vi.fn()` for services.

```typescript
// Pattern: define createRepository() factory that implements the full interface
function createRepository(
  section: ReportSectionReadModel,
): ReportSectionsRepository {
  let currentSection = structuredClone(section);

  return {
    async getSectionById(reportSectionId) {
      if (reportSectionId !== currentSection.reportSectionId) return null;
      return structuredClone(currentSection);
    },
    async getReportStatus() {
      return "draft";
    },
    async saveSection(nextSection) {
      currentSection = structuredClone(nextSection);
      return structuredClone(currentSection);
    },
  };
}
```

**Key rules:**

- Use `structuredClone()` for all return values to prevent test mutation leaking
- Implement the full repository interface (not partial mocks)
- Use `new Map()` for in-memory collection storage when needed
- Create fresh repository per test via the factory function

### API Tests: vi.spyOn for I/O

Used only for I/O operations like stdout/stderr:

```typescript
const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
const logger = createAppLogger({ minLevel: "info" });
logger.info("hello");
const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
expect(parsed).toMatchObject({ level: "info", message: "hello" });
```

Always restore mocks in `afterEach`:

```typescript
afterEach(() => vi.restoreAllMocks());
```

### Web Tests: MSW (Mock Service Worker)

**Handler location:** `apps/web/src/test/msw-handlers.ts`

**Setup:** `apps/web/vitest.setup.ts`

```typescript
import { server } from "./src/test/msw-handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
```

**MSW handler pattern (tRPC-aware):**

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import superjson from "superjson";

const API_URL = "http://localhost:3001/trpc";

export const handlers = [
  http.get(`${API_URL}/*`, ({ request }) => {
    const url = new URL(request.url);
    const pathname = url.pathname.replace("/trpc/", "");
    const procedures = pathname.split(",");

    const results = procedures.map((proc) => {
      switch (proc) {
        case "reports.getActive":
          return { result: { data: superjson.serialize(createMockSection()) } };
        // ...
        default:
          return { result: { data: superjson.serialize(null) } };
      }
    });
    return HttpResponse.json(isBatch ? results : results[0]);
  }),
];

export const server = setupServer(...handlers);
```

**Important:** tRPC uses superjson for serialization. All mock responses must wrap data with `superjson.serialize()`.

### What to Mock

- Repository interfaces (via in-memory fakes) for service unit tests
- tRPC API responses (via MSW) for web component tests
- stdout/stderr (via vi.spyOn) for logger tests
- File system operations (via temp directories) for file-based tests

### What NOT to Mock

- Zod schemas -- always use real schemas in tests
- Domain error classes -- test the actual error mapping
- The Prisma client in integration tests -- use real DB

## Fixtures and Factories

**API Test Data:**

Location: `apps/api/src/test-utils/prisma-test-helper.ts`

```typescript
// Stable UUID fixtures for integration tests
export const TEST_IDS = {
  head: 'a0000000-0000-4000-a000-000000000099',
  lead: 'a0000000-0000-4000-a000-000000000001',
  project: 'a0000000-0000-4000-a000-000000000100',
  report: 'a0000000-0000-4000-a000-000000000010',
  // ...
} as const;

// Seeds minimal test data
export async function seedTestData(prisma: PrismaClient) {
  const head = await prisma.user.create({ data: { id: TEST_IDS.head, ... } });
  const lead = await prisma.user.create({ data: { id: TEST_IDS.lead, ... } });
  // ...
  return { head, lead, project, report, section };
}

// FK-safe cleanup in reverse dependency order
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.carryOverRecord.deleteMany();
  await prisma.carryOverExecution.deleteMany();
  // ... all tables in reverse FK order
  await prisma.user.deleteMany();
}
```

**UUID convention:** Use RFC4122 v4-valid UUIDs in tests. Version digit at position 13 must be `[1-8]`, variant at position 17 must be `[89ab]`. Pattern: `'a0000000-0000-4000-a000-000000000001'`.

**Web Test Data:**

Location: `apps/web/src/test/fixtures.ts`

```typescript
import type { ReportSectionReadModel } from "@customreport/shared";

export function createDemoSection(): ReportSectionReadModel {
  return {
    reportSectionId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    // ... typed to match Zod schema exactly
  };
}
```

**Schema test fixtures** (in `packages/shared/src/schemas/__tests__/report.test.ts`):

```typescript
const uuid = () => randomUUID();
const validItem = () => ({
  projectId: uuid(),
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
});

// Boundary-testing helpers:
const makeItems = (count: number) =>
  Array.from({ length: count }, () => validItem());
```

## Coverage

**Requirements:** No coverage thresholds enforced. No coverage config in vitest or CI.

**View Coverage:**

```bash
pnpm --filter @customreport/api exec vitest run --coverage
pnpm --filter @customreport/web exec vitest run --coverage
```

## Test Types

### Unit Tests (`*.service.test.ts`, `*.test.ts`)

- **Scope:** Test service logic in isolation using in-memory repository fakes
- **No DB, no network, no file system** (except logger tests using temp dirs)
- **Pattern:** Create service with `createRepository()` fake, call methods, assert output
- **All modules have unit tests:** admin, archive, auth, carry-over, pdf-export, period, publication, reminders, report-sections, review, weekly-report
- **Example file:** `apps/api/src/modules/admin/admin.service.test.ts`

### Contract Tests (`*.contract.test.ts`)

- **Scope:** Verify service output conforms to Zod schemas and rejects malformed data
- **Pattern:** Use in-memory fakes, call service, parse output through Zod schema, test both valid and invalid data
- **Validates schema boundary contracts** between layers
- **Example:**

```typescript
it('validates output through Zod schema (rejects malformed data)', async () => {
  const malformed = { reportId: 'not-a-uuid', ... } as unknown as ArchiveReportSummary;
  const repo = createInMemoryRepository([malformed], new Map());
  const service = new ArchiveService(repo);
  await expect(service.listArchiveReports()).rejects.toThrow(ZodError);
});

it('validates output conforms to archiveReportSummarySchema', async () => {
  const result = await service.listArchiveReports();
  for (const report of result.items) {
    expect(() => archiveReportSummarySchema.parse(report)).not.toThrow();
  }
});
```

- **Files:** `apps/api/src/modules/archive/archive.contract.test.ts`, `apps/api/src/modules/carry-over/carry-over.contract.test.ts`, `apps/api/src/modules/pdf-export/pdf-export.contract.test.ts`, `apps/api/src/modules/period/period.contract.test.ts`, `apps/api/src/modules/publication/publication.contract.test.ts`, `apps/api/src/modules/reminders/reminders.contract.test.ts`, `apps/api/src/modules/report-sections/report-sections.contract.test.ts`, `apps/api/src/modules/report-sections/lead-form.contract.test.ts`, `apps/api/src/modules/review/review.contract.test.ts`, `apps/api/src/modules/weekly-report/weekly-report.contract.test.ts`

### Schema Boundary Tests (`packages/shared`)

- **Scope:** Exhaustive validation of Zod schemas -- boundaries, edge cases, type coercion, null bytes, zero-width spaces
- **Pattern:** Use `schema.safeParse()` and check `result.success` + error messages
- **Location:** `packages/shared/src/schemas/__tests__/report.test.ts` (1333 lines, 22+ describe groups)
- **Tests cover:**
  - Array length boundaries (max 100 items, 50 priorities)
  - `safeText()` validation (null bytes, zero-width spaces, BOM, whitespace-only)
  - Enum acceptance/rejection
  - Date coercion and `reportDate()` year >= 2000 boundary
  - UUID validation on all ID fields
  - `validateSubmitInput()` business logic function

### Integration Tests (`*.integration.test.ts`)

- **Scope:** Test Prisma repository implementations against real PostgreSQL
- **Requires:** Running PostgreSQL database (`DATABASE_URL` env var or default `customreport_test`)
- **Pattern:**

```typescript
describe("AdminPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: AdminPrismaRepository;

  beforeAll(() => {
    repo = new AdminPrismaRepository(prisma as never);
  });
  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });
  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("getSnapshot returns users, projects, periods, and rules", async () => {
    const snapshot = await repo.getSnapshot();
    expect(snapshot.users.length).toBeGreaterThanOrEqual(2);
  });
});
```

- **Run separately:** `pnpm --filter @customreport/api run test:integration`
- **Sequential execution:** Uses `--fileParallelism=false` to prevent DB conflicts
- **14 integration test files** across `apps/api/src/modules/`

### E2E Tests (`apps/web/e2e/`)

- **Framework:** Playwright 1.55+
- **Config:** `apps/web/playwright.config.ts`
- **Fixtures:** Role-scoped pages via `apps/web/e2e/fixtures.ts`

```typescript
// Custom fixtures provide role-scoped browser contexts
type Fixtures = {
  leadPage: Page;
  headPage: Page;
};

export const test = base.extend<Fixtures>({
  leadPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, "lead.json"),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});
```

**E2E test pattern:**

```typescript
import { test, expect } from "./fixtures";

test.describe("Lead Report Page", () => {
  test.beforeEach(async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test('shows "My Report" heading', async ({ leadPage }) => {
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
  });
});
```

**Playwright config details:**

- Tests on Chromium only (Desktop Chrome)
- Auth setup project runs first, writes storage state to `e2e/.auth/`
- WebServer auto-starts Next.js on port 3100 with `AUTH_DEV_MODE=true`
- Timeout: 60s per test, 10s for expect, 120s for webServer startup
- Retries: 2 in CI, 0 locally
- Reporter: `github` in CI, `html` locally
- Traces: on first retry
- Screenshots: only on failure

**Current E2E test files:**

- `apps/web/e2e/lead-journey.spec.ts` -- Lead report form
- `apps/web/e2e/head-dashboard.spec.ts` -- Head dashboard
- `apps/web/e2e/weekly-report.spec.ts` -- Weekly report view
- `apps/web/e2e/admin-panel.spec.ts` -- Admin panel
- `apps/web/e2e/lead-history.spec.ts` -- Lead history page
- `apps/web/e2e/pdf-export.spec.ts` -- PDF export flow
- `apps/web/e2e/period-features.spec.ts` -- Period lifecycle
- `apps/web/e2e/cross-role-lifecycle.spec.ts` -- Cross-role flows
- `apps/web/e2e/error-paths.spec.ts` -- Error handling
- `apps/web/e2e/a11y/accessibility.spec.ts` -- Accessibility (axe-core)
- `apps/web/e2e/responsive/breakpoints.spec.ts` -- Responsive layout
- `apps/web/e2e/visual/screenshots.spec.ts` -- Visual regression

## Common Patterns

**Async Testing:**

```typescript
it("loads a lead section", async () => {
  const service = new ReportSectionsService(createRepository(baseSection));
  await expect(
    service.getActiveSection(baseSection.reportSectionId),
  ).resolves.toMatchObject({
    reportSectionId: baseSection.reportSectionId,
  });
});
```

**Error Testing:**

```typescript
it("throws ArchiveDomainError when not found", async () => {
  const repo = createInMemoryRepository([], new Map());
  const service = new ArchiveService(repo);

  await expect(service.getArchiveReport(missingId)).rejects.toThrow(
    ArchiveDomainError,
  );
  await expect(service.getArchiveReport(missingId)).rejects.toThrow(
    `Archive report ${missingId} was not found.`,
  );
});
```

**Schema Boundary Testing:**

```typescript
it("rejects items array with 101 elements (exceeds max)", () => {
  const draft = { ...validDraft(), items: makeItems(101) };
  const result = draftSaveSchema.safeParse(draft);
  expect(result.success).toBe(false);
});
```

**Regression Test Labeling:**

```typescript
describe('upsertUser -- regression (ADM-020, ADM-021)', () => {
  it('creates a new user (ADM-020)', async () => { ... });
  it('updates existing user by ID (ADM-021)', async () => { ... });
});
```

## Test Inventory Summary

| Category              | Count        | Location                                                                                                                                                    |
| --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API unit tests        | 17 files     | `apps/api/src/modules/*/*.service.test.ts`, `apps/api/src/modules/auth/*.test.ts`, `apps/api/src/lib/*.test.ts`, `apps/api/src/infrastructure/**/*.test.ts` |
| API contract tests    | 10 files     | `apps/api/src/modules/*/*.contract.test.ts`                                                                                                                 |
| API integration tests | 14 files     | `apps/api/src/modules/*/*.integration.test.ts`                                                                                                              |
| API E2E test          | 1 file       | `apps/api/src/modules/auth/auth.e2e.spec.ts`                                                                                                                |
| Shared schema tests   | 4 files      | `packages/shared/src/schemas/__tests__/*.test.ts`, `packages/shared/src/trpc/router.test.ts`                                                                |
| Web unit tests        | 1 file       | `apps/web/src/server/auth/session.test.ts`                                                                                                                  |
| Web E2E tests         | 12 files     | `apps/web/e2e/**/*.spec.ts`                                                                                                                                 |
| **Total**             | **59 files** |                                                                                                                                                             |

---

_Testing analysis: 2026-04-24_
