import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository.js";

function createRepository() {
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  const prisma = {
    report: { findMany, findFirst },
  } as unknown as PrismaService;

  return {
    repository: new ArchivePrismaRepository(prisma),
    findMany,
    findFirst,
  };
}

describe("ArchivePrismaRepository published floor", () => {
  it("requests latest-published reports first regardless of insertion order", async () => {
    const { repository, findMany } = createRepository();

    await repository.listArchiveReports();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("keeps the published floor when a list filter requests drafts", async () => {
    const { repository, findMany } = createRepository();

    await repository.listArchiveReports(undefined, { status: "draft" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "published", archived: true },
      }),
    );
  });

  it("keeps the published floor when a detail filter requests drafts", async () => {
    const { repository, findFirst } = createRepository();
    const reportId = "6f68a008-9914-48ac-8f96-26e3ca3ab5e2";

    await repository.getArchiveReport(reportId, { status: "draft" });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: reportId,
          status: "published",
          archived: true,
        },
      }),
    );
  });
});
