import type { UserSession } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import {
  AdminGroupProductConflictError,
  AdminPeriodOverlapError,
  AdminReopenRequestNotFoundError,
  AdminUserConflictError,
  AdminUserReportingGroupRequiredError,
} from "./admin-shared";

// Manual create must reach PolicyApplicatorService like saveSnapshot does.
describe("AdminPrismaRepository.createPeriodManual — reminder parity", () => {
  const CREATED = {
    id: "report-1",
    periodStart: new Date("2026-07-06T00:00:00.000Z"),
    periodEnd: new Date("2026-07-12T23:59:59.999Z"),
    deadline: new Date("2026-07-10T15:00:00.000Z"),
    periodState: "open" as const,
  };

  const INPUT = {
    periodStart: CREATED.periodStart,
    periodEnd: CREATED.periodEnd,
    deadline: CREATED.deadline,
    weekLabel: null,
    periodState: "open" as const,
  };

  function fakePrisma() {
    return {
      report: { create: vi.fn(() => Promise.resolve(CREATED)) },
    } as unknown as PrismaService;
  }

  function fakeApplicator() {
    return {
      applyToPeriod: vi.fn(() =>
        Promise.resolve({ created: 0, updated: 0, skipped: 0 }),
      ),
    } as unknown as PolicyApplicatorService;
  }

  it("applies reminder policies to the freshly-created period, forwarding now", async () => {
    const applicator = fakeApplicator();
    const repo = new AdminPrismaRepository(fakePrisma(), applicator);
    // A backfill: the new period's deadline is already past relative to `now`.
    // The repository must forward `now` so the applicator drops elapsed
    // reminders; dropping it would arm them to fire stale on the next tick.
    const now = new Date("2026-07-20T12:00:00.000Z");

    const result = await repo.createPeriodManual(INPUT, now);

    expect(result).toEqual(CREATED);
    expect(applicator.applyToPeriod).toHaveBeenCalledTimes(1);
    expect(applicator.applyToPeriod).toHaveBeenCalledWith(CREATED, now);
  });

  it("still mints the period when no applicator is wired", async () => {
    const repo = new AdminPrismaRepository(fakePrisma());

    const result = await repo.createPeriodManual(INPUT);

    expect(result).toEqual(CREATED);
  });

  it("propagates an applicator failure (period already committed)", async () => {
    const applicator = {
      applyToPeriod: vi.fn(() =>
        Promise.reject(new Error("reminders DB down")),
      ),
    } as unknown as PolicyApplicatorService;
    const repo = new AdminPrismaRepository(fakePrisma(), applicator);

    await expect(repo.createPeriodManual(INPUT)).rejects.toThrow(
      "reminders DB down",
    );
  });

  it.each(["published", "archived", "widened-state"])(
    "rejects direct repository state %s before persistence",
    async (periodState) => {
      const prisma = fakePrisma();
      const repo = new AdminPrismaRepository(prisma);
      const widenedInput = { ...INPUT, periodState };

      await expect(
        // @ts-expect-error Runtime guard is planted against widened callers.
        repo.createPeriodManual(widenedInput),
      ).rejects.toMatchObject({ name: "ZodError" });
      expect(prisma.report.create).not.toHaveBeenCalled();
    },
  );
});

