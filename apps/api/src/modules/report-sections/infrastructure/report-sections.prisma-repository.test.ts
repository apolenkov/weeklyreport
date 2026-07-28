import { describe, expect, it, vi } from "vitest";

import {
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import type { FabricatedRow } from "./__tests__/report-sections-prisma-harness";
import {
  AUTHOR_ID,
  baseRow,
  mapRow,
} from "./__tests__/report-sections-prisma-harness";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

describe("ReportSectionsPrismaRepository.saveSection — version compare-and-set", () => {
  function makeTx(updateCount: number, reReadResult: FabricatedRow | null) {
    const noop = vi.fn(() => Promise.resolve({ count: 0 }));
    return {
      // The publish/save row lock (SELECT ... FOR UPDATE on the parent
      // report) runs before the version compare-and-set; an open period lets
      // these characterizations exercise the version lock itself.
      $queryRaw: vi.fn(() =>
        Promise.resolve([{ periodStatus: "open", archived: false }]),
      ),
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: updateCount })),
        // The re-read now happens INSIDE the transaction (on `tx`, not the
        // outer `prisma` client) — it carries the row's NEW version, so the
        // returned model must reflect this fresh fetch rather than echoing
        // the stale input.
        findUnique: vi.fn(() => Promise.resolve(reReadResult)),
      },
      projectStatus: { deleteMany: noop, createMany: noop },
      stageStatus: { deleteMany: noop, createMany: noop },
      activityStatus: { deleteMany: noop, createMany: noop },
      item: {
        deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
        createMany: noop,
      },
      risk: { deleteMany: noop, createMany: noop },
      decision: { deleteMany: noop, createMany: noop },
      // No comments → re-insert skipped (no findMany stubs needed).
      recordComment: {
        findMany: vi.fn(() => Promise.resolve([])),
        createMany: noop,
      },
    };
  }

  function buildRepo(updateCount: number, reReadVersion = 1) {
    const tx = makeTx(updateCount, baseRow({ version: reReadVersion }));
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(prisma as never);
    return { repo, tx };
  }

  // A read model to write; saveSection takes the EXPECTED version separately,
  // so this object's own version is irrelevant to the compare-and-set.
  const section = mapRow(baseRow());

  it("matching version: updates with {id, version} + increment, then runs the child writes", async () => {
    // Input section carries version 1; the post-commit re-read yields 4. The
    // returned model must report 4 (from the fresh fetch), proving the new
    // version round-trips to the client rather than echoing the stale input.
    const { repo, tx } = buildRepo(1, 4);

    const saved = await repo.saveSection(section, 3);

    expect(tx.reportSection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: section.reportSectionId, version: 3 },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() returns any; vitest asymmetric matcher has no precise type
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    // The compare-and-set matched, so the delete-then-recreate ran.
    expect(tx.item.deleteMany).toHaveBeenCalled();
    // The re-read happened on `tx` (inside the transaction), never on a
    // separate outer client.
    expect(tx.reportSection.findUnique).toHaveBeenCalledWith({
      where: { id: section.reportSectionId },
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
    // This scenario is structurally unreachable in a real Postgres
    // transaction (the delete's cascade would block on this transaction's
    // locks), but the defensive guard must still convert a `null` re-read
    // into the same clean conflict error the client already retries on —
    // never crash on `null.id`.
    const tx = makeTx(1, null);
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(prisma as never);

    await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
      SectionVersionConflictError,
    );
  });

  it("rejects a save whose report was archived inside the precheck window", async () => {
    // Archiving leaves periodStatus alone, so a gate reading only that status
    // sees "open" and lets the write through. The archive here commits between
    // the service-level precheck and this transaction — the case the in-tx
    // gate exists for.
    const tx = makeTx(1, baseRow({ version: 1 }));
    tx.$queryRaw = vi.fn(() =>
      Promise.resolve([{ periodStatus: "open", archived: true }]),
    );
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(prisma as never);

    await expect(repo.saveSection(section, 3)).rejects.toThrow(
      /published report/i,
    );
    // Failed closed before any child row was touched.
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("a report deleted inside the precheck window is NOT_FOUND, not a period constraint", async () => {
    // An empty gate result means the parent Report row is gone (deleted between
    // the service-level precheck and this transaction). The resource no longer
    // exists, so the caller must get the NOT_FOUND-class error rather than the
    // "published report" period-state rejection.
    const tx = makeTx(1, baseRow({ version: 1 }));
    tx.$queryRaw = vi.fn(() => Promise.resolve([]));
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(prisma as never);

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
});

// Ordering keys on report.periodStart, not the row's createdAt: createdAt is
// insertion time and says nothing about which period a report covers, so
// sorting by it would scramble the lead history against compiledHistory.
describe("ReportSectionsPrismaRepository.getMyHistoryRows — ordering", () => {
  it("orders by report.periodStart desc, with createdAt as the stable tiebreak", async () => {
    const findMany = vi.fn(() => Promise.resolve([]));
    const prisma = { reportSection: { findMany } };
    const repository = new ReportSectionsPrismaRepository(prisma as never);

    const result = await repository.getMyHistoryRows(AUTHOR_ID);

    expect(result).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: AUTHOR_ID },
        orderBy: [{ report: { periodStart: "desc" } }, { createdAt: "desc" }],
      }),
    );
  });
});
