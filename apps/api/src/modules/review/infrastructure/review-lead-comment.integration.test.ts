import type { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createPauseGate } from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { ReportSectionsPrismaRepository } from "../../report-sections/test-seams/index.js";
import { ReviewNotFoundError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

const STABLE_ID = "83600000-0000-4000-8000-000000000001";
const EQUAL_TIME = new Date("2026-04-08T10:00:00.000Z");

/** Pause after real SQL, inside the real transaction; never substitute results. */
function pauseAfterLineageRead(
  prisma: PrismaClient,
  pause: () => Promise<void>,
): PrismaClient {
  const transaction = prisma.$transaction.bind(prisma);
  return new Proxy(prisma, {
    get(target, property): unknown {
      if (property !== "$transaction") {
        return Reflect.get(target, property, target) as unknown;
      }
      return (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: { timeout?: number },
      ) =>
        transaction(async (tx) => {
          let first = true;
          const item = new Proxy(tx.item, {
            get(delegate, method): unknown {
              if (method !== "findUnique") {
                return Reflect.get(delegate, method, delegate) as unknown;
              }
              return async (args: Parameters<typeof tx.item.findUnique>[0]) => {
                const result = await tx.item.findUnique(args);
                if (first) {
                  first = false;
                  await pause();
                }
                return result;
              };
            },
          });
          return callback(
            new Proxy(tx, {
              get(client, key): unknown {
                return key === "item"
                  ? item
                  : (Reflect.get(client, key, client) as unknown);
              },
            }),
          );
        }, options);
    },
  });
}

describe("Lead replies versus canonical save (PostgreSQL integration)", () => {
  // Uses the existing exact-target guard and destructive integration fixture.
  // Run only in the coordinated, reset + seeded, serial integration phase.
  const prisma = createTestPrisma();
  const repo = new ReviewActionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const sections = new ReportSectionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  const actor = () => ({ userId: data.lead.id, role: "lead" as const });
  const model = async () =>
    expectDefined(await sections.getSectionById(data.section.id));
  const seedItem = () =>
    prisma.item.create({
      data: {
        reportSectionId: data.section.id,
        stableId: STABLE_ID,
        projectId: data.project.id,
        type: "current",
        text: "Synthetic Lead reply target",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["dev"],
      },
    });
  const reply = (itemId: string, text = "Lead reply") =>
    repo.insertLeadItemComment(actor(), itemId, text);
  const liveRows = () =>
    prisma.recordComment.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

  async function expectDenied(itemId: string) {
    await expect(reply(itemId)).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Record not found.",
    });
    expect(await liveRows()).toEqual([]);
  }

  // The gate is after initial lineage SQL and before User/Report locks. The
  // competing writer commits before release: deterministic transaction overlap,
  // not a claim that PostgreSQL observed a blocked lock waiter.
  async function replyAfterCompetingCommit(
    itemId: string,
    competingWrite: () => Promise<unknown>,
  ) {
    const gate = createPauseGate();
    const pausedRepo = new ReviewActionsPrismaRepository(
      pauseAfterLineageRead(prisma, gate.pause) as unknown as PrismaService,
    );
    const pending = pausedRepo
      .insertLeadItemComment(actor(), itemId, "Interleaved reply")
      .then(
        (value) => ({ kind: "success" as const, value }),
        (error: unknown) => ({ kind: "error" as const, error }),
      );
    try {
      // If the candidate rejects before reaching the seam, do not hang forever.
      const reached = await Promise.race([
        gate.paused.then(() => true),
        pending.then(() => false),
      ]);
      expect(reached).toBe(true);
      await competingWrite();
    } finally {
      gate.release();
      await pending;
    }
    return pending;
  }

  it("preserves confirmed reply identity, actor and timestamp through repeated physical recreation", async () => {
    const item = await seedItem();
    // Stale editor metadata must not erase a reply committed after its read.
    let draft = await model();
    const confirmed = await reply(item.id);
    expect(confirmed).toMatchObject({
      reviewerId: data.lead.id,
      reviewerName: data.lead.name,
      text: "Lead reply",
    });
    expect(confirmed.createdAt).toBeInstanceOf(Date);
    let previousId = item.id;
    for (const expectedVersion of [1, 2, 3]) {
      draft = await sections.saveSection(draft, draft.version);
      expect(draft.version).toBe(expectedVersion + 1);
      const physical = expectDefined(
        await prisma.item.findUnique({
          where: {
            reportSectionId_stableId: {
              reportSectionId: data.section.id,
              stableId: STABLE_ID,
            },
          },
        }),
      );
      expect(physical.id).not.toBe(previousId);
      expect(await liveRows()).toEqual([
        expect.objectContaining({
          id: confirmed.id,
          itemId: physical.id,
          reviewerId: confirmed.reviewerId,
          text: confirmed.text,
          createdAt: confirmed.createdAt,
          riskId: null,
          decisionId: null,
        }),
      ]);
      previousId = physical.id;
    }
  });

  it("re-resolves the original lineage when canonical save commits after initial lookup", async () => {
    const item = await seedItem();
    const draft = await model();
    const outcome = await replyAfterCompetingCommit(item.id, () =>
      sections.saveSection(draft, draft.version),
    );
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") throw outcome.error;
    const physical = expectDefined((await model()).items[0]);
    expect(physical.id).not.toBe(item.id);
    expect(await liveRows()).toEqual([
      expect.objectContaining({
        id: outcome.value.id,
        itemId: physical.id,
        reviewerId: data.lead.id,
        createdAt: outcome.value.createdAt,
        text: "Interleaved reply",
      }),
    ]);
  });

  it("rejects an old physical ID when save completed before initial lookup", async () => {
    const item = await seedItem();
    const draft = await model();
    await sections.saveSection(draft, draft.version);
    await expectDenied(item.id);
  });

  it("rejects a lineage removed after lookup without following it into another section", async () => {
    const item = await seedItem();
    const otherSection = await prisma.reportSection.create({
      data: { reportId: data.report.id, authorId: data.head.id },
    });
    await prisma.item.create({
      data: {
        reportSectionId: otherSection.id,
        stableId: STABLE_ID,
        projectId: data.project.id,
        type: "current",
        text: "Foreign same-lineage decoy",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["dev"],
      },
    });
    const draft = await model();
    const outcome = await replyAfterCompetingCommit(item.id, () =>
      sections.saveSection({ ...draft, items: [] }, draft.version),
    );
    expect(outcome).toMatchObject({
      kind: "error",
      error: { constructor: ReviewNotFoundError, message: "Record not found." },
    });
    expect(await liveRows()).toEqual([]);
  });

  it("deletes discussion with an intentionally removed item and never resurrects it", async () => {
    const item = await seedItem();
    const confirmed = await reply(item.id);
    const draft = await model();
    const empty = await sections.saveSection(
      { ...draft, items: [] },
      draft.version,
    );
    await sections.saveSection(empty, empty.version);
    expect(await liveRows()).toEqual([]);
    expect(
      await prisma.recordComment.findUnique({ where: { id: confirmed.id } }),
    ).toBeNull();
  });

  it("keeps distinct same-text messages ordered by timestamp then stable ID across saves and reviewer deletion", async () => {
    const item = await seedItem();
    const first = await reply(item.id, "Identical text");
    const second = await reply(item.id, "Identical text");
    const third = await reply(item.id, "Earlier timestamp");
    await prisma.recordComment.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { createdAt: EQUAL_TIME },
    });
    await prisma.recordComment.update({
      where: { id: third.id },
      data: { createdAt: new Date(EQUAL_TIME.getTime() - 1000) },
    });
    const expectedIds = [third.id, ...[first.id, second.id].sort()];
    for (const pass of [1, 2]) {
      const draft = await model();
      expect(draft.version).toBe(pass);
      const saved = await sections.saveSection(draft, draft.version);
      expect(
        expectDefined(expectDefined(saved.items[0]).comments).map((c) => c.id),
      ).toEqual(expectedIds);
      const reread = await model();
      expect(
        expectDefined(expectDefined(reread.items[0]).comments).map((c) => c.id),
      ).toEqual(expectedIds);
      expect((await liveRows()).map((c) => c.id)).toEqual(expectedIds);
      for (const row of await liveRows()) {
        expect(row.reviewerId).toBe(data.lead.id);
        expect(row.createdAt).toEqual(
          row.id === third.id
            ? new Date(EQUAL_TIME.getTime() - 1000)
            : EQUAL_TIME,
        );
        expect(row.text).toBe(
          row.id === third.id ? "Earlier timestamp" : "Identical text",
        );
      }
    }
    const staleDraft = await model();
    await repo.deleteComment(first.id, {
      userId: data.head.id,
      role: "head",
      reportingGroupId: expectDefined(data.head.reportingGroupId),
    });
    await sections.saveSection(staleDraft, staleDraft.version);
    expect((await liveRows()).map((c) => c.id)).toEqual(
      expectedIds.filter((id) => id !== first.id),
    );
  });

  it("denies a foreign same-group item and a nonexistent item uniformly", async () => {
    const item = await seedItem();
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { authorId: data.head.id },
    });
    await expectDenied(item.id);
    await expectDenied("83600000-0000-4000-8000-000000000099");
  });

  it.each([
    ["demoted", { role: "viewer" }],
    ["inactive", { isActive: false }],
  ] as const)(
    "rechecks the %s actor after initial lookup",
    async (_label, change) => {
      const item = await seedItem();
      const outcome = await replyAfterCompetingCommit(item.id, () =>
        prisma.user.update({ where: { id: data.lead.id }, data: change }),
      );
      expect(outcome).toMatchObject({
        kind: "error",
        error: {
          constructor: ReviewNotFoundError,
          message: "Record not found.",
        },
      });
      expect(await liveRows()).toEqual([]);
    },
  );

  it("rechecks section ownership after initial lookup", async () => {
    const item = await seedItem();
    const outcome = await replyAfterCompetingCommit(item.id, () =>
      prisma.reportSection.update({
        where: { id: data.section.id },
        data: { authorId: data.head.id },
      }),
    );
    expect(outcome).toMatchObject({
      kind: "error",
      error: { constructor: ReviewNotFoundError, message: "Record not found." },
    });
    expect(await liveRows()).toEqual([]);
  });

  it.each([
    ["scheduled", { periodState: "scheduled" }],
    ["archived", { archived: true, periodState: "archived" }],
  ] as const)("denies an own %s report", async (_label, lifecycle) => {
    const item = await seedItem();
    await prisma.report.update({
      where: { id: data.report.id },
      data: lifecycle,
    });
    await expectDenied(item.id);
  });

  it("rejects frozen lifecycle after lookup, then allows reopened live reply without changing stored snapshot bytes", async () => {
    const item = await seedItem();
    const publishedAt = new Date("2026-04-13T12:00:00.000Z");
    const outcome = await replyAfterCompetingCommit(item.id, () =>
      prisma.report.update({
        where: { id: data.report.id },
        data: {
          status: "published",
          periodState: "published",
          periodStatus: "published",
          publishedAt,
          publishedById: data.head.id,
          publishedSnapshot: publishedSnapshotFixture({
            reportId: data.report.id,
            periodStart: data.report.periodStart,
            periodEnd: data.report.periodEnd,
            publishedAt,
            publishedById: data.head.id,
          }),
        },
      }),
    );
    expect(outcome).toMatchObject({
      kind: "error",
      error: { constructor: ReviewNotFoundError, message: "Record not found." },
    });
    expect(await liveRows()).toEqual([]);
    const snapshotBytes = () =>
      prisma.$queryRaw<{ bytes: string }[]>`
        SELECT "publishedSnapshot"::text AS bytes FROM "Report"
        WHERE "id" = ${data.report.id}`;
    const frozen = await snapshotBytes();
    expect(expectDefined(frozen[0]).bytes).toContain(data.report.id);
    await prisma.report.update({
      where: { id: data.report.id },
      data: {
        periodStatus: "reopened",
        periodState: "open",
        reopenedAt: new Date("2026-04-14T12:00:00.000Z"),
      },
    });
    const confirmed = await reply(item.id, "Live reopened reply");
    expect(await liveRows()).toEqual([
      expect.objectContaining({ id: confirmed.id, itemId: item.id }),
    ]);
    expect(await snapshotBytes()).toEqual(frozen);
    const draft = await model();
    await sections.saveSection(draft, draft.version);
    expect(await snapshotBytes()).toEqual(frozen);
  });
});
