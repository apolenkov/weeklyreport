import type { PeriodState } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { mapDomainError } from "../../infrastructure/trpc/trpc.error-mapper.js";
import type { AppLogger } from "../../lib/logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { unusedAdminRepositoryStubs } from "./admin-repository-unused-stubs.js";
import { AdminAccessError, type AdminRepository } from "./admin-shared.js";
import { PeriodAdminService } from "./period-admin.service.js";

const REPORT_ID = "77777777-7777-4777-8777-777777777701";

// A logger spy that records every info message so tests can assert whether a
// success log was emitted at all — not just that the write resolved.
function createLoggerSpy(): AppLogger & { info: ReturnType<typeof vi.fn> } {
  const info = vi.fn();
  const logger: AppLogger = {
    debug: vi.fn(),
    info: info as AppLogger["info"],
    warn: vi.fn(),
    error: vi.fn(),
    child: createNullLogger,
  };
  return { ...logger, info };
}

interface SeedRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  weekLabel: string | null;
  periodState: PeriodState;
}

function seedRow(periodState: PeriodState): SeedRow {
  return {
    id: REPORT_ID,
    periodStart: new Date("2026-05-04T00:00:00.000Z"),
    periodEnd: new Date("2026-05-10T23:59:59.999Z"),
    deadline: new Date("2026-05-09T15:00:00.000Z"),
    weekLabel: "Sprint 11",
    periodState,
  };
}

// Minimal AdminRepository: only the three methods `updatePeriodManual` touches
// are functional; the rest throws because this suite never exercises it. The
// updatePeriodManual spy lets each test assert whether a write was attempted.
function createRepository(row: SeedRow): AdminRepository & {
  updatePeriodManual: ReturnType<typeof vi.fn>;
} {
  const updatePeriodManual = vi.fn(
    (input: {
      reportId: string;
      expectedPeriodState: PeriodState;
      data: {
        periodStart?: Date;
        periodEnd?: Date;
        deadline?: Date | null;
        weekLabel?: string | null;
      };
    }) =>
      Promise.resolve({
        id: row.id,
        periodStart: input.data.periodStart ?? row.periodStart,
        periodEnd: input.data.periodEnd ?? row.periodEnd,
        deadline:
          input.data.deadline === undefined
            ? row.deadline
            : input.data.deadline,
        weekLabel:
          input.data.weekLabel === undefined
            ? row.weekLabel
            : input.data.weekLabel,
        periodState: row.periodState,
      }),
  );

  const unused = (): never => {
    throw new Error("not exercised by period-admin updatePeriodManual tests");
  };

  return {
    ...unusedAdminRepositoryStubs(),
    getSnapshot: unused,
    saveSnapshot: unused,
    upsertUser: unused,
    removeUser: unused,
    upsertProject: unused,
    removeProject: unused,
    getSettings: unused,
    updateSettings: unused,
    saveReportingGroup: unused,
    archiveReportingGroup: unused,
    saveStageAssignment: unused,
    deleteStageAssignment: unused,
    listStageAssignments: unused,
    readPeriodById: () => Promise.resolve({ ...row }),
    findOverlappingPeriod: () => Promise.resolve(null),
    updatePeriodManual,
  };
}

