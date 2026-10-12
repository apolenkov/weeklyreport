import type { PdfRecoveryJob, Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import {
  ActionLogService,
  type JobsService,
} from "../../../../modules/admin/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "../../trpc.router.js";

const ACTION_ROW = {
  id: "action-1",
  userId: "admin-user",
  role: "admin" as const,
  procedure: "admin.updateUser",
  targetId: null,
  status: "success" as const,
  reason: null,
  ip: null,
  correlationId: "request-1",
  durationMs: 8,
  createdAt: new Date("2026-08-14T10:15:30.000Z"),
};

function buildAdminCaller() {
  const deps = {} as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session: {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "admin@test.local",
      name: "Admin User",
      role: "admin",
      activeReportId: null,
      activeReportSectionId: null,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

function buildActionLogCaller(actionLogService: ActionLogService, role: Role) {
  const deps = createStubAppRouterDeps({ actionLogService });
  return createAppRouter(deps).createCaller({
    session: {
      userId: "44444444-4444-4444-8444-444444444444",
      email: `${role}@test.local`,
      name: `${role} User`,
      role,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

function buildJobsCaller(jobsService: JobsService, role: Role) {
  const deps = createStubAppRouterDeps({ jobsService });
  return createAppRouter(deps).createCaller({
    session: {
      userId: "44444444-4444-4444-8444-444444444444",
      email: `${role}@test.local`,
      name: `${role} User`,
      role,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("admin ops dependency wiring", () => {
  it("dlqCount fails loud when the jobs service is unwired", async () => {
    await expect(buildAdminCaller().admin.dlqCount()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });

  it("jobs.retryFailed fails loud when the jobs service is unwired", async () => {
    await expect(
      buildAdminCaller().admin.jobs.retryFailed({
        queue: "email-reminder",
        jobId: "job-1",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });

  it("jobs.listFailed fails loud when the jobs service is unwired", async () => {
    await expect(
      buildAdminCaller().admin.jobs.listFailed({ queue: "email-reminder" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });

  it("jobs.listPdfRecovery fails loud when the jobs service is unwired", async () => {
    await expect(
      buildAdminCaller().admin.jobs.listPdfRecovery(),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });

  it("jobs.retryPdfRecovery fails loud when the jobs service is unwired", async () => {
    await expect(
      buildAdminCaller().admin.jobs.retryPdfRecovery(RECOVERY_RETRY_INPUT),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });
});

describe("admin action log contract", () => {
  it("returns the strict allowlisted page to an admin", async () => {
    const listActionLog = vi.fn().mockResolvedValue([ACTION_ROW]);
    const service = new ActionLogService({ listActionLog });

    await expect(
      buildActionLogCaller(service, "admin").admin.actionLog.list({
        limit: 20,
      }),
    ).resolves.toEqual({
      items: [{ ...ACTION_ROW, createdAt: "2026-08-14T10:15:30.000Z" }],
      nextCursor: null,
    });
  });

  it.each(["lead", "head", "viewer"] as const)(
    "rejects the %s role without reading the repository",
    async (role) => {
      const listActionLog = vi.fn().mockResolvedValue([ACTION_ROW]);
      const service = new ActionLogService({ listActionLog });

      await expect(
        buildActionLogCaller(service, role).admin.actionLog.list({ limit: 20 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(listActionLog).not.toHaveBeenCalled();
    },
  );

  it("rejects a service response containing a field outside the DTO", async () => {
    const unsafeService = {
      list: () =>
        Promise.resolve({
          items: [
            {
              ...ACTION_ROW,
              createdAt: "2026-08-14T10:15:30.000Z",
              rawPayload: { secret: true },
            },
          ],
          nextCursor: null,
        }),
    } as unknown as ActionLogService;

    await expect(
      buildActionLogCaller(unsafeService, "admin").admin.actionLog.list({
        limit: 20,
      }),
    ).rejects.toThrow();
  });
});

describe("jobs contract uses the canonical Head authority", () => {
  function makeJobsService() {
    const listFailed = vi.fn().mockResolvedValue({
      jobs: [],
      nextCursor: null,
    });
    const retryFailed = vi.fn().mockResolvedValue({
      retried: true,
      jobId: "job-1",
    });
    const removeFailed = vi.fn().mockResolvedValue({
      removed: true,
      jobId: "job-1",
    });
    const service = {
      listFailed,
      retryFailed,
      removeFailed,
    } as unknown as JobsService;
    return { service, listFailed, retryFailed, removeFailed };
  }

  it("dlqCount returns the total and per-queue counts from JobsService", async () => {
    const counts = {
      count: 3,
      byQueue: [
        { queue: "email-reminder", count: 0 },
        { queue: "pdf-export", count: 3 },
      ],
    };
    const countFailed = vi.fn().mockResolvedValue(counts);
    const service = { countFailed } as unknown as JobsService;

    await expect(
      buildJobsCaller(service, "admin").admin.dlqCount(),
    ).resolves.toEqual(counts);
    expect(countFailed).toHaveBeenCalledOnce();
  });

  it("allows a head to list, retry, and remove failed jobs", async () => {
    const { service, listFailed, retryFailed, removeFailed } =
      makeJobsService();
    const caller = buildJobsCaller(service, "head");
    const input = { queue: "pdf-export" as const, jobId: "job-1" };

    await expect(
      caller.admin.jobs.listFailed({ queue: input.queue }),
    ).resolves.toEqual({ jobs: [], nextCursor: null });
    await expect(caller.admin.jobs.retryFailed(input)).resolves.toEqual({
      retried: true,
      jobId: "job-1",
    });
    await expect(caller.admin.jobs.removeFailed(input)).resolves.toEqual({
      removed: true,
      jobId: "job-1",
    });

    expect(listFailed).toHaveBeenCalledOnce();
    expect(retryFailed).toHaveBeenCalledOnce();
    expect(removeFailed).toHaveBeenCalledOnce();
  });

  it.each(["lead", "viewer"] as const)(
    "rejects the %s role before reading or mutating queue state",
    async (role) => {
      const { service, listFailed, retryFailed, removeFailed } =
        makeJobsService();
      const caller = buildJobsCaller(service, role);
      const input = { queue: "pdf-export" as const, jobId: "job-1" };

      await expect(
        caller.admin.jobs.listFailed({ queue: input.queue }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.admin.jobs.retryFailed(input)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller.admin.jobs.removeFailed(input)).rejects.toMatchObject(
        {
          code: "FORBIDDEN",
        },
      );

      expect(listFailed).not.toHaveBeenCalled();
      expect(retryFailed).not.toHaveBeenCalled();
      expect(removeFailed).not.toHaveBeenCalled();
    },
  );
});

const RECOVERY_ROW: PdfRecoveryJob = {
  jobId: "55555555-5555-4555-8555-555555555555",
  reportId: "66666666-6666-4666-8666-666666666666",
  generation: 2,
  requestedBy: "77777777-7777-4777-8777-777777777777",
  status: "recovery_required",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
};

const RECOVERY_RETRY_INPUT = {
  jobId: RECOVERY_ROW.jobId,
  expectedGeneration: RECOVERY_ROW.generation,
};

describe("jobs pdf recovery contract", () => {
  function makeRecoveryService() {
    const listPdfRecovery = vi.fn().mockResolvedValue({
      jobs: [RECOVERY_ROW],
    });
    const retryPdfRecovery = vi.fn().mockResolvedValue({
      jobId: RECOVERY_ROW.jobId,
      outcome: "retried" as const,
    });
    const service = {
      listPdfRecovery,
      retryPdfRecovery,
    } as unknown as JobsService;
    return { service, listPdfRecovery, retryPdfRecovery };
  }

  it.each(["head", "admin"] as const)(
    "lets a %s list quarantined exports from the durable side",
    async (role) => {
      const { service, listPdfRecovery } = makeRecoveryService();

      await expect(
        buildJobsCaller(service, role).admin.jobs.listPdfRecovery(),
      ).resolves.toEqual({ jobs: [RECOVERY_ROW] });
      expect(listPdfRecovery).toHaveBeenCalledOnce();
    },
  );

  it.each(["lead", "viewer"] as const)(
    "rejects the %s role before listing quarantined exports",
    async (role) => {
      const { service, listPdfRecovery } = makeRecoveryService();

      await expect(
        buildJobsCaller(service, role).admin.jobs.listPdfRecovery(),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(listPdfRecovery).not.toHaveBeenCalled();
    },
  );

  it.each(["retried", "already-advanced", "ineligible"] as const)(
    "passes the caller-selected generation through and reports the verbatim %s outcome",
    async (outcome) => {
      const { service, retryPdfRecovery } = makeRecoveryService();
      retryPdfRecovery.mockResolvedValue({
        jobId: RECOVERY_ROW.jobId,
        outcome,
      });

      await expect(
        buildJobsCaller(service, "head").admin.jobs.retryPdfRecovery(
          RECOVERY_RETRY_INPUT,
        ),
      ).resolves.toEqual({ jobId: RECOVERY_ROW.jobId, outcome });
      expect(retryPdfRecovery).toHaveBeenCalledWith(RECOVERY_RETRY_INPUT);
    },
  );

  it.each(["lead", "viewer"] as const)(
    "rejects the %s role before a recovery retry can reach the service",
    async (role) => {
      const { service, retryPdfRecovery } = makeRecoveryService();

      await expect(
        buildJobsCaller(service, role).admin.jobs.retryPdfRecovery(
          RECOVERY_RETRY_INPUT,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(retryPdfRecovery).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ jobId: "not-a-uuid", expectedGeneration: 1 }],
    [{ jobId: RECOVERY_ROW.jobId, expectedGeneration: 0 }],
    [{ jobId: RECOVERY_ROW.jobId, expectedGeneration: 1.5 }],
    [{ jobId: RECOVERY_ROW.jobId }],
  ])(
    "rejects malformed retry input %o before the service runs",
    async (input) => {
      const { service, retryPdfRecovery } = makeRecoveryService();

      await expect(
        buildJobsCaller(service, "head").admin.jobs.retryPdfRecovery(
          input as typeof RECOVERY_RETRY_INPUT,
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(retryPdfRecovery).not.toHaveBeenCalled();
    },
  );
});