// Open-boundary P2002 → AdminPeriodOverlapError (BAD_REQUEST), never a raw 500.
describe("AdminPrismaRepository period writers — open-boundary P2002 translation", () => {
  function openBoundaryP2002(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: "Report_one_open_per_boundary" },
      },
    );
  }

  const INPUT = {
    periodStart: new Date("2026-07-06T00:00:00.000Z"),
    periodEnd: new Date("2026-07-12T23:59:59.999Z"),
    deadline: new Date("2026-07-10T15:00:00.000Z"),
    weekLabel: null,
    periodState: "open" as const,
  };

  it("createPeriodManual: P2002 → AdminPeriodOverlapError", async () => {
    const prisma = {
      report: { create: vi.fn(() => Promise.reject(openBoundaryP2002())) },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.createPeriodManual(INPUT)).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });

  it("updatePeriodManual: P2002 on the date-envelope edit → AdminPeriodOverlapError", async () => {
    const prisma = {
      report: { update: vi.fn(() => Promise.reject(openBoundaryP2002())) },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(
      repo.updatePeriodManual({
        reportId: "report-1",
        data: { periodStart: INPUT.periodStart, periodEnd: INPUT.periodEnd },
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("unarchivePeriod: P2002 when unarchiving into a held boundary → AdminPeriodOverlapError", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({
        status: "draft",
        periodState: "archived",
        periodStatus: "open",
        archived: true,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      }),
    );
    const updateMany = vi.fn(() => Promise.reject(openBoundaryP2002()));
    const prisma = {
      $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
        run({ report: { findUnique, updateMany } }),
      ),
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.unarchivePeriod("report-1")).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });

  it("re-throws a non-P2002 error unchanged (an unrelated failure is not masked)", async () => {
    const prisma = {
      report: {
        create: vi.fn(() => Promise.reject(new Error("connection reset"))),
      },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.createPeriodManual(INPUT)).rejects.toThrow(
      "connection reset",
    );
  });
});

// Product attach: idempotent win vs domain conflict; user identity race → conflict.
describe("AdminPrismaRepository entity writers — P2002 race handling", () => {
  const PRODUCT_INPUT = {
    groupId: "a0000000-0000-4000-8000-000000000301",
    productId: "a0000000-0000-4000-8000-000000000201",
  };
  const WINNING_EDGE = {
    id: "a0000000-0000-4000-8000-000000000401",
    ...PRODUCT_INPUT,
    createdAt: new Date("2026-07-15T10:00:00.000Z"),
  };
  const USER_INPUT = {
    id: "a0000000-0000-4000-8000-000000000101",
    email: "identity@test.local",
    name: "Identity User",
    lastName: "Identity",
    firstName: "User",
    middleName: null,
    position: null,
    role: "viewer" as const,
    reportingGroupId: null,
    isActive: true,
  };

  function uniqueViolation(
    target: string,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test", meta: { target } },
    );
  }

  it("attachProductToGroup returns the concurrent winner for the same group", async () => {
    const prisma = {
      groupProduct: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(WINNING_EDGE),
        create: vi.fn(() =>
          Promise.reject(uniqueViolation("GroupProduct_productId_key")),
        ),
      },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.attachProductToGroup(PRODUCT_INPUT)).resolves.toEqual(
      WINNING_EDGE,
    );
  });

  it("attachProductToGroup reports a concurrent winner in another group", async () => {
    const otherGroupId = "a0000000-0000-4000-8000-000000000302";
    const prisma = {
      groupProduct: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...WINNING_EDGE, groupId: otherGroupId }),
        create: vi.fn(() =>
          Promise.reject(uniqueViolation("GroupProduct_productId_key")),
        ),
      },
      reportingGroup: {
        findUnique: vi.fn(() => Promise.resolve({ name: "Other Group" })),
      },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(
      repo.attachProductToGroup(PRODUCT_INPUT),
    ).rejects.toBeInstanceOf(AdminGroupProductConflictError);
  });

  it.each(["User_email_key", "User_samlId_key"])(
    "upsertUser translates a %s collision to AdminUserConflictError",
    async (target) => {
      const prisma = {
        user: {
          upsert: vi.fn(() => Promise.reject(uniqueViolation(target))),
        },
      } as unknown as PrismaService;
      const repo = new AdminPrismaRepository(prisma);

      await expect(repo.upsertUser(USER_INPUT)).rejects.toBeInstanceOf(
        AdminUserConflictError,
      );
    },
  );

  it("upsertUser fails loud for a non-viewer with no reporting group, never manufacturing one", async () => {
    const upsert = vi.fn(() =>
      Promise.reject(new Error("must not be reached")),
    );
    const prisma = {
      user: { upsert },
      reportingGroup: { findFirst: vi.fn() },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(
      repo.upsertUser({
        ...USER_INPUT,
        role: "lead",
        reportingGroupId: null,
      }),
    ).rejects.toBeInstanceOf(AdminUserReportingGroupRequiredError);
    expect(upsert).not.toHaveBeenCalled();
    expect(prisma.reportingGroup.findFirst).not.toHaveBeenCalled();
  });

  it("attachProductToGroup re-throws a non-P2002 error unchanged", async () => {
    const original = new Error("connection reset");
    const prisma = {
      groupProduct: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(() => Promise.reject(original)),
      },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.attachProductToGroup(PRODUCT_INPUT)).rejects.toBe(
      original,
    );
  });
});