describe("PeriodAdminService — updatePeriodManual published guard", () => {
  it("rejects a deadline edit on a published period (no write)", async () => {
    const repo = createRepository(seedRow("published"));
    const service = new PeriodAdminService(repo);

    await expect(
      service.updatePeriodManual({
        reportId: REPORT_ID,
        deadline: new Date("2026-05-10T15:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminAccessError);
    expect(repo.updatePeriodManual).not.toHaveBeenCalled();
  });

  it("rejects a periodStart edit on a published period (no write)", async () => {
    const repo = createRepository(seedRow("published"));
    const service = new PeriodAdminService(repo);

    await expect(
      service.updatePeriodManual({
        reportId: REPORT_ID,
        periodStart: new Date("2026-05-05T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminAccessError);
    expect(repo.updatePeriodManual).not.toHaveBeenCalled();
  });

  it("rejects a date-envelope edit on an archived period (no write)", async () => {
    const repo = createRepository(seedRow("archived"));
    const service = new PeriodAdminService(repo);

    await expect(
      service.updatePeriodManual({
        reportId: REPORT_ID,
        periodEnd: new Date("2026-05-12T23:59:59.999Z"),
      }),
    ).rejects.toBeInstanceOf(AdminAccessError);
    expect(repo.updatePeriodManual).not.toHaveBeenCalled();
  });

  it("allows a weekLabel-only edit on a published period", async () => {
    const repo = createRepository(seedRow("published"));
    const service = new PeriodAdminService(repo);

    const { result } = await service.updatePeriodManual({
      reportId: REPORT_ID,
      weekLabel: "Sprint 11 (final)",
    });

    expect(result.weekLabel).toBe("Sprint 11 (final)");
    expect(repo.updatePeriodManual).toHaveBeenCalledOnce();
  });

  it("allows an envelope edit on an open period (boundary)", async () => {
    const repo = createRepository(seedRow("open"));
    const service = new PeriodAdminService(repo);

    const { result } = await service.updatePeriodManual({
      reportId: REPORT_ID,
      deadline: new Date("2026-05-10T15:00:00.000Z"),
    });

    expect(expectDefined(result.deadline).toISOString()).toBe(
      "2026-05-10T15:00:00.000Z",
    );
    expect(repo.updatePeriodManual).toHaveBeenCalledOnce();
  });

  it("preserves an explicit deadline clear through the repository seam", async () => {
    const repo = createRepository(seedRow("open"));
    const service = new PeriodAdminService(repo);

    const { result } = await service.updatePeriodManual({
      reportId: REPORT_ID,
      deadline: null,
    });

    expect(result.deadline).toBeNull();
    expect(repo.updatePeriodManual).toHaveBeenCalledWith({
      reportId: REPORT_ID,
      expectedPeriodState: "open",
      data: { deadline: null },
    });
  });

  it("allows an envelope edit on a reopened (now open) period", async () => {
    // Reopen reverts periodState to "open"; the guard keys on the live state,
    // so a once-published-now-reopened period is editable again.
    const repo = createRepository(seedRow("open"));
    const service = new PeriodAdminService(repo);

    await service.updatePeriodManual({
      reportId: REPORT_ID,
      periodEnd: new Date("2026-05-12T23:59:59.999Z"),
    });

    expect(repo.updatePeriodManual).toHaveBeenCalledOnce();
  });

  it("maps the published-edit rejection to FORBIDDEN (matching deleteReport)", async () => {
    const repo = createRepository(seedRow("published"));
    const service = new PeriodAdminService(repo);

    const error = await service
      .updatePeriodManual({
        reportId: REPORT_ID,
        periodEnd: new Date("2026-05-12T23:59:59.999Z"),
      })
      .catch((error_: unknown) => error_);

    expect(mapDomainError(error).code).toBe("FORBIDDEN");
  });
});

describe("PeriodAdminService — success logs settle only after the write", () => {
  it("archivePeriod emits NO success log when the write fails", async () => {
    const logger = createLoggerSpy();
    const repo = {
      ...createRepository(seedRow("open")),
      archivePeriod: vi.fn(() => Promise.reject(new Error("archive failed"))),
    };
    const service = new PeriodAdminService(repo, logger);

    await expect(service.archivePeriod(REPORT_ID)).rejects.toThrow(
      "archive failed",
    );

    expect(logger.info).not.toHaveBeenCalledWith(
      "archived period",
      expect.objectContaining({ periodId: REPORT_ID }),
    );
  });

  it("archivePeriod emits the success log only after the write settles", async () => {
    const logger = createLoggerSpy();
    const repo = {
      ...createRepository(seedRow("open")),
      archivePeriod: vi.fn(() => Promise.resolve()),
    };
    const service = new PeriodAdminService(repo, logger);

    await service.archivePeriod(REPORT_ID);

    expect(repo.archivePeriod).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      "archived period",
      expect.objectContaining({ periodId: REPORT_ID }),
    );
  });

  it("deleteReport emits NO success log when the write fails", async () => {
    const logger = createLoggerSpy();
    const repo = {
      ...createRepository(seedRow("open")),
      deleteReport: vi.fn(() => Promise.reject(new Error("delete failed"))),
    };
    const service = new PeriodAdminService(repo, logger);

    await expect(service.deleteReport(REPORT_ID)).rejects.toThrow(
      "delete failed",
    );

    expect(logger.info).not.toHaveBeenCalledWith(
      "deleted report",
      expect.objectContaining({ reportId: REPORT_ID }),
    );
  });

  it("unarchivePeriod emits NO success log when the write fails", async () => {
    const logger = createLoggerSpy();
    const repo = {
      ...createRepository(seedRow("open")),
      unarchivePeriod: vi.fn(() =>
        Promise.reject(new Error("unarchive failed")),
      ),
    };
    const service = new PeriodAdminService(repo, logger);

    await expect(service.unarchivePeriod(REPORT_ID)).rejects.toThrow(
      "unarchive failed",
    );

    expect(logger.info).not.toHaveBeenCalledWith(
      "unarchived period",
      expect.objectContaining({ periodId: REPORT_ID }),
    );
  });
});
