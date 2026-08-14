import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
} from "../../../../prisma/guards/_destructive-guard.js";
import { requireEnv } from "../lib/env.js";

let pool: pg.Pool | null = null;
let prismaInstance: PrismaClient | null = null;

export function assertTestDatabaseUrl(
  url: string,
  environment: DestructiveTargetEnv = process.env,
): void {
  assertE2eRuntimeDestructiveTarget("api-integration-test", url, environment);
}

// Memoized quoted table list for TRUNCATE (schema static per test run).
let memoizedTableList: string | null = null;

// PascalCase tables need quoting (User is reserved). CASCADE truncates any
// FK-linked table omitted from the list — only _prisma_migrations is excluded.
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

export function createTestPrisma(): PrismaClient {
  if (!prismaInstance) {
    const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
    assertTestDatabaseUrl(databaseUrl);
    pool = new pg.Pool({
      connectionString: databaseUrl,
    });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

// TRUNCATE ACCESS EXCLUSIVE is safe only with --fileParallelism=false;
// concurrent holders (dev API / Studio on _test) hang beforeEach silently.
export async function cleanDatabase(): Promise<void> {
  const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
  assertTestDatabaseUrl(databaseUrl);
  const prisma = createTestPrisma();
  const list = await discoverTables(prisma);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

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

// UUID v4 fixtures: version digit [1-8] pos 13, variant [89ab] pos 17.
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

// Sequential awaits, not Promise.all: each create depends on the previous
// row's FK.
async function seedUsers(prisma: PrismaClient, reportingGroupId: string) {
  const head = await prisma.user.create({
    data: {
      id: TEST_IDS.head,
      email: "head@test.local",
      name: "Test Head",
      lastName: "Test",
      firstName: "Head",
      role: "head",
      samlId: "head-test",
      reportingGroupId,
    },
  });

  const lead = await prisma.user.create({
    data: {
      id: TEST_IDS.lead,
      email: "lead1@test.local",
      name: "Test Lead 1",
      lastName: "Test",
      firstName: "Lead",
      role: "lead",
      samlId: "lead-test-1",
      reportingGroupId,
    },
  });

  return { head, lead };
}

export async function seedTestData(prisma: PrismaClient) {
  const group = await prisma.reportingGroup.create({
    data: {
      id: TEST_IDS.group,
      name: "Test Group",
      description: "Test reporting group",
    },
  });

  const { head, lead } = await seedUsers(prisma, group.id);

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
