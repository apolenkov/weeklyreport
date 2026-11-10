// Reviewer comments on an unfinished risk, decided from the stored record
// under the real User → Report locks (openspec: lead-incomplete-record-drafts,
// task 3R.1). The mocked-transaction counterpart is
// `review-actions.incomplete-anchor.test.ts`.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  observeTransaction,
  waitForCommitPause,
  waitForTransactionBlock,
} from "../../../test-utils/observed-transaction.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { ReportSectionsPrismaRepository } from "../../report-sections/test-seams/index.js";
import { ReviewNotFoundError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

describe("review comments on an unfinished risk (PostgreSQL integration)", () => {
  const prisma = createTestPrisma();
  const repo = new ReviewActionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let riskId = "";

  const head = () => ({
    userId: data.head.id,
    role: "head" as const,
    reportingGroupId: data.head.reportingGroupId ?? undefined,
  });
  const comments = () =>
    prisma.recordComment.findMany({
      select: { id: true, reviewerId: true, riskId: true, createdAt: true },
    });
  const setDetails = (impact: string | null, mitigation: string | null) =>
    prisma.risk.update({ where: { id: riskId }, data: { impact, mitigation } });

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    const risk = await prisma.risk.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        risk: "Vendor may slip",
        impact: null,
        mitigation: null,
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
    riskId = risk.id;
  });

  it("refuses a Head's comment while the risk is unfinished and accepts it once finished", async () => {
    await expect(
      repo.insertComment(head(), { riskId }, "What is the impact?"),
    ).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Record not found.",
    });
    expect(await comments()).toEqual([]);

    await setDetails("Date slips", "Second vendor");

    const created = await repo.insertComment(head(), { riskId }, "Noted");
    expect(await comments()).toMatchObject([
      { id: created.id, reviewerId: data.head.id, riskId },
    ]);
  });

  it("keeps a reviewer's comment while the risk is unfinished again, unchanged", async () => {
    await setDetails("Date slips", "Second vendor");
    const created = await repo.insertComment(head(), { riskId }, "Noted");
    const before = await comments();

    // The author clears a detail: the risk is their private draft again.
    await setDetails(null, "Second vendor");
    await expect(repo.deleteComment(created.id, head())).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Comment not found.",
    });
    expect(await comments()).toEqual(before);

    // Finished again: the same comment, and its writer may delete it.
    await setDetails("Date slips", "Second vendor");
    await expect(
      repo.deleteComment(created.id, head()),
    ).resolves.toBeUndefined();
    expect(await comments()).toEqual([]);
  });
});

