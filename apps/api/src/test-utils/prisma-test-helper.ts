import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@prisma/client";
import pg from "pg";

import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
  sameLocalPostgresDatabaseTarget,
} from "../../../../prisma/guards/_destructive-guard.js";
import { requireEnv } from "../lib/env.js";

const SCRIPT_NAME = "api-integration-test";

let pool: pg.Pool | null = null;
let prismaInstance: PrismaClient | null = null;
let prismaDatabaseUrl: string | null = null;

export function assertTestDatabaseUrl(
  url: string,
  environment: DestructiveTargetEnv = process.env,
): void {
  assertE2eRuntimeDestructiveTarget(SCRIPT_NAME, url, environment);
  // Both explicit URLs must identify the shared database before cleanup.
  if (!environment.DATABASE_URL) {
    throw new Error(
      "[api-integration-test] DATABASE_URL is required to verify the shared database target before cleanup.",
    );
  }
  if (
    !sameLocalPostgresDatabaseTarget(SCRIPT_NAME, url, environment.DATABASE_URL)
  ) {
    throw new Error(
      "[api-integration-test] E2E_DATABASE_URL must resolve to the same database target as DATABASE_URL.",
    );
  }
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
  const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
  assertTestDatabaseUrl(databaseUrl);
  if (
    prismaInstance !== null &&
    (prismaDatabaseUrl === null ||
      !sameLocalPostgresDatabaseTarget(
        SCRIPT_NAME,
        prismaDatabaseUrl,
        databaseUrl,
      ))
  ) {
    throw new Error(
      "createTestPrisma: the existing client belongs to a different E2E database target",
    );
  }
  if (!prismaInstance) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
    });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
    prismaDatabaseUrl = databaseUrl;
  }
  return prismaInstance;
}

// TRUNCATE ACCESS EXCLUSIVE is safe only with --fileParallelism=false;
// concurrent holders (dev API / Studio on _test) hang beforeEach silently.
export async function cleanDatabase(): Promise<void> {
  const prisma = createTestPrisma();
  const list = await discoverTables(prisma);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

export async function disconnectTestPrisma(): Promise<void> {
  const activePrisma = prismaInstance;
  const activePool = pool;
  prismaInstance = null;
  pool = null;
  prismaDatabaseUrl = null;
  memoizedTableList = null;
  try {
    if (activePrisma) await activePrisma.$disconnect();
  } finally {
    if (activePool) await activePool.end();
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

interface PublishedSnapshotFixtureInput {
  readonly reportId: string;
  readonly periodStart: Date | string;
  readonly periodEnd: Date | string;
  readonly deadline?: Date | string | null;
  readonly publishedAt: Date | string;
  readonly publishedById?: string | null;
  readonly publishedByName?: string | null;
  readonly sectionOwners?: readonly {
    readonly reportSectionId: string;
    readonly authorId: string;
    readonly authorName: string;
    readonly groupId: string;
    readonly groupName: string;
  }[];
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

/** Minimal immutable snapshot for integration fixtures that do not test content. */
export function publishedSnapshotFixture(
  input: PublishedSnapshotFixtureInput,
): Prisma.InputJsonValue {
  return {
    reportId: input.reportId,
    periodStart: toIsoString(input.periodStart),
    periodEnd: toIsoString(input.periodEnd),
    deadline: input.deadline == null ? null : toIsoString(input.deadline),
    status: "published",
    publishedAt: toIsoString(input.publishedAt),
    publishedById: input.publishedById ?? null,
    publishedByName: input.publishedByName ?? null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: (input.sectionOwners ?? []).map((owner) => ({
      reportSectionId: owner.reportSectionId,
      reportId: input.reportId,
      authorId: owner.authorId,
      authorName: owner.authorName,
      authorRole: "lead",
      version: 1,
      status: "submitted",
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
      groupId: owner.groupId,
      groupName: owner.groupName,
    })),
  };
}

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

  // Product ownership is an explicit invariant: every fixture project must
  // have exactly one GroupProduct edge, independently of the lead's group.
  await prisma.groupProduct.create({
    data: {
      groupId: group.id,
      productId: project.id,
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
