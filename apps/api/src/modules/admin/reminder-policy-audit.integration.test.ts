import { setTimeout as delay } from "node:timers/promises";

import type { Prisma } from "@prisma/client";
import type { ReminderPolicy } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";
import type { AuditLogger } from "../../lib/audit-logger-types.js";
import { createNullLogger } from "../../lib/logger.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import {
  createPauseGate,
  pauseBeforeTransaction,
  type PauseGate,
} from "../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper.js";
import { adminSession } from "./__tests__/focused-admin-harness.js";
import { AdminPrismaRepository } from "./admin.prisma-repository.js";
import { ReminderAdminService } from "./reminder-admin.service.js";

const policy: ReminderPolicy = {
  id: "c1111111-1111-4111-8111-111111111111",
  kind: "deadline",
  offsetMinutes: -180,
  timezone: "Europe/Moscow",
  audience: "lead-with-draft",
  active: false,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: null,
};
const policyData = { ...policy, audience: "LEAD_WITH_DRAFT" as const };

function buildCaller(
  prisma: ConstructorParameters<typeof AdminPrismaRepository>[0],
  policySave: AuditLogger["policySave"],
) {
  const reminderAdminService = new ReminderAdminService(
    new AdminPrismaRepository(prisma),
    createNullLogger(),
  );
  const deps = { reminderAdminService } as unknown as Parameters<
    typeof createAppRouter
  >[0];
  return createAppRouter(deps).createCaller({
    session: adminSession,
    logger: createNullLogger(),
    auditLogger: { ...createNullAuditLogger(), policySave },
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

async function waitForTransactionGate(
  gate: PauseGate,
  pending: Promise<unknown>,
): Promise<void> {
  const controller = new AbortController();
  try {
    await Promise.race([
      gate.paused,
      pending.then(() => {
        throw new Error(
          "Policy save settled before reaching its transaction gate",
        );
      }),
      delay(8000, undefined, { signal: controller.signal }).then(() => {
        throw new Error(
          "Policy save did not reach its transaction gate within 8s",
        );
      }),
    ]);
  } finally {
    controller.abort();
  }
}

describe("admin.savePolicy committed audit outcome (PostgreSQL)", () => {
  const prisma = createTestPrisma();
  let fixtures: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    fixtures = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it(
    "audits one create and one update for concurrent saves of an absent policy",
    { timeout: 15_000 },
    async () => {
      const gate = createPauseGate();
      const policySave = vi.fn<AuditLogger["policySave"]>();
      const delayed = buildCaller(
        pauseBeforeTransaction(prisma, gate.pause) as never,
        policySave,
      );
      const ordinary = buildCaller(prisma as never, policySave);
      const first = delayed.admin.savePolicy(policy);
      // Attach a rejection handler before waiting, and join before DB cleanup.
      const settled = Promise.allSettled([first]);
      try {
        await waitForTransactionGate(gate, first);
        await expect(ordinary.admin.savePolicy(policy)).resolves.toEqual(
          policy,
        );
        gate.release();
        await expect(first).resolves.toEqual(policy);

        expect(
          policySave.mock.calls.map(([event]) => event.action).sort(),
        ).toEqual(["create", "update"]);
        await expect(
          prisma.reminderPolicy.count({ where: { id: policy.id } }),
        ).resolves.toBe(1);
      } finally {
        gate.release();
        await settled;
      }
    },
  );

  it(
    "audits create when an existing policy is deleted before the save transaction",
    { timeout: 15_000 },
    async () => {
      await prisma.reminderPolicy.create({ data: policyData });
      const gate = createPauseGate();
      const policySave = vi.fn<AuditLogger["policySave"]>();
      const caller = buildCaller(
        pauseBeforeTransaction(prisma, gate.pause) as never,
        policySave,
      );
      const pending = caller.admin.savePolicy(policy);
      const settled = Promise.allSettled([pending]);
      try {
        await waitForTransactionGate(gate, pending);
        await prisma.reminderPolicy.delete({ where: { id: policy.id } });
        gate.release();
        await expect(pending).resolves.toEqual(policy);
        expect(policySave.mock.calls.map(([event]) => event.action)).toEqual([
          "create",
        ]);
        await expect(
          prisma.reminderPolicy.findUnique({ where: { id: policy.id } }),
        ).resolves.toMatchObject(policyData);
      } finally {
        gate.release();
        await settled;
      }
    },
  );

  // These controls exercise the planned retry algorithm only after baseline RED.
  it("audits create after a real insert conflict followed by deletion before the policy lock", async () => {
    await prisma.reminderPolicy.create({ data: policyData });
    const policySave = vi.fn<AuditLogger["policySave"]>();
    const deletingPrisma = prisma.$extends({
      query: {
        reminderPolicy: {
          async createMany({ args, query }) {
            const result = await query(args);
            if (result.count === 0) {
              await prisma.reminderPolicy.delete({ where: { id: policy.id } });
            }
            return result;
          },
        },
      },
    });

    await expect(
      buildCaller(deletingPrisma as never, policySave).admin.savePolicy(policy),
    ).resolves.toEqual(policy);
    expect(policySave.mock.calls.map(([event]) => event.action)).toEqual([
      "create",
    ]);
    await expect(
      prisma.reminderPolicy.findUnique({ where: { id: policy.id } }),
    ).resolves.toMatchObject(policyData);
  });

  it("fails with CONFLICT and no success audit when competing deletions prevent securing a row", async () => {
    const policySave = vi.fn<AuditLogger["policySave"]>();
    const deletingPrisma = prisma.$extends({
      query: {
        reminderPolicy: {
          async createMany({ args, query }) {
            await prisma.reminderPolicy.create({ data: policyData });
            const result = await query(args);
            await prisma.reminderPolicy.delete({ where: { id: policy.id } });
            return result;
          },
        },
      },
    });

    await expect(
      buildCaller(deletingPrisma as never, policySave).admin.savePolicy(policy),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(policySave).not.toHaveBeenCalled();
    await expect(
      prisma.reminderPolicy.findUnique({ where: { id: policy.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.reminderRule.count({ where: { policyId: policy.id } }),
    ).resolves.toBe(0);
  });

  it("rolls back policy and actual rule writes without a success audit on reconciliation failure", async () => {
    expect(fixtures.report).toMatchObject({
      periodState: "open",
      status: "draft",
      periodStatus: "open",
      archived: false,
    });
    const deadline = fixtures.report.deadline;
    if (!deadline)
      throw new Error("Rollback fixture requires a report deadline");
    expect(deadline.getTime()).toBeGreaterThanOrEqual(
      fixtures.report.periodStart.getTime(),
    );
    expect(deadline.getTime()).toBeLessThanOrEqual(
      fixtures.report.periodEnd.getTime(),
    );
    const activePolicy = { ...policyData, active: true };
    await prisma.reminderPolicy.create({ data: activePolicy });
    const rule = await prisma.reminderRule.create({
      data: {
        reportId: fixtures.report.id,
        policyId: policy.id,
        kind: policy.kind,
        deadline,
        fireAt: new Date(deadline.getTime() + policy.offsetMinutes * 60_000),
        timezone: policy.timezone,
        status: "active",
        version: 1,
      },
    });
    const policySave = vi.fn<AuditLogger["policySave"]>();
    let affectedRuleCount = 0;
    let writtenRule: typeof rule | null = null;
    const transaction = prisma.$transaction.bind(prisma);
    const failingPrisma = new Proxy(prisma, {
      get(target, property): unknown {
        if (property !== "$transaction")
          return Reflect.get(target, property, target) as unknown;
        return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          transaction(async (tx) => {
            const reminderRule = new Proxy(tx.reminderRule, {
              get(delegate, operation): unknown {
                if (operation !== "updateMany")
                  return Reflect.get(delegate, operation, delegate) as unknown;
                return async (
                  args: Parameters<typeof tx.reminderRule.updateMany>[0],
                ) => {
                  const result = await tx.reminderRule.updateMany(args);
                  affectedRuleCount = result.count;
                  writtenRule = await tx.reminderRule.findUnique({
                    where: { id: rule.id },
                  });
                  if (result.count !== 1 || writtenRule?.status !== "paused") {
                    throw new Error("Rollback fixture did not mutate its rule");
                  }
                  throw new Error("injected failure after actual rule update");
                };
              },
            });
            return callback(
              new Proxy(tx, {
                get(client, operation): unknown {
                  if (operation === "reminderRule") return reminderRule;
                  return Reflect.get(client, operation, client) as unknown;
                },
              }),
            );
          });
      },
    });

    await expect(
      buildCaller(failingPrisma as never, policySave).admin.savePolicy(policy),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(affectedRuleCount).toBe(1);
    expect(writtenRule).toMatchObject({ id: rule.id, status: "paused" });
    expect(policySave).not.toHaveBeenCalled();
    await expect(
      prisma.reminderPolicy.findUnique({ where: { id: policy.id } }),
    ).resolves.toMatchObject(activePolicy);
    await expect(
      prisma.reminderRule.findUnique({ where: { id: rule.id } }),
    ).resolves.toEqual(rule);
  });
});
