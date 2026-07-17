import type { AssembledReport } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PublicationPrismaRepository } from "./publication.prisma-repository";

// The snapshot helpers need a full Prisma row to build/serialize; stub them so
// these tests can focus on the compare-and-set write guard with bare mocks.
// vi.mock is hoisted above the imports, so the factory uses inline vi.fn().
vi.mock("../../published-report-snapshot", () => ({
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

// The auto-publish runs inside `$transaction`, so the fake threads a single `tx`
// report delegate (updateMany + the snapshot re-read/write) through the callback.
function makeRepo(tx: {
  updateMany: ReturnType<typeof vi.fn>;
  findUniqueOrThrow: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}) {
  return new PublicationPrismaRepository(
    asAny({
      $transaction: (fn: (client: unknown) => unknown) => fn({ report: tx }),
    }),
  );
}

describe("PublicationPrismaRepository.saveAutoPublishedReport", () => {
  it("guards the write on status=draft AND archived=false (compare-and-set)", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "rep-1" });
    const update = vi.fn().mockResolvedValue({ id: "rep-1" });
    const repo = makeRepo({ updateMany, findUniqueOrThrow, update });

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
    // The snapshot rides a SECOND statement (in-transaction re-read), never the
    // guarded updateMany — so its bytes reflect the latest committed state.
    expect(update).toHaveBeenCalledOnce();
  });

  it("zero-row match → { published: false } and does NOT re-read the row", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUniqueOrThrow = vi.fn();
    const update = vi.fn();
    const repo = makeRepo({ updateMany, findUniqueOrThrow, update });

    const result = await repo.saveAutoPublishedReport(autoReport);

    expect(result).toEqual({ published: false });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("matched row → { published: true } carrying the fresh in-transaction re-read", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "rep-1" });
    const update = vi.fn().mockResolvedValue({ id: "rep-1" });
    const repo = makeRepo({ updateMany, findUniqueOrThrow, update });

    const result = await repo.saveAutoPublishedReport(autoReport);

    expect(result).toEqual({
      published: true,
      wasAlreadyPublished: false,
      report: { reportId: "rep-1", status: "published" },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledOnce();
    // The snapshot is frozen as a second in-transaction statement.
    expect(update).toHaveBeenCalledOnce();
  });
});
