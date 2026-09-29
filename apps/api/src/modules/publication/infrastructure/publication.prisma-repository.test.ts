import type { AssembledReport } from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freezePublishedSnapshot } from "../../search/index.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository";

// The snapshot helpers need a full Prisma row to build/serialize; stub them so
// these tests can focus on the compare-and-set write guard with bare mocks.
// vi.mock is hoisted above the imports, so the factory uses inline vi.fn().
vi.mock("../../report-sections/index.js", () => ({
  reportFullIncludeForSnapshot: {},
  toPublishedSnapshotJson: vi.fn(() => ({ snapshot: true })),
  buildAssembledReportFromPrismaRow: vi.fn(() => ({
    reportId: "rep-1",
    status: "published",
  })),
}));
// The freeze sequence is unit-tested in search; here it only returns the frozen graph.
vi.mock("../../search/index.js", () => ({
  freezePublishedSnapshot: vi
    .fn()
    .mockResolvedValue({ reportId: "rep-1", status: "published" }),
}));

const asAny = (value: unknown): never => value as never;

// Partial report supplies the lifecycle and deadline inputs; graph assembly
// and serialization are mocked for these repository orchestration tests.
const autoReport: AssembledReport = asAny({
  reportId: "rep-1",
  deadline: new Date("2026-05-01T00:00:00.000Z"),
  status: "published",
  publishedAt: new Date("2026-05-01T00:00:00.000Z"),
  publishedById: null,
});

// The auto-publish runs inside `$transaction`, so the fake threads a single `tx`
// report delegate (updateMany + the snapshot re-read/write) through the callback.
function makeRepo(
  tx: {
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  },
  pauseRules = vi.fn().mockResolvedValue({ count: 1 }),
  onTransactionOptions: (options: unknown) => undefined = () => undefined,
) {
  const reminderRule = { updateMany: pauseRules };
  return new PublicationPrismaRepository(
    asAny({
      $transaction: (fn: (client: unknown) => unknown, options: unknown) => {
        onTransactionOptions(options);
        return fn({
          $queryRaw: vi.fn().mockResolvedValue([]),
          report: tx,
          reminderRule,
        });
      },
    }),
  );
}

describe("PublicationPrismaRepository.saveAutoPublishedReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guards the write on the exact editable lifecycle and expected deadline", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: "rep-1" });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "rep-1" });
    const update = vi.fn().mockResolvedValue({ id: "rep-1" });
    const repo = makeRepo({
      updateMany,
      findUnique,
      findUniqueOrThrow,
      update,
    });

    await repo.saveAutoPublishedReport(autoReport);

    expect(updateMany.mock.calls).toMatchObject([
      [
        {
          where: {
            id: "rep-1",
            status: "draft",
            archived: false,
            periodState: "open",
            periodStatus: "open",
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
            deadline: new Date("2026-05-01T00:00:00.000Z"),
          },
        },
      ],
    ]);
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      data: { publishedSnapshot: { snapshot: true } },
    });
    expect(vi.mocked(freezePublishedSnapshot)).toHaveBeenCalledOnce();
    expect(vi.mocked(freezePublishedSnapshot).mock.calls[0]?.[1]).toBe("rep-1");
  });

  it("uses one repeatable-read transaction for the fresh graph and publish CAS", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: "rep-1" });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "rep-1" });
    const update = vi.fn().mockResolvedValue({ id: "rep-1" });
    let options: unknown;
    const repo = makeRepo(
      { updateMany, findUnique, findUniqueOrThrow, update },
      undefined,
      (value) => {
        options = value;
      },
    );

    await repo.saveAutoPublishedReport(autoReport);

    expect(options).toEqual({ isolationLevel: "RepeatableRead" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "rep-1" },
      include: {},
    });
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it("returns unpublished after a zero-row match without freezing the snapshot", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue({ id: "rep-1" });
    const findUniqueOrThrow = vi.fn();
    const update = vi.fn();
    const repo = makeRepo({
      updateMany,
      findUnique,
      findUniqueOrThrow,
      update,
    });

    const result = await repo.saveAutoPublishedReport(autoReport);

    expect(result).toEqual({ published: false });
    expect(updateMany).toHaveBeenCalledOnce();
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(freezePublishedSnapshot).not.toHaveBeenCalled();
  });

  it("matched row → { published: true } carrying the fresh in-transaction re-read", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: "rep-1" });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "rep-1" });
    const update = vi.fn().mockResolvedValue({ id: "rep-1" });
    const pauseRules = vi.fn().mockResolvedValue({ count: 1 });
    const repo = makeRepo(
      { updateMany, findUnique, findUniqueOrThrow, update },
      pauseRules,
    );

    const result = await repo.saveAutoPublishedReport(autoReport);

    expect(result).toEqual({
      published: true,
      wasAlreadyPublished: false,
      report: { reportId: "rep-1", status: "published" },
    });
    expect(freezePublishedSnapshot).toHaveBeenCalledOnce();
    expect(pauseRules).toHaveBeenCalledWith({
      where: { reportId: "rep-1", status: "active" },
      data: { status: "paused" },
    });
  });
});
