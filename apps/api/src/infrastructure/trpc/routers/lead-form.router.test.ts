import { TRPCError } from "@trpc/server";
import type { Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../lib/logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import {
  LeadFormAccessError,
  LeadFormDomainError,
  LeadFormService,
} from "../../../modules/report-sections/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import {
  createMockRepository,
  draftSection,
  OTHER_USER_ID,
  SOURCE_SECTION_ID,
} from "../../../test-utils/lead-form-write-fixture.js";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../../../test-utils/report-section-write-fixture.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import { createLeadFormRouter } from "./lead-form.router.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

const output = {
  current: {
    reportId: REPORT_ID,
    periodStart: new Date("2026-08-24T00:00:00.000Z"),
    periodEnd: new Date("2026-08-30T23:59:59.999Z"),
    section: {
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: USER_ID,
      authorName: "Lead One",
      authorRole: "lead" as const,
      version: 1,
      status: "draft" as const,
      submittedAt: null,
      late: false,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    },
  },
  predecessor: {
    availability: "unavailable" as const,
    reason: "no_predecessor" as const,
  },
};

function caller(
  getStatusOverview: Pick<
    LeadFormService,
    "getStatusOverview"
  >["getStatusOverview"],
) {
  const leadFormService = {
    getStatusOverview,
  } satisfies Pick<LeadFormService, "getStatusOverview">;
  const router = createLeadFormRouter(
    createStubAppRouterDeps({ leadFormService }),
  );
  return router.createCaller({
    session: {
      userId: USER_ID,
      email: "lead@test.local",
      name: "Lead One",
      role: "lead",
      viewerGroupAccess: [],
      activeReportId: REPORT_ID,
      activeReportSectionId: SECTION_ID,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("leadForm.statusOverview", () => {
  it("validates input and output on the canonical protected query", async () => {
    const getStatusOverview = vi.fn().mockResolvedValue(output);

    await expect(
      caller(getStatusOverview).statusOverview({ reportId: REPORT_ID }),
    ).resolves.toEqual(output);
    expect(getStatusOverview).toHaveBeenCalledWith(
      REPORT_ID,
      USER_ID,
      "lead",
      undefined,
    );
  });

  it("rejects malformed input before calling the read module", async () => {
    const getStatusOverview = vi.fn();

    await expect(
      caller(getStatusOverview).statusOverview({ reportId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(getStatusOverview).not.toHaveBeenCalled();
  });

  it("rejects malformed module output at the transport boundary", async () => {
    const getStatusOverview = vi.fn().mockResolvedValue({
      ...output,
      predecessor: {
        availability: "available",
        source: "submitted",
        reportId: REPORT_ID,
        periodStart: new Date("2026-08-17T00:00:00.000Z"),
        periodEnd: new Date("2026-08-23T23:59:59.999Z"),
        section: { status: "draft" },
      },
    });

    await expect(
      caller(getStatusOverview).statusOverview({ reportId: REPORT_ID }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

const spyLogger = (): AppLogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
});

function byPeriodCaller(
  getByPeriod: Pick<LeadFormService, "getByPeriod">["getByPeriod"],
  logger: AppLogger,
) {
  const leadFormService = {
    getByPeriod,
  } satisfies Pick<LeadFormService, "getByPeriod">;
  const router = createLeadFormRouter(
    createStubAppRouterDeps({ leadFormService }),
  );
  return router.createCaller({
    session: {
      userId: USER_ID,
      email: "lead@test.local",
      name: "Lead One",
      role: "lead",
      viewerGroupAccess: [],
      activeReportId: REPORT_ID,
      activeReportSectionId: SECTION_ID,
    },
    logger,
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

// Expected refusals log at warn; operational faults keep error severity.
describe("leadForm.byPeriod refusal severity", () => {
  it.each([
    {
      kind: "foreign-author scope denial",
      error: new LeadFormAccessError(
        "Cannot read another lead's section without a shared product.",
      ),
      code: "FORBIDDEN",
      level: "warn",
    },
    {
      kind: "missing section",
      error: new LeadFormDomainError("No section found for user in report."),
      code: "NOT_FOUND",
      level: "warn",
    },
  ] as const)(
    "logs an expected $kind at warn and keeps $code",
    async ({ error, code, level }) => {
      const logger = spyLogger();
      const getByPeriod = vi.fn().mockRejectedValue(error);

      await expect(
        byPeriodCaller(getByPeriod, logger).byPeriod({
          reportId: REPORT_ID,
          authorId: "44444444-4444-4444-8444-444444444444",
        }),
      ).rejects.toMatchObject({ code });

      expect(logger[level]).toHaveBeenCalledWith(
        "lead form load failed",
        expect.objectContaining({ procedure: "leadForm.byPeriod" }),
      );
      // The generic "trpc request end" middleware log may still fire; the
      // procedure-level refusal line must not go through error severity.
      expect(logger.error).not.toHaveBeenCalledWith(
        "lead form load failed",
        expect.anything(),
      );
    },
  );

  it("logs an unknown failure at error and keeps INTERNAL_SERVER_ERROR", async () => {
    const logger = spyLogger();
    const getByPeriod = vi
      .fn()
      .mockRejectedValue(new Error("connection reset"));

    await expect(
      byPeriodCaller(getByPeriod, logger).byPeriod({ reportId: REPORT_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(logger.error).toHaveBeenCalledWith(
      "lead form load failed",
      expect.objectContaining({ procedure: "leadForm.byPeriod" }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

const fillInput = {
  targetSectionId: SECTION_ID,
  sourceSectionId: SOURCE_SECTION_ID,
  version: 1,
};

function fillCaller(
  role: Role | null,
  userId = USER_ID,
  foreignSource = false,
) {
  let target = {
    ...structuredClone(draftSection),
    reportSectionId: SECTION_ID,
  };
  const source = {
    ...structuredClone(draftSection),
    reportSectionId: SOURCE_SECTION_ID,
    authorId: foreignSource ? OTHER_USER_ID : USER_ID,
    items: draftSection.items.map((item) => ({
      ...item,
      text: "Copied source content",
    })),
  };
  const repository = createMockRepository({
    getSectionById: (id) => {
      if (id === SECTION_ID) return Promise.resolve(structuredClone(target));
      return Promise.resolve(
        id === SOURCE_SECTION_ID ? structuredClone(source) : null,
      );
    },
    fillFromSection: () => {
      target = {
        ...target,
        items: structuredClone(source.items),
        version: target.version + 1,
      };
      return Promise.resolve(source.items.length);
    },
  });
  const leadFormService = new LeadFormService(
    repository,
    NOOP_REPORT_SECTIONS_TELEMETRY,
  );
  const auditLogger = {
    ...createNullAuditLogger(),
    roleDenied: vi.fn(),
    mutation: vi.fn(),
  };
  const caller = createLeadFormRouter(
    createStubAppRouterDeps({ leadFormService }),
  ).createCaller({
    session:
      role === null
        ? null
        : {
            userId,
            role,
            email: "synthetic@task503.invalid",
            name: "Synthetic actor",
            activeReportId: REPORT_ID,
            activeReportSectionId: SECTION_ID,
          },
    logger: createNullLogger(),
    auditLogger,
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, repository, auditLogger };
}

describe("leadForm.fillFrom content role and ownership", () => {
  it("denies a retained Viewer author without copying content and emits both audit events", async () => {
    const { caller, repository, auditLogger } = fillCaller("viewer");
    const before = await repository.getSectionById(SECTION_ID);

    await expect(caller.fillFrom(fillInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(await repository.getSectionById(SECTION_ID)).toEqual(before);
    expect(auditLogger.roleDenied).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      role: "viewer",
      attemptedRole: ["lead", "head", "admin"],
      ip: "test-ip",
    });
    expect(auditLogger.mutation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        procedure: "fillFrom",
        userId: USER_ID,
        role: "viewer",
        status: "fail",
        reason: "FORBIDDEN",
      }),
    );
  });

  it.each(["lead", "head", "admin"] as const)(
    "allows %s to copy between their own sections",
    async (role) => {
      const { caller, repository, auditLogger } = fillCaller(role);
      const result = await caller.fillFrom(fillInput);

      expect(result).toMatchObject({ success: true, copiedItems: 1 });
      const saved = await repository.getSectionById(SECTION_ID);
      expect(saved).toMatchObject({ authorId: USER_ID, version: 2 });
      expect(saved?.items[0]?.text).toBe("Copied source content");
      expect(result.section).toEqual(saved);
      expect(auditLogger.roleDenied).not.toHaveBeenCalled();
      expect(auditLogger.mutation).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success", role }),
      );
    },
  );

  describe.each(["lead", "head", "admin"] as const)("%s ownership", (role) => {
    it.each(["target", "source"] as const)(
      "rejects a foreign %s without copying content",
      async (foreign) => {
        const { caller, repository, auditLogger } = fillCaller(
          role,
          foreign === "target" ? OTHER_USER_ID : USER_ID,
          foreign === "source",
        );
        const before = await repository.getSectionById(SECTION_ID);

        await expect(caller.fillFrom(fillInput)).rejects.toMatchObject({
          code: "FORBIDDEN",
          message:
            foreign === "target"
              ? "Can only fill your own section."
              : "Can only fill from your own section.",
        });
        expect(await repository.getSectionById(SECTION_ID)).toEqual(before);
        expect(auditLogger.roleDenied).not.toHaveBeenCalled();
      },
    );
  });

  it("retains unauthenticated rejection without copying content", async () => {
    const { caller, repository } = fillCaller(null);
    const before = await repository.getSectionById(SECTION_ID);

    await expect(caller.fillFrom(fillInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await repository.getSectionById(SECTION_ID)).toEqual(before);
  });
});
