import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository.js";
import type { ArchiveScopeSession } from "./archive.service.js";

const adminSession: ArchiveScopeSession = {
  role: "admin",
  viewerGroupAccess: [],
};

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
  it("bounds the default first page and orders latest-published reports first", async () => {
    const { repository, findMany } = createRepository();

    await repository.listArchiveReports(undefined, undefined, adminSession);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: 21,
      }),
    );
  });

  it("keeps the published floor when a list filter requests drafts", async () => {
    const { repository, findMany } = createRepository();

    await repository.listArchiveReports(
      undefined,
      { status: "draft" },
      adminSession,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "published", archived: true },
      }),
    );
  });

  it("keeps the published floor when a detail filter requests drafts", async () => {
    const { repository, findFirst } = createRepository();
    const reportId = "6f68a008-9914-48ac-8f96-26e3ca3ab5e2";

    await repository.getArchiveReport(
      reportId,
      { status: "draft" },
      adminSession,
    );

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
