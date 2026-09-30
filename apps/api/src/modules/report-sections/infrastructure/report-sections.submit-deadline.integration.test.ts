import { setTimeout as delay } from "node:timers/promises";

import type { SubmitSectionPayload } from "@customreport/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  createPauseGate,
  type PauseGate,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "../../admin/index.js";
import {
  ReportSectionAccessError,
  ReportSectionsService,
} from "../application/report-sections.service";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const ONE_DAY = 24 * 60 * 60 * 1000;
const LOCK_TIMEOUT_MS = 5000;

function trackTransaction(
  prisma: PrismaClient,
  writer: { pid?: number },
  gate?: PauseGate,
): PrismaClient {
  const transaction = prisma.$transaction.bind(prisma);
  return new Proxy(prisma, {
    get(target, property): unknown {
      if (property === "$transaction") {
        return (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: { timeout?: number },
        ) =>
          transaction(
            async (tx) => {
              const rows = await tx.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`;
              writer.pid = expectDefined(rows[0]).pid;
              const result = await callback(tx);
              if (gate) await gate.pause();
              return result;
            },
            { timeout: 15_000, ...options },
          );
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
}

async function waitForPause(
  gate: PauseGate,
  writer: Promise<unknown>,
): Promise<void> {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(
    () => timeout.reject(new Error("Writer did not reach the commit barrier")),
    LOCK_TIMEOUT_MS,
  );
  try {
    await Promise.race([
      gate.paused,
      writer.then(() => {
        throw new Error("Writer committed without reaching the barrier");
      }),
      timeout.promise,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForBlockedWriter(
  prisma: PrismaClient,
  holderPid: number,
  waiter: { pid?: number },
): Promise<void> {
  const expires = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < expires) {
    const waiterPid = waiter.pid ?? null;
    const blocked = await prisma.$queryRaw<{ pid: number }[]>`
      SELECT activity.pid FROM pg_stat_activity AS activity
      WHERE activity.datname = current_database()
        AND activity.pid = ${waiterPid}
        AND ${holderPid} = ANY(pg_blocking_pids(activity.pid))
    `;
    if (blocked.length > 0) return;
    await delay(25);
  }
  throw new Error("Competing writer did not wait on the held transaction lock");
}

describe("submit versus manual deadline update (PostgreSQL interleaving)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let payload: SubmitSectionPayload;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: { gracePeriodHours: 0, allowLateSubmissions: false },
    });
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline: new Date(Date.now() + ONE_DAY) },
    });
    const stage = await prisma.stage.create({
      data: { name: "Development", sortOrder: 1 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: stage.id,
        projectId: testData.project.id,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });
    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Current work",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
    const repository = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
    const section = expectDefined(
      await repository.getSectionById(testData.section.id),
    );
    payload = {
      reportSectionId: section.reportSectionId,
      version: section.version,
      status: "draft",
      confirmed: true,
      projectStatuses: [{ projectId: testData.project.id, status: "green" }],
      stageStatuses: [],
      activityStatuses: [],
      items: section.items,
      risks: [],
      decisions: [],
    };
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  function readSectionState() {
    return prisma.reportSection.findUniqueOrThrow({
      where: { id: testData.section.id },
      include: {
        projectStatuses: true,
        stageStatuses: true,
        activityStatuses: true,
        items: true,
        risks: true,
        decisions: true,
      },
    });
  }

  async function interleave(
    order: "admin-first" | "submit-first",
    deadline: Date | null,
  ) {
    const gate = createPauseGate();
    const holder: { pid?: number } = {};
    const waiter: { pid?: number } = {};
    const heldPrisma = trackTransaction(prisma, holder, gate);
    const waitingPrisma = trackTransaction(prisma, waiter);
    const adminPrisma = order === "admin-first" ? heldPrisma : waitingPrisma;
    const submitPrisma = order === "submit-first" ? heldPrisma : waitingPrisma;
    const admin = new AdminPrismaRepository(
      adminPrisma as unknown as PrismaService,
    );
    const sections = new ReportSectionsPrismaRepository(
      submitPrisma as unknown as PrismaService,
    );
    const service = new ReportSectionsService(sections);
    const update = () =>
      admin.updatePeriodManual({
        reportId: testData.report.id,
        expectedPeriodState: "open",
        data: { deadline },
      });
    const submit = () => service.submitSection(payload, testData.lead.id);
    const first = order === "admin-first" ? update() : submit();
    void first.catch(() => undefined);
    let second:
      ReturnType<typeof submit> | ReturnType<typeof update> | undefined;
    try {
      await waitForPause(gate, first);
      second = order === "admin-first" ? submit() : update();
      void second.catch(() => undefined);
      await waitForBlockedWriter(prisma, expectDefined(holder.pid), waiter);
    } finally {
      gate.release();
      await Promise.allSettled([first, ...(second ? [second] : [])]);
    }
    const results = await Promise.allSettled([first, expectDefined(second)]);
    const adminResult = expectDefined(results[order === "admin-first" ? 0 : 1]);
    const submitResult = expectDefined(
      results[order === "admin-first" ? 1 : 0],
    );
    return { adminResult, submitResult };
  }

  it("rejects when admin shortens the deadline first, preserving original section and children", async () => {
    const before = await readSectionState();
    const { adminResult, submitResult } = await interleave(
      "admin-first",
      new Date(Date.now() - 2 * ONE_DAY),
    );

    expect(adminResult.status).toBe("fulfilled");
    expect(submitResult.status).toBe("rejected");
    if (submitResult.status === "rejected")
      expect(submitResult.reason).toBeInstanceOf(ReportSectionAccessError);
    expect(await readSectionState()).toEqual(before);
  }, 20_000);

  it("accepts with late=false when admin extends an expired deadline first", async () => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline: new Date(Date.now() - 2 * ONE_DAY) },
    });
    const { adminResult, submitResult } = await interleave(
      "admin-first",
      new Date(Date.now() + ONE_DAY),
    );

    expect(adminResult.status).toBe("fulfilled");
    expect(submitResult.status).toBe("fulfilled");
    expect(await readSectionState()).toMatchObject({
      status: "submitted",
      late: false,
      version: 2,
    });
  }, 20_000);

  it("preserves a submit that wins the lock before the deadline is shortened", async () => {
    const { adminResult, submitResult } = await interleave(
      "submit-first",
      new Date(Date.now() - 2 * ONE_DAY),
    );

    expect(submitResult.status).toBe("fulfilled");
    expect(adminResult.status).toBe("fulfilled");
    expect(await readSectionState()).toMatchObject({
      status: "submitted",
      late: false,
      version: 2,
    });
  }, 20_000);
});
