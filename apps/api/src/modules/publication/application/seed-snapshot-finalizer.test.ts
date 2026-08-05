import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  toJson: vi.fn(),
}));

vi.mock("../../published-report-snapshot.js", () => ({
  reportFullIncludeForSnapshot: {
    sections: {
      orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
    },
  },
  buildAssembledReportFromPrismaRow: mocks.build,
  toPublishedSnapshotJson: mocks.toJson,
}));

import type { SeedSnapshotDatabase } from "./seed-snapshot-finalizer.js";
import {
  finalizeSeededSnapshot,
  finalizeSeededSnapshots,
} from "./seed-snapshot-finalizer.js";

const assembled = {
  reportId: "report-1",
  sections: [
    { reportSectionId: "section-a" },
    { reportSectionId: "section-b" },
  ],
} as never;

beforeEach(() => {
  mocks.build.mockReset().mockReturnValue(assembled);
  mocks.toJson.mockReset().mockReturnValue({ stored: true });
});

type FindUniqueInput = Readonly<{
  where: Readonly<{ id: string }>;
  select?: unknown;
  include?: unknown;
}>;

type UpdateInput = Readonly<{
  where: Readonly<{ id: string }>;
  data: unknown;
}>;

type DatabaseHarness = SeedSnapshotDatabase &
  Readonly<{
    findUnique: Mock<(input: FindUniqueInput) => Promise<unknown>>;
    findMany: Mock<() => Promise<readonly Readonly<{ id: string }>[]>>;
    update: Mock<(input: UpdateInput) => Promise<unknown>>;
  }>;

function database(
  input: {
    status?: "published" | "open";
    row?: unknown;
  } = {},
): DatabaseHarness {
  const findUnique = vi.fn<(input: FindUniqueInput) => Promise<unknown>>();
  const findMany = vi.fn<() => Promise<readonly Readonly<{ id: string }>[]>>();
  const update = vi.fn<(input: UpdateInput) => Promise<unknown>>();
  update.mockResolvedValue({});
  findUnique
    .mockResolvedValueOnce({
      id: "report-1",
      periodStatus: input.status ?? "published",
    })
    .mockResolvedValue(input.row ?? { sections: [] });
  findMany.mockResolvedValue([{ id: "report-1" }]);
  return {
    report: { findUnique, findMany, update } as never,
    findUnique,
    findMany,
    update,
  };
}

describe("seed snapshot finalizer", () => {
  it("freezes the assembled sections in the canonical include order", async () => {
    const db = database();

    await finalizeSeededSnapshot(db, "report-1");

    expect(db.findUnique.mock.calls[1]?.[0]).toMatchObject({
      where: { id: "report-1" },
      include: {
        sections: {
          orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
        },
      },
    });
    expect(db.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "report-1" },
    });
    expect(db.update.mock.calls[0]?.[0]?.data).toHaveProperty(
      "publishedSnapshot",
    );
  });

  it("finalizes discovered published reports in stable order", async () => {
    const db = database();
    db.findMany.mockResolvedValue([{ id: "report-b" }, { id: "report-a" }]);
    db.findUnique.mockReset();
    db.findUnique.mockImplementation(({ where }): Promise<unknown> =>
      Promise.resolve(
        where.id === "report-a" || where.id === "report-b"
          ? { id: where.id, periodStatus: "published" }
          : { sections: [] },
      ),
    );
    const updatedIds: string[] = [];
    db.update.mockImplementation(({ where }): Promise<unknown> => {
      updatedIds.push(where.id);
      return Promise.resolve({});
    });

    await finalizeSeededSnapshots(db);

    expect(updatedIds).toEqual(["report-a", "report-b"]);
  });

  it("rejects an unknown or non-published target without a write", async () => {
    const unknown = database();
    unknown.findUnique.mockReset();
    unknown.findUnique.mockResolvedValue(null);
    await expect(finalizeSeededSnapshot(unknown, "missing")).rejects.toThrow(
      "unknown report missing",
    );
    expect(unknown.update).not.toHaveBeenCalled();

    const open = database({ status: "open" });
    await expect(finalizeSeededSnapshot(open, "report-1")).rejects.toThrow(
      "non-published report report-1",
    );
    expect(open.update).not.toHaveBeenCalled();
  });

  it("does not expose publication side effects", async () => {
    const db = database();

    await finalizeSeededSnapshot(db, "report-1");

    expect(db.report).toEqual(
      expect.objectContaining({ findUnique: db.findUnique, update: db.update }),
    );
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});
