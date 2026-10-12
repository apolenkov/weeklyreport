import type { UserSession } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../lib/logger.js";
import type { PolicyApplicatorService } from "../reminders/index.js";
import { LeadFormConstraintError } from "../report-sections/index.js";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminStageAssignmentNotFoundError } from "./admin-errors";
import {
  AdminGroupProductConflictError,
  AdminPeriodOverlapError,
  AdminProjectNotFoundError,
  AdminReminderPolicyNotFoundError,
  AdminReopenRequestNotFoundError,
  AdminReportingGroupNotFoundError,
  AdminUserConflictError,
  AdminUserNotFoundError,
  AdminUserPublishedHistoryError,
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
    expect(applicator.applyToPeriod).toHaveBeenCalledWith(CREATED.id, now);
  });

  it("still mints the period when no applicator is wired", async () => {
    const repo = new AdminPrismaRepository(fakePrisma());

    const result = await repo.createPeriodManual(INPUT);

    expect(result).toEqual(CREATED);
  });

  it("returns the committed period and logs an applicator failure", async () => {
    // The period row already committed when the post-create hook runs, so an
    // applicator failure is reported to the hourly missing-rule repair sweep,
    // not propagated as a create failure.
    const applicator = {
      applyToPeriod: vi.fn(() =>
        Promise.reject(new Error("reminders DB down")),
      ),
    } as unknown as PolicyApplicatorService;
    const logger = { ...createNullLogger(), error: vi.fn() };
    const repo = new AdminPrismaRepository(fakePrisma(), applicator, logger);

    const result = await repo.createPeriodManual(INPUT);

    expect(result).toEqual(CREATED);
    expect(logger.error).toHaveBeenCalledWith(
      "post-commit reminder policy application failed",
      expect.objectContaining({
        phase: "create-period-manual",
        committed: true,
        reportIds: [CREATED.id],
      }),
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

// Both rollout-era and current database guards map to the same domain outcome.
describe("AdminPrismaRepository period writers — overlap translation", () => {
  function periodUpdatePrisma(error: unknown): PrismaService {
    const report = {
      updateMany: vi.fn(() => Promise.reject(error)),
      findUniqueOrThrow: vi.fn(),
    };
    return {
      $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
        run({
          $executeRaw: vi.fn().mockResolvedValue(0),
          $queryRaw: vi.fn(() =>
            Promise.resolve([
              {
                status: "draft",
                periodState: "open",
                periodStatus: "open",
                archived: false,
                autoPublished: false,
                autoArchived: false,
                publishedAt: null,
                publishedById: null,
                reopenedAt: null,
              },
            ]),
          ),
          report,
        }),
      ),
    } as unknown as PrismaService;
  }

  function periodOverlapP2039(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      'Database error. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "Report_no_live_period_overlap"`',
      {
        code: "P2039",
        clientVersion: "test",
        meta: {
          driverAdapterError: {
            cause: {
              kind: "postgres",
              originalCode: "23P01",
              originalMessage:
                'conflicting key value violates exclusion constraint "Report_no_live_period_overlap"',
            },
          },
        },
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

  it("createPeriodManual: adapter range P2039 → AdminPeriodOverlapError", async () => {
    const prisma = {
      report: { create: vi.fn(() => Promise.reject(periodOverlapP2039())) },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.createPeriodManual(INPUT)).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });

  it("updatePeriodManual: adapter range P2039 → AdminPeriodOverlapError", async () => {
    const prisma = periodUpdatePrisma(periodOverlapP2039());
    const repo = new AdminPrismaRepository(prisma);

    await expect(
      repo.updatePeriodManual({
        reportId: "report-1",
        expectedPeriodState: "open",
        data: { periodStart: INPUT.periodStart, periodEnd: INPUT.periodEnd },
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("unarchivePeriod: range exclusion when unarchiving into an overlap → AdminPeriodOverlapError", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
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
    const updateMany = vi.fn(() => Promise.reject(periodOverlapP2039()));
    const prisma = {
      $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
        run({
          $queryRaw: vi.fn(() => Promise.resolve([])),
          report: { findUnique, updateMany },
        }),
      ),
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(
      repo.unarchivePeriod("report-1", new Date("2026-08-30T12:00:00.000Z")),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("re-throws a non-P2039 error unchanged (an unrelated failure is not masked)", async () => {
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

describe("AdminPrismaRepository.findOverlappingPeriod", () => {
  it("limits the friendly precheck to the same live states as the database constraint", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const prisma = {
      report: { findFirst },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);
    const periodStart = new Date("2026-08-03T00:00:00.000Z");
    const periodEnd = new Date("2026-08-09T23:59:59.999Z");

    await expect(
      repo.findOverlappingPeriod({
        periodStart,
        periodEnd,
        excludeId: "report-being-edited",
      }),
    ).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        periodState: { in: ["scheduled", "open"] },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        NOT: { id: "report-being-edited" },
      },
      orderBy: { periodStart: "desc" },
      select: { id: true, periodStart: true, periodEnd: true },
    });
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
    const leadId = "a0000000-0000-4000-8000-000000000101";
    const prisma = {
      $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
        run(prisma),
      ),
      $queryRaw: vi.fn(() => Promise.resolve([{ id: leadId }])),
      project: {
        findUnique: vi.fn().mockResolvedValue({ leadId }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ leadId }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          role: "lead",
          reportingGroupId: PRODUCT_INPUT.groupId,
        }),
      },
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
      $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
        run(prisma),
      ),
      $queryRaw: vi.fn(() => Promise.resolve([{ id: "lead-1" }])),
      project: {
        findUnique: vi.fn().mockResolvedValue({ leadId: "lead-1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ leadId: "lead-1" }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          role: "lead",
          reportingGroupId: PRODUCT_INPUT.groupId,
        }),
      },
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
        $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
          run(prisma),
        ),
        // First the active-admin set (none), then the user row lock.
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: USER_INPUT.id }]),
        project: { findMany: vi.fn().mockResolvedValue([]) },
        projectActivityLead: { findMany: vi.fn().mockResolvedValue([]) },
        reportingGroup: { findMany: vi.fn().mockResolvedValue([]) },
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
      $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
        run(prisma),
      ),
      $queryRaw: vi.fn(() => Promise.resolve([{ id: "lead-1" }])),
      project: {
        findUnique: vi.fn().mockResolvedValue({ leadId: "lead-1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ leadId: "lead-1" }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          role: "lead",
          reportingGroupId: PRODUCT_INPUT.groupId,
        }),
      },
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
// removeUser/deactivateUser run in a transaction that first locks the active
// administrators; the stub returns none, so the last-admin guard stays quiet.
function withTransaction(base: object): PrismaService {
  const prisma = {
    ...base,
    $queryRaw: vi.fn(() => Promise.resolve([])),
    $transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
      run(prisma),
    ),
  };
  return prisma as unknown as PrismaService;
}

describe("AdminPrismaRepository — deactivate/activate, stages", () => {
  it("removeUser reports a published-report reference before deleting", async () => {
    const deleteMany = vi.fn();
    const sectionCount = vi.fn();
    const projectCount = vi.fn();
    const repo = new AdminPrismaRepository(
      withTransaction({
        report: {
          findFirst: vi.fn(() => Promise.resolve({ id: "report-1" })),
        },
        reportSection: { count: sectionCount },
        project: { count: projectCount },
        user: { deleteMany },
      }),
    );

    await expect(repo.removeUser("publisher-1")).rejects.toBeInstanceOf(
      AdminUserPublishedHistoryError,
    );
    expect(sectionCount).not.toHaveBeenCalled();
    expect(projectCount).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("removeUser reports a publication that wins the guard/delete race", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "report-raced" });
    const repo = new AdminPrismaRepository(
      withTransaction({
        report: { findFirst },
        reportSection: { count: vi.fn(() => Promise.resolve(0)) },
        project: { count: vi.fn(() => Promise.resolve(0)) },
        user: {
          deleteMany: vi.fn(() => Promise.reject({ code: "P2003" })),
        },
      }),
    );

    await expect(repo.removeUser("publisher-1")).rejects.toMatchObject({
      name: "AdminUserPublishedHistoryError",
      message:
        "User is retained by published report report-raced; deactivate the user instead.",
    });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it.each([
    { references: "sections", sectionCount: 1, projectCount: 0 },
    { references: "projects", sectionCount: 0, projectCount: 1 },
  ])(
    "removeUser reports a conflict when $references still reference the user",
    async ({ sectionCount, projectCount }) => {
      const deleteMany = vi.fn();
      const repo = new AdminPrismaRepository(
        withTransaction({
          report: { findFirst: vi.fn(() => Promise.resolve(null)) },
          reportSection: { count: vi.fn(() => Promise.resolve(sectionCount)) },
          project: { count: vi.fn(() => Promise.resolve(projectCount)) },
          user: { deleteMany },
        }),
      );

      await expect(repo.removeUser("lead-1")).rejects.toBeInstanceOf(
        AdminUserConflictError,
      );
      expect(deleteMany).not.toHaveBeenCalled();
    },
  );

  it("removeUser reports a conflict when a racing reference rejects the delete", async () => {
    // A reference committed between the count check and the delete surfaces as
    // P2003; with no raced publication it is still an honest conflict.
    const findFirst = vi.fn(() => Promise.resolve(null));
    const repo = new AdminPrismaRepository(
      withTransaction({
        report: { findFirst },
        reportSection: { count: vi.fn(() => Promise.resolve(0)) },
        project: { count: vi.fn(() => Promise.resolve(0)) },
        user: {
          deleteMany: vi.fn(() => Promise.reject({ code: "P2003" })),
        },
      }),
    );

    await expect(repo.removeUser("lead-1")).rejects.toBeInstanceOf(
      AdminUserConflictError,
    );
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("removeUser re-throws a non-P2003 delete failure unchanged", async () => {
    const original = new Error("connection reset");
    const repo = new AdminPrismaRepository(
      withTransaction({
        report: { findFirst: vi.fn(() => Promise.resolve(null)) },
        reportSection: { count: vi.fn(() => Promise.resolve(0)) },
        project: { count: vi.fn(() => Promise.resolve(0)) },
        user: { deleteMany: vi.fn(() => Promise.reject(original)) },
      }),
    );

    await expect(repo.removeUser("lead-1")).rejects.toBe(original);
  });

  it("deactivateUser sets isActive=false", async () => {
    const update = vi.fn(() => Promise.resolve({}));
    const repo = new AdminPrismaRepository(
      withTransaction({
        user: { update },
      }),
    );

    await repo.deactivateUser("user-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false },
    });
  });

  it("activateUser sets isActive=true", async () => {
    const update = vi.fn(() => Promise.resolve({}));
    const repo = new AdminPrismaRepository(
      withTransaction({
        user: { update },
      }),
    );

    await repo.activateUser("user-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: true },
    });
  });

  it.each(["deactivateUser", "activateUser"] as const)(
    "%s translates a missing-row P2025 into AdminUserNotFoundError",
    async (method) => {
      const repo = new AdminPrismaRepository(
        withTransaction({
          user: {
            update: vi.fn(() => Promise.reject({ code: "P2025" })),
          },
        }),
      );

      await expect(repo[method]("missing-user")).rejects.toBeInstanceOf(
        AdminUserNotFoundError,
      );
    },
  );

  it.each([
    {
      method: "deactivateUser",
      kind: "Error",
      rejection: new Error("connection reset"),
    },
    { method: "deactivateUser", kind: "null", rejection: null },
    { method: "deactivateUser", kind: "undefined", rejection: undefined },
    {
      method: "deactivateUser",
      kind: "primitive",
      rejection: "plain failure",
    },
    {
      method: "deactivateUser",
      kind: "non-P2025 object",
      rejection: { code: "P2003" },
    },
    {
      method: "activateUser",
      kind: "Error",
      rejection: new Error("connection reset"),
    },
    { method: "activateUser", kind: "null", rejection: null },
    { method: "activateUser", kind: "undefined", rejection: undefined },
    {
      method: "activateUser",
      kind: "primitive",
      rejection: "plain failure",
    },
    {
      method: "activateUser",
      kind: "non-P2025 object",
      rejection: { code: "P2003" },
    },
  ] as const)(
    "$method re-throws a $kind rejection unchanged",
    async ({ method, rejection }) => {
      const repo = new AdminPrismaRepository(
        withTransaction({
          user: { update: vi.fn(() => Promise.reject(rejection)) },
        }),
      );

      await expect(repo[method]("user-1")).rejects.toBe(rejection);
    },
  );

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

  it("deleteReminderPolicy relies on one cascading policy delete", async () => {
    const policyDelete = vi.fn(() => Promise.resolve({ id: "policy-1" }));
    const ruleDeleteMany = vi.fn();
    const repo = new AdminPrismaRepository({
      reminderPolicy: { delete: policyDelete },
      reminderRule: { deleteMany: ruleDeleteMany },
    } as unknown as PrismaService);

    await expect(
      repo.deleteReminderPolicy("policy-1"),
    ).resolves.toBeUndefined();
    expect(policyDelete).toHaveBeenCalledWith({ where: { id: "policy-1" } });
    expect(ruleDeleteMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      method: "removeProject",
      delegate: {
        project: { update: vi.fn(() => Promise.reject({ code: "P2025" })) },
      },
      errorClass: AdminProjectNotFoundError,
    },
    {
      method: "archiveReportingGroup",
      delegate: {
        reportingGroup: {
          update: vi.fn(() => Promise.reject({ code: "P2025" })),
        },
      },
      errorClass: AdminReportingGroupNotFoundError,
    },
    {
      method: "deleteReminderPolicy",
      delegate: {
        reminderPolicy: {
          delete: vi.fn(() => Promise.reject({ code: "P2025" })),
        },
      },
      errorClass: AdminReminderPolicyNotFoundError,
    },
  ] as const)(
    "$method translates a missing-row P2025 into a typed not-found error",
    async ({ method, delegate, errorClass }) => {
      const prisma = {
        ...delegate,
        $transaction: (run: (tx: unknown) => Promise<unknown>) =>
          run({
            ...delegate,
            $queryRaw: vi.fn().mockResolvedValue([]),
            reportingGroup: {
              ...("reportingGroup" in delegate ? delegate.reportingGroup : {}),
              findMany: vi.fn().mockResolvedValue([]),
            },
          }),
      };
      const repo = new AdminPrismaRepository(
        prisma as unknown as PrismaService,
      );

      await expect(repo[method]("missing-id")).rejects.toBeInstanceOf(
        errorClass,
      );
    },
  );

  it.each([
    { method: "removeProject", delegateKey: "project", verb: "update" },
    {
      method: "archiveReportingGroup",
      delegateKey: "reportingGroup",
      verb: "update",
    },
    {
      method: "deleteReminderPolicy",
      delegateKey: "reminderPolicy",
      verb: "delete",
    },
  ] as const)(
    "$method re-throws a non-P2025 rejection unchanged",
    async ({ method, delegateKey, verb }) => {
      const rejection = new Error("connection reset");
      const delegate = {
        [delegateKey]: { [verb]: vi.fn(() => Promise.reject(rejection)) },
      };
      const repo = new AdminPrismaRepository({
        ...delegate,
        $transaction: (run: (tx: unknown) => Promise<unknown>) =>
          run({
            ...delegate,
            $queryRaw: vi.fn().mockResolvedValue([]),
            reportingGroup: {
              ...delegate.reportingGroup,
              findMany: vi.fn().mockResolvedValue([]),
            },
          }),
      } as unknown as PrismaService);

      await expect(repo[method]("id-1")).rejects.toBe(rejection);
    },
  );

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
  const editableGate = () =>
    vi.fn(() =>
      Promise.resolve([
        {
          id: "report-1",
          status: "draft",
          periodState: "open",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
    );
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

    await repo.listReopenRequests({
      status: "pending",
      limit: 50,
      session: headSession,
    });

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
      limit: 50,
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

    await repo.listReopenRequests({
      status: "all",
      limit: 50,
      session: adminSession,
    });

    const call = findMany.mock.calls[0]?.[0] as { where?: unknown };
    expect(call.where).toEqual({ reportSection: {} });
  });

  it("continues below a compound cursor without looking up its anchor row", async () => {
    const findMany = vi.fn((..._args: unknown[]) => Promise.resolve([]));
    const repo = new AdminPrismaRepository({
      reopenRequest: { findMany },
    } as unknown as PrismaService);
    const cursor = {
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-09-06T08:30:00.000Z",
    };

    await repo.listReopenRequests({
      status: "approved",
      limit: 25,
      cursor,
      session: adminSession,
    });

    const call = findMany.mock.calls[0]?.[0] as {
      where?: unknown;
      orderBy?: unknown;
      take?: unknown;
    };
    const cursorDate = new Date(cursor.createdAt);
    expect(call).toMatchObject({
      where: {
        status: "approved",
        reportSection: {},
        AND: [
          {
            OR: [
              { createdAt: { lt: cursorDate } },
              { createdAt: cursorDate, id: { lt: cursor.id } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 26,
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("applies case-insensitive rendered-field search in where before the probe take", async () => {
    const findMany = vi.fn((..._args: unknown[]) => Promise.resolve([]));
    const repo = new AdminPrismaRepository({
      reopenRequest: { findMany },
    } as unknown as PrismaService);

    await repo.listReopenRequests({
      status: "all",
      limit: 2,
      search: "Weekly 36",
      session: adminSession,
    });

    const call = findMany.mock.calls[0]?.[0] as {
      where?: unknown;
      take?: unknown;
    };
    expect(call.where).toEqual({
      reportSection: {},
      AND: [
        {
          OR: [
            {
              requestedBy: {
                name: { contains: "Weekly 36", mode: "insensitive" },
              },
            },
            {
              requestedBy: {
                email: { contains: "Weekly 36", mode: "insensitive" },
              },
            },
            {
              reportSection: {
                report: {
                  weekLabel: {
                    contains: "Weekly 36",
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              reason: { contains: "Weekly 36", mode: "insensitive" },
            },
            {
              reviewNote: { contains: "Weekly 36", mode: "insensitive" },
            },
          ],
        },
      ],
    });
    expect(call.take).toBe(3);
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
    // An initially out-of-scope request is rejected before locks or writes.
    const tx = {
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: "group-1",
          }),
        ),
      },
      $queryRaw: editableGate(),
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
      select: {
        id: true,
        reportSectionId: true,
        reportSection: { select: { authorId: true } },
      },
    });
    expect(tx.reopenRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("decideReopenRequest: a loser of a concurrent decision reports already-processed", async () => {
    const tx = {
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: "group-1",
          }),
        ),
      },
      $queryRaw: editableGate(),
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "req-1",
            reportSectionId: "sec-1",
            reportSection: { authorId: "lead-1" },
          }),
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
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: "group-1",
          }),
        ),
      },
      $queryRaw: editableGate(),
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "req-1",
            reportSectionId: "sec-1",
            reportSection: { authorId: "lead-1" },
          }),
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

  it("decideReopenRequest: publish wins before approval and no row changes", async () => {
    const tx = {
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: "group-1",
          }),
        ),
      },
      $queryRaw: vi.fn(() =>
        Promise.resolve([
          {
            id: "report-1",
            status: "published",
            periodState: "published",
            periodStatus: "published",
            archived: false,
            autoPublished: false,
            autoArchived: false,
            publishedAt: new Date("2026-08-31T08:00:00.000Z"),
            publishedById: "99999999-9999-4999-8999-999999999999",
            reopenedAt: null,
          },
        ]),
      ),
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "req-1",
            reportSectionId: "sec-1",
            reportSection: { authorId: "lead-1" },
          }),
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
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(tx.reopenRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("decideReopenRequest: a stale approve auto-closes to rejected", async () => {
    const tx = {
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: "group-1",
          }),
        ),
      },
      $queryRaw: editableGate(),
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "req-1",
            reportSectionId: "sec-1",
            reportSection: { authorId: "lead-1" },
          }),
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
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: "group-1",
          }),
        ),
      },
      $queryRaw: editableGate(),
      reopenRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "req-1",
            reportSectionId: "sec-1",
            reportSection: { authorId: "lead-1" },
          }),
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

