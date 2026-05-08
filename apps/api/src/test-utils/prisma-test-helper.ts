import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/customreport_test';

let pool: pg.Pool | null = null;
let prismaInstance: PrismaClient | null = null;

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
 * Deletes all rows from all tables in FK-safe order.
 * Called in beforeEach to ensure test isolation.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in reverse dependency order to respect foreign key constraints
  await prisma.carryOverRecord.deleteMany();
  await prisma.carryOverExecution.deleteMany();
  await prisma.reminderExecution.deleteMany();
  await prisma.reminderRule.deleteMany();
  await prisma.pdfExportJob.deleteMany();
  await prisma.priority.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.item.deleteMany();
  await prisma.stageStatus.deleteMany();
  await prisma.projectStatus.deleteMany();
  await prisma.versionSnapshot.deleteMany();
  await prisma.reopenRequest.deleteMany();
  await prisma.reportSection.deleteMany();
  await prisma.report.deleteMany();
  // 35-04: stage assignments cascade-delete with project but the explicit
  // pass keeps the order deterministic across test runs that touch
  // assignments without owning their project lifecycle.
  await prisma.stageAssignment.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
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
  head: 'a0000000-0000-4000-a000-000000000099',
  lead: 'a0000000-0000-4000-a000-000000000001',
  project: 'a0000000-0000-4000-a000-000000000100',
  report: 'a0000000-0000-4000-a000-000000000010',
  targetReport: 'a0000000-0000-4000-a000-000000000020',
  reminderRule: 'a0000000-0000-4000-a000-000000000600',
  pdfJob1: 'a0000000-0000-4000-a000-000000000400',
  pdfJob2: 'a0000000-0000-4000-a000-000000000401',
  carryExec: 'a0000000-0000-4000-a000-000000000500',
  carryRecord: 'a0000000-0000-4000-a000-000000000501',
  carryTargetItem: 'a0000000-0000-4000-a000-000000000502',
  newProject: 'a0000000-0000-4000-a000-000000000300',
  reminderExec1: 'a0000000-0000-4000-a000-000000000610',
  reminderExec2: 'a0000000-0000-4000-a000-000000000611',
} as const;

/**
 * Seeds minimal test data: 1 head, 1 lead, 1 project, 1 report, 1 section.
 * Returns all created entities for use in test assertions.
 */
export async function seedTestData(prisma: PrismaClient) {
  const head = await prisma.user.create({
    data: {
      id: TEST_IDS.head,
      email: 'head@test.local',
      name: 'Test Head',
      role: 'head',
      samlId: 'head-test',
    },
  });

  const lead = await prisma.user.create({
    data: {
      id: TEST_IDS.lead,
      email: 'lead1@test.local',
      name: 'Test Lead 1',
      role: 'lead',
      samlId: 'lead-test-1',
    },
  });

  const project = await prisma.project.create({
    data: {
      id: TEST_IDS.project,
      name: 'Test Project 1',
      leadId: lead.id,
    },
  });

  const report = await prisma.report.create({
    data: {
      id: TEST_IDS.report,
      periodStart: new Date('2026-04-07'),
      periodEnd: new Date('2026-04-13'),
      deadline: new Date('2026-04-11'),
      status: 'draft',
    },
  });

  const section = await prisma.reportSection.create({
    data: {
      reportId: report.id,
      authorId: lead.id,
      status: 'draft',
    },
  });

  return { head, lead, project, report, section };
}
