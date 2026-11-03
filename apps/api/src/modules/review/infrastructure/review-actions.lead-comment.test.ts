import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

const actor = { userId: "lead", role: "lead" } as const;
const draft = {
  id: "report",
  status: "draft",
  periodStatus: "open",
  periodState: "open",
  archived: false,
  autoArchived: false,
  autoPublished: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

function fixture() {
  const events: string[] = [];
  const lineage = {
    stableId: "stable",
    reportSectionId: "section",
    reportSection: { reportId: "report", authorId: "lead" },
  };
  const item = vi
    .fn()
    .mockResolvedValueOnce(lineage)
    .mockResolvedValue({ id: "reminted" });
  const user = vi.fn().mockResolvedValue({ isActive: true, role: "lead" });
  const section = vi.fn().mockResolvedValue({ authorId: "lead" });
  const query = vi.fn((sql: TemplateStringsArray): Promise<unknown[]> => {
    const isUser = sql.join("").includes('FROM "User"');
    events.push(isUser ? "user-lock" : "report-lock");
    return Promise.resolve(isUser ? [{ id: "lead" }] : [draft]);
  });
  const create = vi.fn(
    ({ data }: { data: { reviewerId: string; text: string } }) => {
      events.push("insert");
      return Promise.resolve({
        ...data,
        id: "comment",
        createdAt: new Date("2026-01-01"),
        reviewer: { name: "Lead" },
      });
    },
  );
  const tx = {
    $queryRaw: query,
    item: { findUnique: item },
    user: { findUnique: user },
    reportSection: { findFirst: section },
    recordComment: { create },
  };
  const transaction = vi.fn(
    async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) => {
      try {
        const result = await fn(tx as unknown as Prisma.TransactionClient);
        events.push("commit");
        return result;
      } catch (error) {
        events.push("rollback");
        throw error;
      }
    },
  );
  const repo = new ReviewActionsPrismaRepository({
    $transaction: transaction,
  } as unknown as PrismaService);
  return { repo, item, user, section, query, create, events, lineage };
}