// StageAssignment DML joins the save/carry-over serialization lane: the
// status-graph advisory lock, then every editable Report row in stable id
// order, then the mutation. A compound-key P2002 recovery must reopen that
// whole sequence in a fresh transaction — never write inside the aborted one.
describe("AdminPrismaRepository — stage-assignment write serialization", () => {
  const ASSIGNMENT_ID = "a0000000-0000-4000-a000-000000000401";
  const INPUT = {
    userId: "a0000000-0000-4000-a000-000000000101",
    stageId: "a0000000-0000-4000-a000-000000000701",
    projectId: "a0000000-0000-4000-a000-000000000201",
  };
  const ROW = {
    id: ASSIGNMENT_ID,
    userId: INPUT.userId,
    stageId: INPUT.stageId,
    projectId: INPUT.projectId,
    stage: { name: "Development" },
    user: { name: "Test Lead 1" },
  };
  const PARSED = {
    id: ASSIGNMENT_ID,
    userId: INPUT.userId,
    stageId: INPUT.stageId,
    projectId: INPUT.projectId,
    stageName: "Development",
    userName: "Test Lead 1",
  };
  const COMPOUND_WHERE = {
    stageId_projectId: { stageId: INPUT.stageId, projectId: INPUT.projectId },
  };
  const RELATIONS = {
    stage: { select: { name: true } },
    user: { select: { name: true } },
  };
  const editableRow = (id: string) => ({
    id,
    status: "draft",
    periodState: "open",
    periodStatus: "open",
    archived: false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: null,
    publishedById: null,
    reopenedAt: null,
  });

  function lockedTx(
    events: string[],
    candidateIds: readonly string[],
    stageAssignment: Record<string, ReturnType<typeof vi.fn>>,
    reportGate?: Promise<unknown[]>,
  ) {
    return {
      // lockStatusGraph's advisory xact lock runs through $executeRaw.
      $executeRaw: vi.fn(() => {
        events.push("status-graph-lock");
        return Promise.resolve(0);
      }),
      report: {
        findMany: vi.fn(() => {
          events.push("editable-scan");
          return Promise.resolve(candidateIds.map((id) => ({ id })));
        }),
      },
      // lockCurrentEditableReport reads the row FOR UPDATE via $queryRaw; the
      // reportId parameter is the first bound value after the template.
      $queryRaw: vi.fn((...args: unknown[]) => {
        const reportId = String(args[1]);
        events.push(`report-lock:${reportId}`);
        return reportGate ?? Promise.resolve([editableRow(reportId)]);
      }),
      stageAssignment,
    };
  }

  function prismaForTransactions(txs: readonly ReturnType<typeof lockedTx>[]) {
    const queue = [...txs];
    const $transaction = vi.fn((run: (client: unknown) => Promise<unknown>) => {
      const tx = queue.shift();
      if (tx === undefined) {
        return Promise.reject(new Error("unexpected extra transaction"));
      }
      return run(tx);
    });
    return {
      prisma: {
        $transaction,
        // The pre-serialization code path writes through the bare client;
        // sharing the primary spies keeps the RED signal on the ordering
        // assertions instead of an early TypeError.
        stageAssignment: txs[0]?.stageAssignment,
      } as unknown as PrismaService,
      $transaction,
    };
  }

  const flushResolvedLocks = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

  it("saveStageAssignment holds the upsert until the editable-report locks resolve", async () => {
    const events: string[] = [];
    const upsert = vi.fn(() => {
      events.push("upsert");
      return Promise.resolve(ROW);
    });
    const gate = Promise.withResolvers<unknown[]>();
    const tx = lockedTx(events, ["report-1"], { upsert }, gate.promise);
    const { prisma, $transaction } = prismaForTransactions([tx]);
    const repo = new AdminPrismaRepository(prisma);

    const pending = repo.saveStageAssignment(INPUT);
    // Observe settlement up front so a failing ordering assertion cannot
    // leave the call's rejection unhandled.
    void pending.catch(() => undefined);
    try {
      await flushResolvedLocks();

      expect(events).toEqual([
        "status-graph-lock",
        "editable-scan",
        "report-lock:report-1",
      ]);
      expect(upsert).not.toHaveBeenCalled();
    } finally {
      gate.resolve([editableRow("report-1")]);
    }

    await expect(pending).resolves.toEqual(PARSED);
    expect(events).toEqual([
      "status-graph-lock",
      "editable-scan",
      "report-lock:report-1",
      "upsert",
    ]);
    expect(upsert).toHaveBeenCalledWith({
      where: COMPOUND_WHERE,
      create: INPUT,
      update: { userId: INPUT.userId },
      include: RELATIONS,
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it("saveStageAssignment locks every editable report in the stable scan order", async () => {
    const events: string[] = [];
    const upsert = vi.fn(() => {
      events.push("upsert");
      return Promise.resolve(ROW);
    });
    const tx = lockedTx(events, ["report-a", "report-b"], { upsert });
    const repo = new AdminPrismaRepository(prismaForTransactions([tx]).prisma);

    await expect(repo.saveStageAssignment(INPUT)).resolves.toEqual(PARSED);

    expect(events).toEqual([
      "status-graph-lock",
      "editable-scan",
      "report-lock:report-a",
      "report-lock:report-b",
      "upsert",
    ]);
  });

  it("deleteStageAssignment holds the delete until the editable-report locks resolve", async () => {
    const events: string[] = [];
    const deleteRow = vi.fn(() => {
      events.push("delete");
      return Promise.resolve(ROW);
    });
    const gate = Promise.withResolvers<unknown[]>();
    const tx = lockedTx(
      events,
      ["report-1"],
      { delete: deleteRow },
      gate.promise,
    );
    const repo = new AdminPrismaRepository(prismaForTransactions([tx]).prisma);

    const pending = repo.deleteStageAssignment(ASSIGNMENT_ID);
    void pending.catch(() => undefined);
    try {
      await flushResolvedLocks();

      expect(deleteRow).not.toHaveBeenCalled();
    } finally {
      gate.resolve([editableRow("report-1")]);
    }

    await expect(pending).resolves.toBeUndefined();
    expect(deleteRow).toHaveBeenCalledWith({ where: { id: ASSIGNMENT_ID } });
    expect(events).toEqual([
      "status-graph-lock",
      "editable-scan",
      "report-lock:report-1",
      "delete",
    ]);
  });

  it("deleteStageAssignment maps a missing row to a typed NOT_FOUND", async () => {
    const missing = { code: "P2025" };
    const tx = lockedTx([], ["report-1"], {
      delete: vi.fn(() => Promise.reject(missing)),
    });
    const { prisma, $transaction } = prismaForTransactions([tx]);
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.deleteStageAssignment(ASSIGNMENT_ID)).rejects.toThrow(
      AdminStageAssignmentNotFoundError,
    );
    // The failure still flows through the locked transaction, not around it.
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it("deleteStageAssignment propagates a non-P2025 failure unchanged", async () => {
    const boom = new Error("connection reset");
    const tx = lockedTx([], ["report-1"], {
      delete: vi.fn(() => Promise.reject(boom)),
    });
    const { prisma } = prismaForTransactions([tx]);
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.deleteStageAssignment(ASSIGNMENT_ID)).rejects.toBe(boom);
  });

  it("saveStageAssignment retries a compound-key P2002 in a second fully-locked transaction", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: "StageAssignment_stageId_projectId_key" },
      },
    );
    const events1: string[] = [];
    const events2: string[] = [];
    const tx1 = lockedTx(events1, ["report-1"], {
      upsert: vi.fn(() => {
        events1.push("upsert");
        return Promise.reject(conflict);
      }),
      // Resolves a real row so a baseline run reaches the forbidden
      // aborted-client reuse assertion instead of an incidental TypeError.
      update: vi.fn(() => Promise.resolve(ROW)),
    });
    const update = vi.fn(() => {
      events2.push("update");
      return Promise.resolve(ROW);
    });
    const tx2 = lockedTx(events2, ["report-1"], { update });
    const { prisma, $transaction } = prismaForTransactions([tx1, tx2]);
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.saveStageAssignment(INPUT)).resolves.toEqual(PARSED);

    // The aborted transaction's client is never reused for the recovery write.
    expect(tx1.stageAssignment.update).not.toHaveBeenCalled();
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(events1).toEqual([
      "status-graph-lock",
      "editable-scan",
      "report-lock:report-1",
      "upsert",
    ]);
    expect(events2).toEqual([
      "status-graph-lock",
      "editable-scan",
      "report-lock:report-1",
      "update",
    ]);
    expect(update).toHaveBeenCalledWith({
      where: COMPOUND_WHERE,
      data: { userId: INPUT.userId },
      include: RELATIONS,
    });
  });

  it("saveStageAssignment re-throws a non-P2002 failure without a recovery transaction", async () => {
    const original = new Error("connection reset");
    const tx = lockedTx([], ["report-1"], {
      upsert: vi.fn(() => Promise.reject(original)),
      update: vi.fn(),
    });
    const { prisma, $transaction } = prismaForTransactions([tx]);
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.saveStageAssignment(INPUT)).rejects.toBe(original);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.stageAssignment.update).not.toHaveBeenCalled();
  });

  it("saveStageAssignment re-throws a P2002 outside the stage+project scope", async () => {
    const unrelated = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: "StageAssignment_userId_key" },
      },
    );
    const tx = lockedTx([], ["report-1"], {
      upsert: vi.fn(() => Promise.reject(unrelated)),
      update: vi.fn(),
    });
    const { prisma, $transaction } = prismaForTransactions([tx]);
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.saveStageAssignment(INPUT)).rejects.toBe(unrelated);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.stageAssignment.update).not.toHaveBeenCalled();
  });

  it("listStageAssignments stays a plain ordered read outside any transaction", async () => {
    const findMany = vi.fn(() => Promise.resolve([ROW]));
    const prisma = {
      stageAssignment: { findMany },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.listStageAssignments(INPUT.projectId)).resolves.toEqual([
      PARSED,
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: INPUT.projectId },
      include: RELATIONS,
      orderBy: { createdAt: "asc" },
    });
  });
});
