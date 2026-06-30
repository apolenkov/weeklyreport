import type { AssembledReport } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PublicationPrismaRepository } from "./publication.prisma-repository";

// The snapshot helpers need a full Prisma row to build/serialize; stub them so
// these tests can focus on the compare-and-set write guard with bare mocks.
// vi.mock is hoisted above the imports, so the factory uses inline vi.fn().
vi.mock("../published-report-snapshot", () => ({
  reportFullIncludeForSnapshot: {},
  toPublishedSnapshotJson: vi.fn(() => ({ snapshot: true })),
  buildAssembledReportFromPrismaRow: vi.fn(() => ({
    reportId: "rep-1",
    status: "published",
  })),
}));

const asAny = <T>(x: unknown): T => x as T;

// Minimal published report — only reportId/publishedAt/publishedById are read
// (by publishLifecycle); the snapshot helpers are mocked, so the rest of the
// AssembledReport shape is irrelevant to the compare-and-set under test.
const autoReport = asAny<AssembledReport>({
  reportId: "rep-1",
  status: "published",
  publishedAt: new Date("2026-05-01T00:00:00.000Z"),
  publishedById: null,
});

describe("PublicationPrismaRepository.saveAutoPublishedReport", () => {
  it("guards the write on status=draft AND archived=false (compare-and-set)", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: "rep-1" });
    const repo = new PublicationPrismaRepository(
      asAny({ report: { updateMany, findUnique } }),
    );

    await repo.saveAutoPublishedReport(autoReport);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() returns any; vitest asymmetric matcher has no precise type
        where: expect.objectContaining({
          id: "rep-1",
          status: "draft",
          archived: false,
        }),
      }),
    );
  });

  it("zero-row match → { published: false } and does NOT re-read the row", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn();
    const repo = new PublicationPrismaRepository(
      asAny({ report: { updateMany, findUnique } }),
    );

    const result = await repo.saveAutoPublishedReport(autoReport);

    expect(result).toEqual({ published: false });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("matched row → { published: true } carrying the re-read report", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: "rep-1" });
    const repo = new PublicationPrismaRepository(
      asAny({ report: { updateMany, findUnique } }),
    );

    const result = await repo.saveAutoPublishedReport(autoReport);

    expect(result).toEqual({
      published: true,
      report: { reportId: "rep-1", status: "published" },
    });
    expect(findUnique).toHaveBeenCalledOnce();
  });
});
