import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { PolicyApplicatorService } from "./policy-applicator.service";

/**
 * UFB-036 (Phase 44-05): full create-policy → create-period →
 * assert-rule pipeline against the real Postgres test database.
 *
 * Complements the unit tests in `policy-applicator.test.ts` (which mock
 * Prisma) by exercising the actual unique index `uq_rule_report_policy`,
 * the actual nullable FK on `ReminderRule.policyId`, and the actual
 * `ReminderAudience` enum mapping. If the schema drifts, the unit
 * tests pass but this one fails.
 */
describe("PolicyApplicatorService (integration, Phase 44-05)", () => {
  const prisma = createTestPrisma();
  let applicator: PolicyApplicatorService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  // Keep policy ids stable so the assertions read top-down.
  const policyDeadlineId = "b1111111-1111-4111-8111-111111111111";
  const policyEscalationId = "b2222222-2222-4222-8222-222222222222";

  beforeAll(() => {
    // Cast to `never` to satisfy PrismaService (Nest provider) typing
    // without dragging the full Nest container into the test setup —
    // mirrors `admin.integration.test.ts`.
    applicator = new PolicyApplicatorService(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
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

    const result = await applicator.applyToPeriod({
      id: testData.report.id,
      deadline,
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    if (!rule) throw new Error("expected one rule");
    expect(rule.policyId).toBe(policyDeadlineId);
    expect(rule.kind).toBe("deadline");
    expect(rule.timezone).toBe("Europe/Moscow");
    expect(rule.status).toBe("active");

    // T-1440 min from 2026-06-01T18:00Z (Moscow is UTC+3 year-round
    // since 2014) → 2026-05-31T18:00Z.
    const expectedFireAt = DateTime.fromISO("2026-05-31T18:00:00.000Z", {
      zone: "utc",
    });
    expect(rule.fireAt.toISOString()).toBe(
      expectedFireAt.toUTC().toISO({ suppressMilliseconds: false }),
    );
  });

  it("locks the math across the historical EU DST boundary (March 30, Moscow)", async () => {
    // Moscow no longer observes DST since Oct 2014 — the test exists
    // to lock the math against a regression that re-introduces a TZ
    // table from a stale tzdata snapshot.
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

    await applicator.applyToPeriod({ id: testData.report.id, deadline });

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(1);
    const rule = rules[0];
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

    const result = await applicator.applyToPeriod({
      id: testData.report.id,
      deadline,
    });
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

    const result = await applicator.applyToPeriod({
      id: testData.report.id,
      deadline,
    });
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

    const result = await applicator.applyToPeriod({
      id: testData.report.id,
      deadline,
    });
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

    const first = await applicator.applyToPeriod({
      id: testData.report.id,
      deadline,
    });
    expect(first.created).toBe(1);
    expect(first.updated).toBe(0);

    const second = await applicator.applyToPeriod({
      id: testData.report.id,
      deadline,
    });
    // Second pass should hit the upsert update branch — no new row.
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const rules = await prisma.reminderRule.findMany({
      where: { reportId: testData.report.id },
    });
    expect(rules).toHaveLength(1);
  });
});
