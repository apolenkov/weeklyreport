import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../lib/logger";
import { createBootstrapJobsService } from "./jobs-service.js";

// The recovery list is DB-backed: a terminally failed row must stay visible
// after its generation's queue job is removed or pruned, so the Prisma where
// clause — never Redis — is the contract under test.
describe("createBootstrapJobsService — listPdfRecoveryJobs", () => {
  // Mirrors the findMany select: id, reportId, generation, requestedBy,
  // status, createdAt.
  const FAILED_ROW = {
    id: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    generation: 3,
    requestedBy: "33333333-3333-4333-8333-333333333333",
    status: "failed",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
  };
  const QUARANTINED_ROW = {
    id: "55555555-5555-4555-8555-555555555555",
    reportId: "66666666-6666-4666-8666-666666666666",
    generation: 2,
    requestedBy: "77777777-7777-4777-8777-777777777777",
    status: "recovery_required",
    createdAt: new Date("2026-09-02T10:00:00.000Z"),
  };

  function serviceReturning(rows: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(rows);
    const service = createBootstrapJobsService({
      queueRegistry: { get: () => ({}) as unknown as Queue },
      prisma: {
        pdfExportJob: { findMany },
      } as unknown as PrismaService,
      logger: createNullLogger(),
      pdfExportService: { retryExportGeneration: vi.fn() },
    });
    return { service, findMany };
  }

  it("selects failed and recovery_required rows and passes each row's status through", async () => {
    const { service, findMany } = serviceReturning([
      FAILED_ROW,
      QUARANTINED_ROW,
    ]);

    const list = await service.listPdfRecovery();

    const findManyArgs = findMany.mock.calls[0]?.[0] as
      { where?: { status?: { in?: readonly string[] } } } | undefined;
    expect(new Set(findManyArgs?.where?.status?.in)).toEqual(
      new Set(["failed", "recovery_required"]),
    );
    expect(list.jobs).toEqual([
      {
        jobId: FAILED_ROW.id,
        reportId: FAILED_ROW.reportId,
        generation: FAILED_ROW.generation,
        requestedBy: FAILED_ROW.requestedBy,
        status: "failed",
        createdAt: FAILED_ROW.createdAt,
      },
      {
        jobId: QUARANTINED_ROW.id,
        reportId: QUARANTINED_ROW.reportId,
        generation: QUARANTINED_ROW.generation,
        requestedBy: QUARANTINED_ROW.requestedBy,
        status: "recovery_required",
        createdAt: QUARANTINED_ROW.createdAt,
      },
    ]);
  });

  it("reads one bounded page strictly after the cursor in createdAt, id order", async () => {
    const { service, findMany } = serviceReturning([QUARANTINED_ROW]);
    const cursor = { createdAt: FAILED_ROW.createdAt, jobId: FAILED_ROW.id };

    await service.listPdfRecovery({ cursor, limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ["failed", "recovery_required"] },
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.jobId } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 2,
      }),
    );
  });
});
