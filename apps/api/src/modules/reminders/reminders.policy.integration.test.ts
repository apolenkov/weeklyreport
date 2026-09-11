import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { PolicyApplicatorService } from "./policy-applicator.service";

// Unit tests mock Prisma; schema drift only fails here (real unique index/FK).
describe("PolicyApplicatorService (integration)", () => {
  const prisma = createTestPrisma();
  let applicator: PolicyApplicatorService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  // Keep policy ids stable so the assertions read top-down.
  const policyDeadlineId = "b1111111-1111-4111-8111-111111111111";
  const policyEscalationId = "b2222222-2222-4222-8222-222222222222";

  beforeAll(() => {
    // Cast to PrismaService so the Nest-provider typing is preserved without
    // dragging the full Nest container into the test setup — mirrors
    // `admin.integration.test.ts`.
    applicator = new PolicyApplicatorService(
      prisma as unknown as PrismaService,
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("creates one ReminderRule with DST-correct fireAt for an active in-window policy", async () => {
    // Policy: T-24h before deadline, Europe/Moscow, lead-with-draft.
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-04-01T00:00:00.000Z"),
        validUntil: null,
      },
    });

    // The Period.deadline lives on the Report row already created in
    // seedTestData (deadline = 2026-04-11). Override the deadline so
    // the offset math is unambiguous.
    const deadline = new Date("2026-06-01T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });

    const result = await applicator.applyToPeriod(testData.report.id);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(1);
    const rule = rules.at(0);
    if (!rule) throw new Error("expected one rule");
    expect(rule.policyId).toBe(policyDeadlineId);
    expect(rule.kind).toBe("deadline");
    expect(rule.timezone).toBe("Europe/Moscow");
    expect(rule.status).toBe("active");
    expect(rule.deadline).toEqual(deadline);

    // T-1440 min from 2026-06-01T18:00Z (Moscow is UTC+3 year-round
    // since 2014) → 2026-05-31T18:00Z.
    const expectedFireAt = DateTime.fromISO("2026-05-31T18:00:00.000Z", {
      zone: "utc",
    });
    expect(rule.fireAt.toISOString()).toBe(
      expectedFireAt.toUTC().toISO({ suppressMilliseconds: false }),
    );
  });

  it("locks fixed-offset Europe/Moscow math around the historical EU DST date (March 30)", async () => {
    // Europe/Moscow is fixed UTC+3 year-round since Oct 2014 (no DST).
    // This locks offset arithmetic on a date that would shift under a
    // stale tzdata snapshot still applying EU DST to Moscow.
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
      },
    });

    const deadline = new Date("2026-03-30T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });

    await applicator.applyToPeriod(testData.report.id);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(1);
    const rule = rules.at(0);
    if (!rule) throw new Error("expected one rule");
    expect(rule.fireAt.toISOString()).toBe("2026-03-29T18:00:00.000Z");
  });

  it("skips a policy when validUntil is BEFORE the period deadline", async () => {
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2026-03-01T00:00:00.000Z"),
      },
    });

    const deadline = new Date("2026-06-01T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });

    const result = await applicator.applyToPeriod(testData.report.id);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(0);
  });

  it("skips a policy when validFrom is AFTER the period deadline", async () => {
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-12-01T00:00:00.000Z"),
        validUntil: null,
      },
    });

    const deadline = new Date("2026-06-01T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });

    const result = await applicator.applyToPeriod(testData.report.id);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(0);
  });

  it("produces zero rules when there are no active policies", async () => {
    // Inactive policy → must be ignored even though it would otherwise
    // pass the validity gate.
    await prisma.reminderPolicy.create({
      data: {
        id: policyEscalationId,
        kind: "escalation",
        offsetMinutes: 120,
        timezone: "Europe/Moscow",
        audience: "HEAD_OF_LATE",
        active: false,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
      },
    });

    const deadline = new Date("2026-06-01T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });

    const result = await applicator.applyToPeriod(testData.report.id);
    expect(result.created).toBe(0);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(0);
  });

  it("is idempotent — re-running the applicator does not duplicate rules", async () => {
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-04-01T00:00:00.000Z"),
        validUntil: null,
      },
    });

    const deadline = new Date("2026-06-01T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline },
    });

    const first = await applicator.applyToPeriod(testData.report.id);
    expect(first.created).toBe(1);
    expect(first.updated).toBe(0);

    const second = await applicator.applyToPeriod(testData.report.id);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.skipped).toBe(1);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(1);
  });

  it("repairs a committed period once when concurrent recovery observes a missing rule", async () => {
    const deadline = new Date("2099-06-01T18:00:00.000Z");
    const expectedFireAt = new Date("2099-05-31T18:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        deadline,
        periodState: "open",
        status: "draft",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    });
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2098-01-01T00:00:00.000Z"),
        validUntil: null,
      },
    });
    await expect(
      prisma.reminderRule.count({
        where: { reportId: testData.report.id, policyId: policyDeadlineId },
      }),
    ).resolves.toBe(0);

    const concurrent = await Promise.all([
      applicator.repairToPeriod(testData.report.id),
      applicator.repairToPeriod(testData.report.id),
    ]);
    const aggregate = concurrent.reduce(
      (total, result) => ({
        created: total.created + result.created,
        updated: total.updated + result.updated,
        skipped: total.skipped + result.skipped,
      }),
      { created: 0, updated: 0, skipped: 0 },
    );
    expect(aggregate).toEqual({ created: 1, updated: 0, skipped: 1 });

    const repairedRules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id, policyId: policyDeadlineId },
    });
    expect(repairedRules).toHaveLength(1);
    expect(repairedRules[0]).toMatchObject({
      deadline,
      fireAt: expectedFireAt,
      kind: "deadline",
      status: "active",
      timezone: "Europe/Moscow",
      version: 1,
    });

    const repairedRule = repairedRules[0];
    if (!repairedRule) throw new Error("expected one repaired rule");
    await expect(
      applicator.repairToPeriod(testData.report.id),
    ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
    await expect(
      prisma.reminderRule.findUniqueOrThrow({
        where: { id: repairedRule.id },
      }),
    ).resolves.toEqual(repairedRule);
  });

  it("preserves a restored paused rule and its execution history during repair", async () => {
    const deadline = new Date("2099-06-01T18:00:00.000Z");
    const restoredRuleId = "b3333333-3333-4333-8333-333333333333";
    const restoredExecutionId = "b4444444-4444-4444-8444-444444444444";
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        deadline,
        periodState: "open",
        status: "draft",
        periodStatus: "open",
        archived: false,
      },
    });
    await prisma.reminderPolicy.create({
      data: {
        id: policyDeadlineId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2098-01-01T00:00:00.000Z"),
        validUntil: null,
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: restoredRuleId,
        reportId: testData.report.id,
        policyId: policyDeadlineId,
        kind: "deadline",
        fireAt: new Date("2098-05-31T18:00:00.000Z"),
        deadline: new Date("2098-06-01T18:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "paused",
        version: 1,
      },
    });
    await prisma.reminderExecution.create({
      data: {
        id: restoredExecutionId,
        ruleId: restoredRuleId,
        recipientEmail: "restored-lead@test.local",
        dedupeKey: `${restoredRuleId}:deadline:2098-06-01:restored-lead@test.local`,
        status: "sent",
        sentAt: new Date("2098-05-31T18:01:00.000Z"),
        error: null,
        queuePayload: { contractVersion: 1, source: "restored-fixture" },
      },
    });
    const before = await prisma.reminderRule.findUniqueOrThrow({
      where: { id: restoredRuleId },
      include: { executions: true },
    });

    await expect(
      applicator.repairToPeriod(testData.report.id),
    ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
    await expect(
      prisma.reminderRule.findUniqueOrThrow({
        where: { id: restoredRuleId },
        include: { executions: true },
      }),
    ).resolves.toEqual(before);
    await expect(
      prisma.reminderRule.count({
        where: { reportId: testData.report.id, policyId: policyDeadlineId },
      }),
    ).resolves.toBe(1);
  });
});