// Both orders use the actual save/review transactions. The first is paused
// before COMMIT; pg_blocking_pids proves the second really waits on its lock.
describe.each([
  { kind: "risk" as const, role: "head" as const },
  { kind: "decision" as const, role: "head" as const },
  { kind: "risk" as const, role: "admin" as const },
  { kind: "decision" as const, role: "admin" as const },
])("incomplete $kind versus $role comment interleavings", ({ kind, role }) => {
  const prisma = createTestPrisma();
  const repo = new ReviewActionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const sections = new ReportSectionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let record: { id: string; stableId: string };

  const actor = () => ({
    userId: data.head.id,
    role,
    reportingGroupId: data.head.reportingGroupId ?? undefined,
  });
  const anchor = (id = record.id) =>
    kind === "risk" ? { riskId: id } : { decisionId: id };
  const comments = () =>
    prisma.recordComment.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        reviewerId: true,
        text: true,
        createdAt: true,
        itemId: true,
        riskId: true,
        decisionId: true,
      },
    });
  const currentRecord = () =>
    kind === "risk"
      ? prisma.risk.findUniqueOrThrow({
          where: {
            reportSectionId_stableId: {
              reportSectionId: data.section.id,
              stableId: record.stableId,
            },
          },
        })
      : prisma.decision.findUniqueOrThrow({
          where: {
            reportSectionId_stableId: {
              reportSectionId: data.section.id,
              stableId: record.stableId,
            },
          },
        });

  async function unfinishedSection() {
    const section = expectDefined(
      await sections.getSectionById(data.section.id, "author"),
    );
    return {
      ...section,
      risks: section.risks.map((risk) => ({ ...risk, impact: null })),
      decisions: section.decisions.map((decision) => ({
        ...decision,
        impact: null,
      })),
    };
  }

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    await prisma.user.update({ where: { id: data.head.id }, data: { role } });
    const common = {
      reportSectionId: data.section.id,
      impact: "Date slips",
      stageNames: ["Development"],
    };
    record =
      kind === "risk"
        ? await prisma.risk.create({
            data: {
              ...common,
              projectId: data.project.id,
              risk: "Vendor may slip",
              mitigation: "Second vendor",
              severity: "at-risk",
            },
          })
        : await prisma.decision.create({
            data: {
              ...common,
              productId: data.project.id,
              text: "Choose vendor",
              owner: "Lead",
            },
          });
  });

  it.each(["create", "delete"] as const)(
    "save-first: refuses %s on the now-private anchor",
    async (operation) => {
      const existing = await repo.insertComment(
        actor(),
        anchor(),
        "Keep exact context",
      );
      const before = await comments();
      const first = observeTransaction(prisma, true);
      const second = observeTransaction(prisma);
      const saving = new ReportSectionsPrismaRepository(
        first.client as unknown as PrismaService,
      ).saveSection(await unfinishedSection(), 1);
      const reviewing = new ReviewActionsPrismaRepository(
        second.client as unknown as PrismaService,
      );
      const pending: Promise<unknown>[] = [saving];
      try {
        await waitForCommitPause(first, saving);
        const writing =
          operation === "create"
            ? reviewing.insertComment(actor(), anchor(), "Must not appear")
            : reviewing.deleteComment(existing.id, actor());
        const rejection = expect(writing).rejects.toMatchObject({
          constructor: ReviewNotFoundError,
          message:
            operation === "create" ? "Record not found." : "Comment not found.",
        });
        pending.push(rejection);
        await waitForTransactionBlock(prisma, first.backend, second.backend);
        first.gate.release();
        await saving;
        await rejection;
        const saved = await currentRecord();
        expect(saved.id).not.toBe(record.id);
        expect(saved.impact).toBeNull();
        expect(await comments()).toEqual(
          before.map((comment) => ({ ...comment, ...anchor(saved.id) })),
        );
        // Re-completion restores the normal permissions on the new physical row.
        if (kind === "risk")
          await prisma.risk.update({
            where: { id: saved.id },
            data: { impact: "Restored" },
          });
        else
          await prisma.decision.update({
            where: { id: saved.id },
            data: { impact: "Restored" },
          });
        await expect(
          repo.deleteComment(existing.id, actor()),
        ).resolves.toBeUndefined();
        await repo.insertComment(actor(), anchor(saved.id), "Allowed again");
        expect(await comments()).toHaveLength(1);
      } finally {
        first.gate.release();
        await Promise.allSettled(pending);
      }
    },
  );

  it.each(["create", "delete"] as const)(
    "comment-first: preserves committed %s through replacement",
    async (operation) => {
      const existing = await repo.insertComment(
        actor(),
        anchor(),
        "Existing context",
      );
      const first = observeTransaction(prisma, true);
      const second = observeTransaction(prisma);
      const reviewing = new ReviewActionsPrismaRepository(
        first.client as unknown as PrismaService,
      );
      const writing =
        operation === "create"
          ? reviewing.insertComment(actor(), anchor(), "Comment wins")
          : reviewing.deleteComment(existing.id, actor());
      const pending: Promise<unknown>[] = [writing];
      try {
        await waitForCommitPause(first, writing);
        const section = await unfinishedSection();
        const saving = new ReportSectionsPrismaRepository(
          second.client as unknown as PrismaService,
        ).saveSection(section, 1);
        pending.push(saving);
        await waitForTransactionBlock(prisma, first.backend, second.backend);
        first.gate.release();
        const written = await writing;
        await saving;
        const saved = await currentRecord();
        expect(saved.impact).toBeNull();
        const stored = await comments();
        if (operation === "create") {
          expect(stored).toHaveLength(2);
          if (!written) throw new Error("Comment creation returned no comment");
          const created = written;
          expect(
            stored.find((comment) => comment.id === created.id),
          ).toMatchObject({
            id: created.id,
            reviewerId: created.reviewerId,
            text: created.text,
            createdAt: created.createdAt,
            ...anchor(saved.id),
          });
          await expect(
            repo.deleteComment(created.id, actor()),
          ).rejects.toMatchObject({ message: "Comment not found." });
        } else {
          expect(stored).toEqual([]);
        }
        expect(
          (await sections.getSectionById(data.section.id, "author"))?.version,
        ).toBe(2);
      } finally {
        first.gate.release();
        await Promise.allSettled(pending);
      }
    },
  );
});

afterAll(async () => {
  try {
    await cleanDatabase();
  } finally {
    await disconnectTestPrisma();
  }
});
