import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper.js";
import { ensureLeadSection } from "../application/ensure-lead-section.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/customreport_test";

describe("ensureLeadSection transaction (integration)", () => {
  type LeadSectionPrisma = Parameters<typeof ensureLeadSection>[0];
  const prisma = new PrismaService({
    DATABASE_URL: TEST_DATABASE_URL,
    LOG_LEVEL: "error",
    DB_POOL_MAX: 2,
    DB_POOL_IDLE_TIMEOUT_MS: 1000,
    DB_POOL_CONNECTION_TIMEOUT_MS: 1000,
  } as never);

  beforeAll(async () => {
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await prisma.reportingGroup.create({
      data: {
        id: TEST_IDS.group,
        name: "Lead section transaction group",
      },
    });
    await prisma.user.create({
      data: {
        id: TEST_IDS.lead,
        email: "transaction-lead@test.local",
        name: "Transaction Lead",
        lastName: "Lead",
        firstName: "Transaction",
        role: "lead",
        samlId: "transaction-lead",
        reportingGroupId: TEST_IDS.group,
      },
    });
    await prisma.project.create({
      data: {
        id: TEST_IDS.project,
        name: "Transaction Project",
        leadId: TEST_IDS.lead,
      },
    });
    await prisma.report.create({
      data: {
        id: TEST_IDS.report,
        periodStart: new Date("2026-07-13"),
        periodEnd: new Date("2026-07-19"),
        deadline: new Date("2026-07-17"),
        status: "draft",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.onModuleDestroy();
  });

  it("rolls back the section when status seeding fails and succeeds on retry", async () => {
    const seedError = new Error("project status seed failed");
    const failingClient = {
      reportSection: prisma.reportSection,
      project: prisma.project,
      projectStatus: prisma.projectStatus,
      projectActivityLead: prisma.projectActivityLead,
      activityStatus: prisma.activityStatus,
      $transaction: (callback: (tx: LeadSectionPrisma) => Promise<unknown>) =>
        prisma.$transaction(async (tx) => {
          const seedFailure = vi
            .spyOn(tx.projectStatus, "createMany")
            .mockRejectedValueOnce(seedError);
          try {
            return await callback(tx);
          } finally {
            seedFailure.mockRestore();
          }
        }),
    } as unknown as LeadSectionPrisma;

    await expect(
      ensureLeadSection(failingClient, TEST_IDS.report, TEST_IDS.lead),
    ).rejects.toBe(seedError);

    await expect(
      prisma.reportSection.findUnique({
        where: {
          reportId_authorId: {
            reportId: TEST_IDS.report,
            authorId: TEST_IDS.lead,
          },
        },
      }),
    ).resolves.toBeNull();

    const retry = await ensureLeadSection(
      prisma,
      TEST_IDS.report,
      TEST_IDS.lead,
    );

    expect(retry.sectionId).toEqual(expect.any(String));
    await expect(
      prisma.projectStatus.count({
        where: { reportSectionId: retry.sectionId },
      }),
    ).resolves.toBe(1);
  });
});
