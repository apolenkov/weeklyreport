import { computeReminderFireAt } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper.js";
import {
  queryDueDeadlineRules,
  queryDueEscalationRules,
} from "./reminders-due-rules.prisma-query.js";

describe("due-rule editable lifecycle gate (integration)", () => {
  const prisma = createTestPrisma();
  // The query functions declare the Nest wrapper type but touch only the
  // Prisma delegate surface the raw client shares.
  const queryClient = prisma as unknown as PrismaService;
  const past = new Date("2026-07-20T10:00:00.000Z");
  const now = new Date("2026-07-24T10:00:00.000Z");

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  const policyIds = {
    deadline: "a0000000-0000-4000-a000-000000000701",
    escalation: "a0000000-0000-4000-a000-000000000702",
  } as const;

  async function seedRule(kind: "deadline" | "escalation") {
    const testData = await seedTestData(prisma);
    const deadline =
      kind === "deadline"
        ? new Date("2026-07-20T11:30:00.000Z")
        : new Date("2026-07-20T08:00:00.000Z");
    const offsetMinutes = kind === "deadline" ? -90 : 120;
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });
    await prisma.reminderPolicy.create({
      data: {
        id: policyIds[kind],
        kind,
        offsetMinutes,
        timezone: "Europe/Moscow",
        audience: kind === "deadline" ? "LEAD_WITH_DRAFT" : "HEAD_OF_LATE",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        reportId: testData.report.id,
        policyId: policyIds[kind],
        kind,
        fireAt: computeReminderFireAt(deadline, offsetMinutes, "Europe/Moscow"),
        deadline,
        status: "active",
      },
    });
    if (kind === "escalation") {
      await prisma.reportingGroup.update({
        where: { id: TEST_IDS.group },
        data: { headUserId: testData.head.id },
      });
    }
    return { ...testData, report: { ...testData.report, deadline } };
  }

  async function queryDue(kind: "deadline" | "escalation") {
    return kind === "deadline"
      ? queryDueDeadlineRules(queryClient, now)
      : queryDueEscalationRules(queryClient, now, {
          warn: () => undefined,
        });
  }

  async function publishReport(
    testData: Awaited<ReturnType<typeof seedTestData>>,
    autoPublished: boolean,
  ): Promise<void> {
    const publishedAt = new Date("2026-07-23T10:00:00.000Z");
    const publishedById = autoPublished ? null : testData.head.id;
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        autoPublished,
        publishedAt,
        publishedById,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt,
          publishedById,
          publishedByName: autoPublished ? null : testData.head.name,
        }),
      },
    });
  }

  it.each(["deadline", "escalation"] as const)(
    "returns a due %s rule for a coherent open report",
    async (kind) => {
      await seedRule(kind);
      await expect(queryDue(kind)).resolves.toHaveLength(1);
    },
  );

  it.each(["deadline", "escalation"] as const)(
    "excludes an inactive lead from %s recipient discovery",
    async (kind) => {
      const testData = await seedRule(kind);
      await prisma.user.update({
        where: { id: testData.lead.id },
        data: { isActive: false },
      });

      await expect(queryDue(kind)).resolves.toEqual([]);
    },
  );

  it("returns the report deadline independently from a non-24h fire time", async () => {
    const testData = await seedRule("deadline");

    const [due] = await queryDueDeadlineRules(queryClient, now);
    expect(due?.fireAt).toEqual(past);
    expect(due?.deadline).toEqual(testData.report.deadline);
    expect(due?.deadline).not.toEqual(due?.fireAt);
  });

  it.each(["deadline", "escalation"] as const)(
    "returns nothing for a %s rule after the deadline is cleared",
    async (kind) => {
      const testData = await seedRule(kind);
      await prisma.report.update({
        where: { id: testData.report.id },
        data: { deadline: null },
      });

      await expect(queryDue(kind)).resolves.toEqual([]);
    },
  );

  it.each(["deadline", "escalation"] as const)(
    "returns nothing for a %s rule when the report is archived",
    async (kind) => {
      const testData = await seedRule(kind);
      await prisma.report.update({
        where: { id: testData.report.id },
        data: { archived: true, periodState: "archived" },
      });

      await expect(queryDue(kind)).resolves.toEqual([]);
    },
  );

  it.each(["deadline", "escalation"] as const)(
    "returns nothing for a %s rule before a scheduled report opens",
    async (kind) => {
      const testData = await seedRule(kind);
      await prisma.report.update({
        where: { id: testData.report.id },
        data: { periodState: "scheduled" },
      });

      await expect(queryDue(kind)).resolves.toEqual([]);
    },
  );

  it.each([
    ["deadline", false],
    ["escalation", false],
    ["deadline", true],
    ["escalation", true],
  ] as const)(
    "returns nothing for a %s rule after publication (auto=%s)",
    async (kind, autoPublished) => {
      const testData = await seedRule(kind);
      await publishReport(testData, autoPublished);

      await expect(queryDue(kind)).resolves.toEqual([]);
    },
  );

  it.each(["deadline", "escalation"] as const)(
    "returns a due %s rule after the report is reopened",
    async (kind) => {
      const testData = await seedRule(kind);
      await publishReport(testData, false);
      await prisma.report.update({
        where: { id: testData.report.id },
        data: {
          periodState: "open",
          periodStatus: "reopened",
          reopenedAt: new Date("2026-07-23T11:00:00.000Z"),
        },
      });

      await expect(queryDue(kind)).resolves.toHaveLength(1);
    },
  );
});
