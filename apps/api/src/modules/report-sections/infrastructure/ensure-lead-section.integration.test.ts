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
import { requireEnv } from "../../../lib/env.js";
import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  publishedSnapshotFixture,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper.js";
import { ensureLeadSection } from "../application/ensure-lead-section.js";
import { ReportSectionDomainError } from "../application/report-sections.service.js";

const TEST_DATABASE_URL = requireEnv(process.env, "E2E_DATABASE_URL");

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
    await cleanDatabase();
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
    await prisma.groupProduct.create({
      data: { groupId: TEST_IDS.group, productId: TEST_IDS.project },
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
    await cleanDatabase();
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

  it("creates no section when publish wins before the provisioning lock", async () => {
    const gate = createPauseGate();
    const pausedPrisma = pauseBeforeTransaction(prisma, gate.pause);
    const provisioning = ensureLeadSection(
      pausedPrisma,
      TEST_IDS.report,
      TEST_IDS.lead,
    );
    await gate.paused;
    const publishedAt = new Date("2026-07-17T12:00:00.000Z");
    await prisma.report.update({
      where: { id: TEST_IDS.report },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: TEST_IDS.report,
          periodStart: "2026-07-13",
          periodEnd: "2026-07-19",
          deadline: "2026-07-17",
          publishedAt,
        }),
      },
    });
    gate.release();

    await expect(provisioning).rejects.toBeInstanceOf(ReportSectionDomainError);
    await expect(
      prisma.reportSection.count({ where: { reportId: TEST_IDS.report } }),
    ).resolves.toBe(0);
  });
});