// Group-scope where-clause pinning lives at this repository boundary.
describe("AdminPrismaRepository — deactivate/activate, integrations, stages", () => {
  it("deactivateUser sets isActive=false", async () => {
    const update = vi.fn(() => Promise.resolve({}));
    const repo = new AdminPrismaRepository({
      user: { update },
    } as unknown as PrismaService);

    await repo.deactivateUser("user-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false },
    });
  });

  it("activateUser sets isActive=true", async () => {
    const update = vi.fn(() => Promise.resolve({}));
    const repo = new AdminPrismaRepository({
      user: { update },
    } as unknown as PrismaService);

    await repo.activateUser("user-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: true },
    });
  });

  it("countActiveTelegramBindings counts only active=true rows", async () => {
    const count = vi.fn(() => Promise.resolve(3));
    const repo = new AdminPrismaRepository({
      telegramBinding: { count },
    } as unknown as PrismaService);

    await expect(repo.countActiveTelegramBindings()).resolves.toBe(3);
    expect(count).toHaveBeenCalledWith({ where: { active: true } });
  });

  it("listStages orders by sortOrder asc", async () => {
    const findMany = vi.fn((..._args: unknown[]) => Promise.resolve([]));
    const repo = new AdminPrismaRepository({
      stage: { findMany },
    } as unknown as PrismaService);

    await repo.listStages();

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    });
  });

  it("reminderPolicyExists performs a targeted id lookup", async () => {
    const findUnique = vi.fn(() => Promise.resolve({ id: "policy-1" }));
    const repo = new AdminPrismaRepository({
      reminderPolicy: { findUnique },
    } as unknown as PrismaService);

    await expect(repo.reminderPolicyExists("policy-1")).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "policy-1" },
      select: { id: true },
    });
  });

  it("listStageAssignmentCounts maps the groupBy rows", async () => {
    const groupBy = vi.fn(() =>
      Promise.resolve([{ projectId: "p1", _count: { _all: 4 } }]),
    );
    const repo = new AdminPrismaRepository({
      stageAssignment: { groupBy },
    } as unknown as PrismaService);

    await expect(repo.listStageAssignmentCounts()).resolves.toEqual([
      { projectId: "p1", count: 4 },
    ]);
  });
});