describe("Lead item comment transaction", () => {
  it("writes the session actor on the same-section reminted item after User then Report locks", async () => {
    const f = fixture();
    await expect(
      f.repo.insertLeadItemComment(actor, "old-item", "reply"),
    ).resolves.toMatchObject({
      reviewerId: "lead",
      text: "reply",
      reviewerName: "Lead",
    });
    expect(f.events).toEqual(["user-lock", "report-lock", "insert", "commit"]);
    expect(f.item).toHaveBeenLastCalledWith({
      where: {
        reportSectionId_stableId: {
          reportSectionId: "section",
          stableId: "stable",
        },
      },
      select: { id: true },
    });
    expect(f.section).toHaveBeenCalledWith({
      where: { id: "section", reportId: "report" },
      select: { authorId: true },
    });
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reviewerId: "lead",
          text: "reply",
          itemId: "reminted",
          riskId: null,
          decisionId: null,
        },
      }),
    );
  });

  it.each([
    "missing",
    "foreign",
    "changed-owner",
    "deleted-section",
    "deleted-lineage",
    "inactive",
    "demoted",
    "missing-user",
    "missing-lock-user",
    "missing-report",
  ])(
    "denies %s with the same non-oracular result and no insert",
    async (reason) => {
      const f = fixture();
      if (reason === "missing") f.item.mockReset().mockResolvedValue(null);
      if (reason === "foreign") {
        f.item.mockReset().mockResolvedValueOnce({
          ...f.lineage,
          reportSection: { reportId: "report", authorId: "peer" },
        });
        f.section.mockResolvedValue({ authorId: "peer" });
      }
      if (reason === "changed-owner")
        f.section.mockResolvedValue({ authorId: "peer" });
      if (reason === "deleted-section") f.section.mockResolvedValue(null);
      if (reason === "deleted-lineage")
        f.item
          .mockReset()
          .mockResolvedValueOnce(f.lineage)
          .mockResolvedValue(null);
      if (reason === "inactive")
        f.user.mockResolvedValue({ isActive: false, role: "lead" });
      if (reason === "demoted")
        f.user.mockResolvedValue({ isActive: true, role: "admin" });
      if (reason === "missing-user") f.user.mockResolvedValue(null);
      if (reason === "missing-lock-user") f.query.mockResolvedValue([]);
      if (reason === "missing-report")
        f.query.mockResolvedValueOnce([{ id: "lead" }]).mockResolvedValue([]);
      await expect(
        f.repo.insertLeadItemComment(actor, "old-item", "reply"),
      ).rejects.toMatchObject({
        name: "ReviewNotFoundError",
        message: "Record not found.",
      });
      expect(f.create).not.toHaveBeenCalled();
      expect(f.events.at(-1)).toBe("rollback");
    },
  );

  it.each([
    { ...draft, archived: true, periodState: "archived" },
    { ...draft, periodState: "scheduled" },
    { ...draft, periodStatus: "closed" },
    {
      ...draft,
      status: "published",
      periodStatus: "published",
      periodState: "published",
      publishedAt: new Date(),
      publishedById: "00000000-0000-4000-8000-000000000001",
    },
    { ...draft, autoArchived: true },
  ])("denies ineligible/inconsistent lifecycle %#", async (report) => {
    const f = fixture();
    f.query.mockResolvedValueOnce([{ id: "lead" }]).mockResolvedValue([report]);
    await expect(
      f.repo.insertLeadItemComment(actor, "item", "reply"),
    ).rejects.toMatchObject({ message: "Record not found." });
    expect(f.create).not.toHaveBeenCalled();
  });

  it("allows reopened live discussion without writing a snapshot", async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([{ id: "lead" }]).mockResolvedValue([
      {
        ...draft,
        status: "published",
        periodStatus: "reopened",
        publishedAt: new Date(),
        publishedById: "00000000-0000-4000-8000-000000000001",
        reopenedAt: new Date(),
      },
    ]);
    await expect(
      f.repo.insertLeadItemComment(actor, "item", "reply"),
    ).resolves.toMatchObject({ text: "reply" });
    expect(f.events.at(-1)).toBe("commit");
  });

  it("re-reads role only after both locks, rejecting a revocation at the lock boundary", async () => {
    const f = fixture();
    f.query.mockImplementation((sql: TemplateStringsArray) => {
      if (sql.join("").includes('FROM "User"'))
        return Promise.resolve([{ id: "lead" }]);
      expect(f.user).not.toHaveBeenCalled();
      f.user.mockResolvedValue({ isActive: true, role: "viewer" });
      return Promise.resolve([draft]);
    });
    await expect(
      f.repo.insertLeadItemComment(actor, "item", "reply"),
    ).rejects.toMatchObject({ message: "Record not found." });
    expect(f.create).not.toHaveBeenCalled();
  });

  it("maps only the item FK failure to generic denial", async () => {
    const f = fixture();
    f.create.mockRejectedValue({
      code: "P2003",
      meta: { field_name: "RecordComment_itemId_fkey" },
    });
    await expect(
      f.repo.insertLeadItemComment(actor, "item", "reply"),
    ).rejects.toMatchObject({
      name: "ReviewNotFoundError",
      message: "Record not found.",
    });
    expect(f.events.at(-1)).toBe("rollback");
  });

  it("does not disguise unrelated foreign-key failures as a missing item", async () => {
    const f = fixture();
    const error = {
      code: "P2003",
      meta: { field_name: "RecordComment_reviewerId_fkey" },
    };
    f.create.mockRejectedValue(error);
    await expect(
      f.repo.insertLeadItemComment(actor, "item", "reply"),
    ).rejects.toBe(error);
    expect(f.events.at(-1)).toBe("rollback");
  });

  it("propagates insert failure and does not return a successful transaction", async () => {
    const f = fixture();
    f.create.mockRejectedValue(new Error("storage unavailable"));
    await expect(
      f.repo.insertLeadItemComment(actor, "item", "reply"),
    ).rejects.toThrow("storage unavailable");
    expect(f.events.at(-1)).toBe("rollback");
    expect(f.events).not.toContain("commit");
  });
});
