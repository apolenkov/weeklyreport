import type { Role } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import {
  ActionLogService,
  type JobsService,
} from "../../../../modules/admin/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
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
  const deps = { actionLogService } as Parameters<typeof createAppRouter>[0];
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
  const deps = { jobsService } as Parameters<typeof createAppRouter>[0];
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

  it("dlqCount reads the count from JobsService", async () => {
    const countFailed = vi.fn().mockResolvedValue(3);
    const service = { countFailed } as unknown as JobsService;

    await expect(
      buildJobsCaller(service, "admin").admin.dlqCount(),
    ).resolves.toEqual({ count: 3 });
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
