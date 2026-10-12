import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import type { AdminTelemetry } from "../../modules/admin/index.js";
import { AdminPrismaRepository } from "../../modules/admin/index.js";
import { ReopenRequestAdminService } from "../../modules/admin/index.js";
import { ReopenRequestError } from "../../modules/report-sections/index.js";
import { LeadFormPrismaRepository } from "../../modules/report-sections/index.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";

// One-pending-per-section is a hand-written partial unique index (Prisma
// cannot express the WHERE predicate); the app check is friendly, the index
// is the durable race guarantee.

describe("ReopenRequest one-pending partial index (integration)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("the partial unique index is present in the schema", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ReopenRequest'
        AND indexname = 'ReopenRequest_one_pending_per_section'`;
    expect(rows).toHaveLength(1);
  });

  it("rejects a second pending request for the same section", async () => {
    await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });

    await expect(
      prisma.reopenRequest.create({
        data: {
          reportSectionId: testData.section.id,
          requestedById: testData.lead.id,
        },
      }),
    ).rejects.toThrow();

    const count = await prisma.reopenRequest.count({
      where: { reportSectionId: testData.section.id, status: "pending" },
    });
    expect(count).toBe(1);
  });

  it("serializes two concurrent decisions — exactly one conditional update wins", async () => {
    // Conditional updateMany on still-pending: concurrent deciders must let
    // only one flip the row.
    const req = await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });

    const [a, b] = await Promise.all([
      prisma.reopenRequest.updateMany({
        where: { id: req.id, status: "pending" },
        data: { status: "approved" },
      }),
      prisma.reopenRequest.updateMany({
        where: { id: req.id, status: "pending" },
        data: { status: "rejected" },
      }),
    ]);

    expect(a.count + b.count).toBe(1);
    const finalReq = await prisma.reopenRequest.findUniqueOrThrow({
      where: { id: req.id },
    });
    expect(finalReq.status).not.toBe("pending");
  });

  it("createReopenRequest translates the P2002 race into a friendly ReopenRequestError", async () => {
    // The app-level pending check can be passed by two concurrent callers; the
    // partial index then rejects the second with P2002. The repository must
    // translate that into the same domain error (→ BAD_REQUEST), not a 500.
    const repo = new LeadFormPrismaRepository(prisma as never);
    await repo.createReopenRequest(testData.section.id, testData.lead.id);

    await expect(
      repo.createReopenRequest(testData.section.id, testData.lead.id),
    ).rejects.toBeInstanceOf(ReopenRequestError);
  });

  it("allows a new pending request once the prior one is decided", async () => {
    const first = await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });
    await prisma.reopenRequest.update({
      where: { id: first.id },
      data: { status: "rejected" },
    });

    await expect(
      prisma.reopenRequest.create({
        data: {
          reportSectionId: testData.section.id,
          requestedById: testData.lead.id,
        },
      }),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("traverses 105 equal-time rows after the first-page anchor is deleted", async () => {
    const createdAt = new Date("2026-09-01T12:00:00.000Z");
    const requestIds = Array.from(
      { length: 105 },
      (_, index) =>
        `c0000000-0000-4000-a000-${String(index).padStart(12, "0")}`,
    );
    await prisma.reopenRequest.createMany({
      data: requestIds.map((id) => ({
        id,
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
        status: "approved",
        reviewedById: testData.head.id,
        reviewedAt: createdAt,
        reviewNote: "Approved for pagination fixture.",
        createdAt,
      })),
    });

    const telemetry: AdminTelemetry = {
      recordReopenRequestDecision: () => undefined,
    };
    const service = new ReopenRequestAdminService(
      new AdminPrismaRepository(prisma as never),
      createNullLogger(),
      telemetry,
    );
    const session: UserSession = {
      userId: testData.head.id,
      email: testData.head.email,
      name: testData.head.name,
      role: "admin",
      activeReportId: null,
      activeReportSectionId: null,
    };
    const pages: Awaited<ReturnType<typeof service.listReopenRequests>>[] = [];
    const returnedIds: string[] = [];
    let cursor:
      | Awaited<ReturnType<typeof service.listReopenRequests>>["nextCursor"]
      | undefined;

    do {
      const page = await service.listReopenRequests({
        session,
        status: "all",
        limit: 50,
        ...(cursor ? { cursor } : {}),
      });
      pages.push(page);
      returnedIds.push(...page.items.map((item) => item.id));

      if (pages.length === 1) {
        const anchor = page.items.at(-1);
        if (!anchor || !page.nextCursor) {
          throw new Error("expected a full first page with a continuation");
        }
        expect(page.nextCursor.id).toBe(anchor.id);
        await prisma.reopenRequest.delete({ where: { id: anchor.id } });
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(pages.map((page) => page.items.length)).toEqual([50, 50, 5]);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(returnedIds).toHaveLength(requestIds.length);
    expect(new Set(returnedIds).size).toBe(requestIds.length);
    expect(returnedIds).toEqual(requestIds.toReversed());
  });
});
