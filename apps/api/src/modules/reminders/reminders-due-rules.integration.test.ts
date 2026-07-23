import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper.js";
import {
  queryDueDeadlineRules,
  queryDueEscalationRules,
} from "./reminders-due-rules.prisma-query.js";

// Ruling F16: an admin can clear a period's deadline AFTER reminder rules
// materialized. The dispatch queries are the enforcing mechanism — such
// rules must never come back as due.
describe("due-rule queries vs a cleared deadline (integration)", () => {
  const prisma = createTestPrisma();
  // The query functions declare the Nest wrapper type but touch only the
  // Prisma delegate surface the raw client shares.
  const queryClient = prisma as unknown as PrismaService;
  const past = new Date("2026-07-20T10:00:00.000Z");
  const now = new Date("2026-07-24T10:00:00.000Z");

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  async function seedRule(kind: "deadline" | "escalation") {
    const testData = await seedTestData(prisma);
    await prisma.reminderRule.create({
      data: {
        reportId: testData.report.id,
        kind,
        fireAt: past,
        status: "active",
      },
    });
    return testData;
  }

  it("returns a due deadline rule while the period still has a deadline", async () => {
    await seedRule("deadline");
    const due = await queryDueDeadlineRules(queryClient, now);
    expect(due).toHaveLength(1);
  });

  it("returns nothing for a deadline rule after the deadline is cleared", async () => {
    const testData = await seedRule("deadline");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline: null },
    });

    await expect(queryDueDeadlineRules(queryClient, now)).resolves.toEqual([]);
  });

  it("returns nothing for an escalation rule after the deadline is cleared", async () => {
    const testData = await seedRule("escalation");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline: null },
    });

    const due = await queryDueEscalationRules(queryClient, now, {
      warn: () => undefined,
    });
    expect(due).toEqual([]);
  });
});