describe("AdminPrismaRepository — reopen-request lifecycle", () => {
  const headSession: UserSession = {
    userId: "head-1",
    email: "head@test.local",
    name: "Head",
    role: "head",
    reportingGroupId: "group-1",
    viewerGroupAccess: ["group-1"],
    activeReportId: null,
    activeReportSectionId: null,
  };
  const adminSession: UserSession = { ...headSession, role: "admin" };

  it("listReopenRequests scopes a head to its own group", async () => {
    const findMany = vi.fn((..._args: unknown[]) => Promise.resolve([]));
    const repo = new AdminPrismaRepository({
      reopenRequest: { findMany },
    } as unknown as PrismaService);

    await repo.listReopenRequests({ status: "pending", session: headSession });

    const call = findMany.mock.calls[0]?.[0] as { where?: unknown };
    expect(call.where).toEqual({
      status: "pending",
      reportSection: { author: { reportingGroupId: { in: ["group-1"] } } },
    });
  });

  it("listReopenRequests is global ({} scope) for admin", async () => {
    const findMany = vi.fn((..._args: unknown[]) => Promise.resolve([]));
    const repo = new AdminPrismaRepository({
      reopenRequest: { findMany },
    } as unknown as PrismaService);

    await repo.listReopenRequests({
      status: "pending",
      session: adminSession,
    });

    const call = findMany.mock.calls[0]?.[0] as { where?: unknown };
    expect(call.where).toEqual({
      status: "pending",
      reportSection: {},
    });
  });

  it("listReopenRequests: status='all' drops the status filter", async () => {
    const findMany = vi.fn((..._args: unknown[]) => Promise.resolve([]));
    const repo = new AdminPrismaRepository({
      reopenRequest: { findMany },
    } as unknown as PrismaService);

    await repo.listReopenRequests({ status: "all", session: adminSession });

    const call = findMany.mock.calls[0]?.[0] as { where?: unknown };
    expect(call.where).toEqual({ reportSection: {} });
  });

  it("countPendingReopenRequests scopes a head to its own group", async () => {
    const count = vi.fn(() => Promise.resolve(2));
    const repo = new AdminPrismaRepository({
      reopenRequest: { count },
    } as unknown as PrismaService);

    await expect(repo.countPendingReopenRequests(headSession)).resolves.toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: {
        status: "pending",
        reportSection: { author: { reportingGroupId: { in: ["group-1"] } } },
      },
    });
  });

  it("decideReopenRequest re-checks group scope INSIDE the decision transaction", async () => {
    // A scope change between a pre-transaction read and the write must be
    // caught: the scoped re-load lives in the same transaction as the
    // decision, so an out-of-scope request is rejected and nothing is written.
    const tx = {
      reopenRequest: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      },
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    const $transaction = vi.fn((cb: (t: typeof tx) => unknown) =>
      Promise.resolve(cb(tx)),
    );
    const repo = new AdminPrismaRepository({
      $transaction,
    } as unknown as PrismaService);

    await expect(
      repo.decideReopenRequest({
        id: "req-1",
        decision: "approved",
        reviewNote: null,
        decidedBy: "head-1",
        session: headSession,
      }),
    ).rejects.toBeInstanceOf(AdminReopenRequestNotFoundError);

    expect($transaction).toHaveBeenCalledOnce();
    expect(tx.reopenRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        reportSection: {
          author: { reportingGroupId: { in: ["group-1"] } },
        },
      },
      select: { id: true, reportSectionId: true },
    });
    expect(tx.reopenRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("decideReopenRequest: a loser of a concurrent decision reports already-processed", async () => {
    const tx = {
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({ id: "req-1", reportSectionId: "sec-1" }),
        ),
        updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
      },
    };
    const repo = new AdminPrismaRepository({
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
    } as unknown as PrismaService);

    await expect(
      repo.decideReopenRequest({
        id: "req-1",
        decision: "approved",
        reviewNote: null,
        decidedBy: "head-1",
        session: headSession,
      }),
    ).resolves.toEqual({ kind: "already-processed" });
  });

  it("decideReopenRequest: a winning approve flips the section", async () => {
    const tx = {
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({ id: "req-1", reportSectionId: "sec-1" }),
        ),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      },
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    const repo = new AdminPrismaRepository({
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
    } as unknown as PrismaService);

    await expect(
      repo.decideReopenRequest({
        id: "req-1",
        decision: "approved",
        reviewNote: null,
        decidedBy: "head-1",
        session: headSession,
      }),
    ).resolves.toEqual({ kind: "decided", decision: "approved" });
    expect(tx.reportSection.updateMany).toHaveBeenCalledWith({
      where: { id: "sec-1", status: "submitted" },
      data: expect.objectContaining({ status: "draft" }) as unknown,
    });
  });

  it("decideReopenRequest: a stale approve auto-closes to rejected", async () => {
    const tx = {
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({ id: "req-1", reportSectionId: "sec-1" }),
        ),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
        update: vi.fn(() => Promise.resolve({})),
      },
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
      },
    };
    const repo = new AdminPrismaRepository({
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
    } as unknown as PrismaService);

    await expect(
      repo.decideReopenRequest({
        id: "req-1",
        decision: "approved",
        reviewNote: null,
        decidedBy: "head-1",
        session: headSession,
      }),
    ).resolves.toEqual({ kind: "stale" });
    expect(tx.reopenRequest.update).toHaveBeenCalledTimes(1);
  });

  it("decideReopenRequest: a reject skips the section flip entirely", async () => {
    const tx = {
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({ id: "req-1", reportSectionId: "sec-1" }),
        ),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      },
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    const repo = new AdminPrismaRepository({
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
    } as unknown as PrismaService);

    await expect(
      repo.decideReopenRequest({
        id: "req-1",
        decision: "rejected",
        reviewNote: null,
        decidedBy: "head-1",
        session: headSession,
      }),
    ).resolves.toEqual({ kind: "decided", decision: "rejected" });
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });
});
