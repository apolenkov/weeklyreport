import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { PeriodLifecycleIntegrityError } from "../../period/index.js";
import {
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import type { FabricatedRow } from "./__tests__/report-sections-prisma-harness";
import {
  baseRow,
  fullItem,
  mapRow,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

interface LifecycleGateRow {
  status: string;
  periodState: string;
  periodStatus: string;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  publishedAt: Date | null;
  publishedById: string | null;
  reopenedAt: Date | null;
}

interface PublishedLineageDocumentRow {
  recordType: "item" | "decision";
  stableId: string;
}

const OPEN_LIFECYCLE_ROW: LifecycleGateRow = {
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

describe("ReportSectionsPrismaRepository.getReportPeriodWriteGateForSection", () => {
  it("returns periodStatus and archived from the owning report", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({
        report: { periodStatus: "reopened" as const, archived: true },
      }),
    );
    const prisma = { reportSection: { findUnique } };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.getReportPeriodWriteGateForSection("section-1"),
    ).resolves.toEqual({ periodStatus: "reopened", archived: true });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "section-1" },
      select: {
        report: { select: { periodStatus: true, archived: true } },
      },
    });
  });
});

describe("ReportSectionsPrismaRepository.saveSection — version compare-and-set", () => {
  function makeTx(
    updateCount: number,
    reReadResult: FabricatedRow | null,
    lifecycleRows: LifecycleGateRow[] = [OPEN_LIFECYCLE_ROW],
  ) {
    const noop = vi.fn(() => Promise.resolve({ count: 0 }));
    return {
      // The publish/save row lock (SELECT ... FOR UPDATE on the parent
      // report) runs before the version compare-and-set; an open period lets
      // these characterizations exercise the version lock itself.
      // The canonical status-graph advisory lock is part of every save
      // transaction and must remain observable in this harness.
      $executeRaw: vi.fn(() => Promise.resolve(0)),
      $queryRaw: vi.fn<() => Promise<LifecycleGateRow[]>>(() =>
        Promise.resolve(lifecycleRows),
      ),
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: updateCount })),
        // The re-read happens INSIDE the transaction (on `tx`, not the outer
        // `prisma` client) — it carries the row's NEW version, so the returned
        // model reflects this fresh fetch rather than the stale input.
        findUnique: vi.fn(() => Promise.resolve(reReadResult)),
      },
      projectStatus: { deleteMany: noop, createMany: noop },
      stageStatus: { deleteMany: noop, createMany: noop },
      activityStatus: { deleteMany: noop, createMany: noop },
      item: {
        findMany: vi.fn(() => Promise.resolve([])),
        deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
        createMany: noop,
      },
      risk: { deleteMany: noop, createMany: noop },
      decision: {
        findMany: vi.fn(() => Promise.resolve([])),
        deleteMany: noop,
        createMany: noop,
      },
      report: { findMany: vi.fn(() => Promise.resolve([])) },
      publishedSearchDocument: {
        findMany: vi.fn((): Promise<PublishedLineageDocumentRow[]> =>
          Promise.resolve([]),
        ),
      },
      // No comments → re-insert skipped (no findMany stubs needed).
      recordComment: {
        findMany: vi.fn(() => Promise.resolve([])),
        createMany: noop,
      },
    };
  }

  function buildRepo(
    updateCount: number,
    reReadVersion = 1,
    lifecycleRows?: LifecycleGateRow[],
  ) {
    const tx = makeTx(
      updateCount,
      baseRow({ version: reReadVersion }),
      lifecycleRows,
    );
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
    return { repo, tx };
  }

  // A read model to write; saveSection takes the EXPECTED version separately,
  // so this object's own version is irrelevant to the compare-and-set.
  const section = mapRow(baseRow());

  it("matching version: updates with {id, version} + increment, then runs the child writes", async () => {
    // Input section carries version 1; the in-transaction re-read yields 4. The
    // returned model must report 4 (from the fresh fetch), proving the new
    // version round-trips to the client rather than echoing the stale input.
    const { repo, tx } = buildRepo(1, 4);

    const saved = await repo.saveSection(section, 3);

    expect(tx.reportSection.updateMany.mock.calls).toMatchObject([
      [
        {
          where: { id: section.reportSectionId, version: 3 },
          data: { version: { increment: 1 } },
        },
      ],
    ]);
    // The compare-and-set matched, so the delete-then-recreate ran.
    expect(tx.item.deleteMany).toHaveBeenCalled();
    expect(tx.item.findMany).toHaveBeenCalledWith({
      where: { reportSectionId: section.reportSectionId },
      select: expect.anything() as unknown,
    });
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    // The re-read happened on `tx` (inside the transaction), never on a
    // separate outer client.
    expect(tx.reportSection.findUnique).toHaveBeenCalledWith({
      where: { id: section.reportSectionId },
      relationLoadStrategy: "join",
      include: expect.anything() as unknown,
    });
    // The returned read model reflects the post-increment re-read.
    expect(saved.version).toBe(4);
  });

  it("stale version: zero-row match throws SectionVersionConflictError and deletes nothing", async () => {
    const { repo, tx } = buildRepo(0);

    await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
      SectionVersionConflictError,
    );
    // Conflict aborts BEFORE any deleteMany — no child rows touched.
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });

  it("concurrent deletion: an empty in-transaction re-read throws SectionVersionConflictError, not a crash", async () => {
    // Structurally unreachable on real Postgres (the delete cascade would block
    // on this tx's locks), but the defensive guard must still convert a `null`
    // re-read into the same clean conflict error the client retries on.
    const tx = makeTx(1, null);
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
      SectionVersionConflictError,
    );
  });

  it("rejects a save whose report was archived inside the precheck window", async () => {
    // Archiving leaves periodStatus alone, so a gate reading only that status
    // sees "open" and lets the write through. The archive here commits between
    // the service precheck and this transaction — the in-tx gate's case.
    const tx = makeTx(1, baseRow({ version: 1 }));
    tx.$queryRaw = vi.fn(() =>
      Promise.resolve([
        {
          ...OPEN_LIFECYCLE_ROW,
          periodState: "archived",
          archived: true,
        },
      ]),
    );
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 3)).rejects.toThrow(
      /published report/i,
    );
    // Failed closed before any child row was touched.
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a published report inside the transaction", async () => {
    const tx = makeTx(1, baseRow({ version: 1 }));
    tx.$queryRaw = vi.fn(() =>
      Promise.resolve([
        {
          ...OPEN_LIFECYCLE_ROW,
          status: "published",
          periodState: "published",
          periodStatus: "published",
          publishedAt: new Date("2026-07-31T18:00:00.000Z"),
        },
      ]),
    );
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 3)).rejects.toThrow(
      /published report/i,
    );
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects contradictory lifecycle fields inside the transaction", async () => {
    const tx = makeTx(1, baseRow({ version: 1 }));
    tx.$queryRaw = vi.fn(() =>
      Promise.resolve([
        {
          ...OPEN_LIFECYCLE_ROW,
          status: "published",
          periodStatus: "published",
        },
      ]),
    );
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 3)).rejects.toMatchObject({
      name: "PeriodLifecycleIntegrityError",
    });
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });

  it("allows a complete reopened lifecycle field set", async () => {
    const tx = makeTx(1, baseRow({ version: 2 }));
    tx.$queryRaw = vi.fn(() =>
      Promise.resolve([
        {
          ...OPEN_LIFECYCLE_ROW,
          status: "published",
          periodStatus: "reopened",
          publishedAt: new Date("2026-07-31T18:00:00.000Z"),
          reopenedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
      ]),
    );
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 1)).resolves.toMatchObject({
      version: 2,
    });
  });

  it.each([
    ["item", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["decision", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  ] as const)(
    "rejects a save after the locked transaction observes newly published %s lineage",
    async (recordType, stableId) => {
      const tx = makeTx(1, baseRow({ version: 2 }), [
        {
          ...OPEN_LIFECYCLE_ROW,
          status: "published",
          periodStatus: "reopened",
          publishedAt: new Date("2026-09-04T18:00:00.000Z"),
          reopenedAt: new Date("2026-09-04T19:00:00.000Z"),
        },
      ]);
      tx.item.findMany = vi
        .fn()
        .mockResolvedValue(recordType === "item" ? [{ stableId }] : []);
      tx.decision.findMany = vi
        .fn()
        .mockResolvedValue(recordType === "decision" ? [{ stableId }] : []);
      tx.publishedSearchDocument.findMany.mockResolvedValue([
        { recordType, stableId },
      ]);
      const prisma = {
        $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
      };
      const repo = new ReportSectionsPrismaRepository(
        prisma as unknown as PrismaService,
      );

      await expect(repo.saveSection(section, 1)).rejects.toMatchObject({
        code: "PUBLISHED_RECORD_LOCKED",
      });
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        (recordType === "item" ? tx.item.findMany : tx.decision.findMany).mock
          .invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
      expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
      expect(tx.item.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("continues a reopened save when the final section preserves published lineage", async () => {
    const publishedItem = fullItem({
      projectId: OWNED_PROJECT,
      project: { name: "Owned Project" },
      stageNames: ["Development"],
    });
    const preservedSection = mapRow(baseRow({ items: [publishedItem] }));
    const tx = makeTx(1, baseRow({ items: [publishedItem], version: 2 }), [
      {
        ...OPEN_LIFECYCLE_ROW,
        status: "published",
        periodStatus: "reopened",
        publishedAt: new Date("2026-09-04T18:00:00.000Z"),
        reopenedAt: new Date("2026-09-04T19:00:00.000Z"),
      },
    ]);
    tx.item.findMany = vi.fn().mockResolvedValue([publishedItem]);
    tx.publishedSearchDocument.findMany.mockResolvedValue([
      { recordType: "item", stableId: publishedItem.stableId },
    ]);
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(preservedSection, 1)).resolves.toMatchObject({
      version: 2,
    });
    expect(tx.reportSection.updateMany).toHaveBeenCalledOnce();
    expect(tx.item.deleteMany).toHaveBeenCalledOnce();
    expect(tx.item.createMany).toHaveBeenCalled();
  });

  it("allows deleting never-published draft lineage after reopen", async () => {
    const tx = makeTx(1, baseRow({ version: 2 }), [
      {
        ...OPEN_LIFECYCLE_ROW,
        status: "published",
        periodStatus: "reopened",
        publishedAt: new Date("2026-09-04T18:00:00.000Z"),
        reopenedAt: new Date("2026-09-04T19:00:00.000Z"),
      },
    ]);
    tx.item.findMany = vi
      .fn()
      .mockResolvedValue([
        { stableId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
      ]);
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 1)).resolves.toMatchObject({
      version: 2,
    });
    expect(tx.reportSection.updateMany).toHaveBeenCalledOnce();
    expect(tx.item.deleteMany).toHaveBeenCalledOnce();
  });

  describe.each([
    { write: "saveDraft", candidate: section },
    {
      write: "submitSection",
      candidate: {
        ...section,
        status: "submitted" as const,
        submittedAt: new Date("2026-08-01T12:00:00.000Z"),
      },
    },
  ])("$write in-transaction lifecycle gate", ({ candidate }) => {
    it.each([
      {
        state: "deleted",
        rows: [],
        expectedError: ReportSectionNotFoundError,
      },
      {
        state: "published",
        rows: [
          {
            ...OPEN_LIFECYCLE_ROW,
            status: "published",
            periodState: "published",
            periodStatus: "published",
            publishedAt: new Date("2026-07-31T18:00:00.000Z"),
          },
        ],
        expectedError: ReportSectionDomainError,
      },
      {
        state: "archived",
        rows: [
          {
            ...OPEN_LIFECYCLE_ROW,
            periodState: "archived",
            archived: true,
          },
        ],
        expectedError: ReportSectionDomainError,
      },
      {
        state: "contradictory",
        rows: [
          {
            ...OPEN_LIFECYCLE_ROW,
            status: "published",
            periodStatus: "published",
          },
        ],
        expectedError: PeriodLifecycleIntegrityError,
      },
    ])(
      "rejects a concurrently $state report before child writes",
      async ({ rows, expectedError }) => {
        const { repo, tx } = buildRepo(1, 2, rows);

        await expect(repo.saveSection(candidate, 1)).rejects.toBeInstanceOf(
          expectedError,
        );
        expect(tx.$executeRaw).toHaveBeenCalledOnce();
        expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
        expect(tx.item.deleteMany).not.toHaveBeenCalled();
      },
    );

    it("accepts a complete reopened lifecycle field set", async () => {
      const reopened = {
        ...OPEN_LIFECYCLE_ROW,
        status: "published",
        periodStatus: "reopened",
        publishedAt: new Date("2026-07-31T18:00:00.000Z"),
        reopenedAt: new Date("2026-08-01T09:00:00.000Z"),
      };
      const { repo } = buildRepo(1, 2, [reopened]);

      await expect(repo.saveSection(candidate, 1)).resolves.toMatchObject({
        version: 2,
      });
    });
  });

  it("a report deleted inside the precheck window is NOT_FOUND, not a period constraint", async () => {
    // An empty gate result means the parent Report row is gone (deleted between
    // the service precheck and this tx). The resource no longer exists, so the
    // caller gets the NOT_FOUND-class error, not the period-state rejection.
    const tx = makeTx(1, baseRow({ version: 1 }));
    tx.$queryRaw = vi.fn(() => Promise.resolve([]));
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
      ReportSectionNotFoundError,
    );
    // NOT_FOUND maps from its own class; the BAD_REQUEST period-state class
    // must not be what surfaces here.
    await expect(repo.saveSection(section, 3)).rejects.not.toBeInstanceOf(
      ReportSectionDomainError,
    );
    // Failed closed before any child row was touched.
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  describe("saveSection — unique-violation classification", () => {
    function buildRejectingRepo(error: Error) {
      const prisma = {
        $transaction: vi.fn(() => Promise.reject(error)),
      };
      return new ReportSectionsPrismaRepository(
        prisma as unknown as PrismaService,
      );
    }

    const childViolation = Object.assign(
      new Error(
        "Unique constraint failed on the fields: (`reportSectionId`,`projectId`)",
      ),
      { code: "P2002" },
    );

    it("maps a child-table P2002 (reportSectionId + projectId) to DUPLICATE_CHILD_ROW", async () => {
      const repo = buildRejectingRepo(childViolation);

      await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
        ReportSectionDomainError,
      );
      await expect(repo.saveSection(section, 3)).rejects.toThrow(
        /duplicate row/u,
      );
    });

    it("re-throws a P2002 outside the child-constraint set instead of masking it as a duplicate", async () => {
      const unrelatedViolation = Object.assign(
        new Error("Unique constraint failed on the fields: (`sessionToken`)"),
        { code: "P2002" },
      );
      const repo = buildRejectingRepo(unrelatedViolation);

      const error = await repo.saveSection(section, 3).then(
        () => null,
        (error_: unknown) => error_,
      );
      expect(error).toBe(unrelatedViolation);
      expect(error).not.toBeInstanceOf(ReportSectionDomainError);
    });

    it("re-throws a non-P2002 error unchanged", async () => {
      const generic = new Error("db is on fire");
      const repo = buildRejectingRepo(generic);

      const error = await repo.saveSection(section, 3).then(
        () => null,
        (error_: unknown) => error_,
      );
      expect(error).toBe(generic);
    });
  });
});
