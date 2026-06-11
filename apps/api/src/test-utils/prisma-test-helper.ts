import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/customreport_test";

let pool: pg.Pool | null = null;
let prismaInstance: PrismaClient | null = null;

/**
 * Asserts that the given DATABASE_URL targets a database whose name ends with
 * `_test`. Throws with the offending DB name (never the full URL or
 * credentials) and a hint to point DATABASE_URL at the dedicated
 * integration-test database.
 *
 * Stricter than `assertNonProdDestructive` in `prisma/_destructive-guard.ts`,
 * which unconditionally trusts any localhost URL. That contract is intentional
 * there — it prevents accidental remote-prod wipes but still allows dev shells
 * on localhost. Here we close that hole: `cleanDatabase` wipes EVERY table, so
 * a dev shell pointing at `customreport_dev` would silently destroy all local
 * data. We therefore require the `_test` suffix unconditionally, regardless of
 * host.
 *
 * Note: `prisma/_destructive-guard.ts` is NOT imported. It lives outside
 * `apps/api`'s tsconfig `rootDir`, and its localhost-trust contract is
 * incompatible with our stricter requirement.
 *
 * @see openspec/specs/destructive-db-guard/spec.md — ADDED requirement:
 *   the integration-test cleanup helper MUST assert a `_test`-suffixed
 *   database name in DATABASE_URL before any destructive operation.
 */
export function assertTestDatabaseUrl(url: string): void {
  // Parse with WHATWG URL so userinfo/host never leak into the error message:
  // for a path-less URL `pathname` is "" (naive string splitting would yield
  // "user:pass@host:port" here). An unparseable URL also yields "" — both
  // cases fail the `_test` check below without echoing anything sensitive.
  const dbName = extractDatabaseName(url);
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `cleanDatabase refused: DATABASE_URL points at "${dbName}", which does not end with "_test". ` +
        `Point DATABASE_URL at the dedicated integration-test database (e.g. customreport_test).`,
    );
  }
}

/**
 * Extracts the database name (last path segment, lowercased) from a connection
 * URL. Returns "" for a path-less or unparseable URL — never a fragment that
 * could contain credentials.
 */
function extractDatabaseName(url: string): string {
  try {
    const { pathname } = new URL(url);
    return (pathname.split("/").pop() ?? "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Memoized quoted table list for TRUNCATE. Reset to null on any discovery
 * failure so the next call retries the catalog query.
 */
let memoizedTableList: string | null = null;

/**
 * Discovers all app tables in the public schema (excluding _prisma_migrations)
 * and returns a quoted, comma-joined list suitable for use in TRUNCATE.
 *
 * Memoized — the schema is static per test run, so one catalog query suffices.
 * The list is reset on failure so a subsequent call retries.
 *
 * Physical table names in this schema are PascalCase (no @@map overrides).
 * Quoting is mandatory: unquoted `User` is an SQL reserved word.
 * Each name is double-quote-escaped ("" inside the identifier) for safety.
 *
 * CASCADE caveat: TRUNCATE ... CASCADE silently truncates any non-listed table
 * that is referenced by a listed one via FK. Only tables that have NO FK
 * relationship to any other app table (today: _prisma_migrations, which is
 * already excluded) may safely be omitted from the list.
 */
async function discoverTables(prisma: PrismaClient): Promise<string> {
  if (memoizedTableList !== null) {
    return memoizedTableList;
  }

  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  if (rows.length === 0) {
    throw new Error(
      "discoverTables: no app tables found in the public schema — did `prisma migrate reset` run?",
    );
  }

  const list = rows
    .map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`)
    .join(", ");

  memoizedTableList = list;
  return list;
}

/**
 * Creates (or returns cached) PrismaClient for integration tests.
 * Uses Prisma 7 driver adapter pattern (PrismaPg + pg.Pool) matching PrismaService.
 */
export function createTestPrisma(): PrismaClient {
  if (!prismaInstance) {
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

/**
 * Truncates all app tables in one statement, then resets identity sequences.
 * Called in beforeEach to ensure test isolation.
 *
 * Guard: refuses to run unless DATABASE_URL ends with `_test` — see
 * `assertTestDatabaseUrl` for the rationale.
 *
 * Lock note: TRUNCATE takes ACCESS EXCLUSIVE per table. This is safe only
 * because `test:integration` runs with `--fileParallelism=false`. If test
 * parallelism is ever enabled, revisit this approach; the symptom of a
 * concurrent lock holder (e.g. an idle-in-transaction connection from the dev
 * API server or Prisma Studio targeting `customreport_test`) is a silent hang
 * in beforeEach — diagnose via `pg_stat_activity`.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  assertTestDatabaseUrl(TEST_DATABASE_URL);

  const list = await discoverTables(prisma);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Disconnects PrismaClient and closes the pg.Pool.
 * Must be called in afterAll to avoid leaked connections.
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Valid RFC4122 UUID v4 test fixtures.
 * UUIDs must have version digit [1-8] in position 13 and variant [89ab] in position 17.
 */
export const TEST_IDS = {
  head: "a0000000-0000-4000-a000-000000000099",
  lead: "a0000000-0000-4000-a000-000000000001",
  group: "a0000000-0000-4000-a000-000000000009",
  project: "a0000000-0000-4000-a000-000000000100",
  report: "a0000000-0000-4000-a000-000000000010",
  targetReport: "a0000000-0000-4000-a000-000000000020",
  reminderRule: "a0000000-0000-4000-a000-000000000600",
  pdfJob1: "a0000000-0000-4000-a000-000000000400",
  pdfJob2: "a0000000-0000-4000-a000-000000000401",
  carryExec: "a0000000-0000-4000-a000-000000000500",
  carryRecord: "a0000000-0000-4000-a000-000000000501",
  carryTargetItem: "a0000000-0000-4000-a000-000000000502",
  newProject: "a0000000-0000-4000-a000-000000000300",
  reminderExec1: "a0000000-0000-4000-a000-000000000610",
  reminderExec2: "a0000000-0000-4000-a000-000000000611",
} as const;

/**
 * Seeds minimal test data: 1 head, 1 lead, 1 project, 1 report, 1 section.
 * Returns all created entities for use in test assertions.
 */
export async function seedTestData(prisma: PrismaClient) {
  const group = await prisma.reportingGroup.create({
    data: {
      id: TEST_IDS.group,
      name: "Test Group",
      description: "Test reporting group",
    },
  });

  const head = await prisma.user.create({
    data: {
      id: TEST_IDS.head,
      email: "head@test.local",
      name: "Test Head",
      role: "head",
      samlId: "head-test",
      reportingGroupId: group.id,
    },
  });

  const lead = await prisma.user.create({
    data: {
      id: TEST_IDS.lead,
      email: "lead1@test.local",
      name: "Test Lead 1",
      role: "lead",
      samlId: "lead-test-1",
      reportingGroupId: group.id,
    },
  });

  const project = await prisma.project.create({
    data: {
      id: TEST_IDS.project,
      name: "Test Project 1",
      leadId: lead.id,
    },
  });

  const report = await prisma.report.create({
    data: {
      id: TEST_IDS.report,
      periodStart: new Date("2026-04-07"),
      periodEnd: new Date("2026-04-13"),
      deadline: new Date("2026-04-11"),
      status: "draft",
    },
  });

  const section = await prisma.reportSection.create({
    data: {
      reportId: report.id,
      authorId: lead.id,
      status: "draft",
    },
  });

  return { head, lead, project, report, section };
}
