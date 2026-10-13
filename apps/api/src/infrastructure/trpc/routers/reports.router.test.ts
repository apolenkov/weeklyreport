import type { Role, SubmitSectionPayload } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { ReportSectionsService } from "../../../modules/report-sections/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import {
  AUTHOR_ID,
  baseSection,
  createRepository,
  NOOP_REPORT_SECTIONS_TELEMETRY,
  PROJECT_ID_1,
  SECTION_ID,
  validDraft,
} from "../../../test-utils/report-section-write-fixture.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import { createReportsRouter } from "./reports.router.js";

const FOREIGN_USER_ID = "99999999-9999-4999-8999-999999999999";
const contentActions = ["saveDraft", "submit"] as const;

function contentInput(): SubmitSectionPayload {
  return {
    ...validDraft({
      items: baseSection.items.map((item) => ({
        ...item,
        text: "Updated content",
      })),
    }),
    confirmed: true,
    projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" }],
    activityStatuses: [],
    stageStatuses: [
      {
        projectId: PROJECT_ID_1,
        stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "green" as const,
      },
    ],
  };
}

function setup(role: Role | null, userId = AUTHOR_ID) {
  const repository = createRepository(baseSection);
  const reportSectionsService = new ReportSectionsService(
    repository,
    NOOP_REPORT_SECTIONS_TELEMETRY,
    createNullLogger(),
  );
  const auditLogger = {
    ...createNullAuditLogger(),
    roleDenied: vi.fn(),
    mutation: vi.fn(),
  };
  const deps = createStubAppRouterDeps({ reportSectionsService });
  const caller = createReportsRouter({
    reportSectionsService,
    weeklyReportService: deps.weeklyReportService,
  }).createCaller({
    session:
      role === null
        ? null
        : {
            userId,
            role,
            email: "synthetic@task503.invalid",
            name: "Synthetic actor",
            activeReportId: baseSection.reportId,
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

describe.each(contentActions)(
  "reports.%s content role and ownership",
  (action) => {
    it("denies a Viewer who still authors the section without changing content and audits the denial", async () => {
      const { caller, repository, auditLogger } = setup("viewer");
      const before = await repository.getSectionById(SECTION_ID);

      await expect(caller[action](contentInput())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(await repository.getSectionById(SECTION_ID)).toEqual(before);
      expect(auditLogger.roleDenied).toHaveBeenCalledOnce();
      expect(auditLogger.roleDenied).toHaveBeenCalledWith({
        userId: AUTHOR_ID,
        role: "viewer",
        attemptedRole: ["lead", "head", "admin"],
        ip: "test-ip",
      });
      expect(auditLogger.mutation).toHaveBeenCalledOnce();
      expect(auditLogger.mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          procedure: action,
          userId: AUTHOR_ID,
          role: "viewer",
          target: SECTION_ID,
          status: "fail",
          reason: "FORBIDDEN",
        }),
      );
    });

    it.each(["lead", "head", "admin"] as const)(
      "allows %s to write their own editable section",
      async (role) => {
        const { caller, repository, auditLogger } = setup(role);
        const saved = await caller[action](contentInput());

        expect(saved).toMatchObject({
          authorId: AUTHOR_ID,
          status: action === "submit" ? "submitted" : "draft",
        });
        expect(saved.items[0]?.text).toBe("Updated content");
        expect(await repository.getSectionById(SECTION_ID)).toEqual(saved);
        expect(auditLogger.roleDenied).not.toHaveBeenCalled();
        expect(auditLogger.mutation).toHaveBeenCalledWith(
          expect.objectContaining({ status: "success", role }),
        );
      },
    );

    it.each(["lead", "head", "admin"] as const)(
      "retains the service author guard for a foreign %s caller",
      async (role) => {
        const { caller, repository, auditLogger } = setup(
          role,
          FOREIGN_USER_ID,
        );
        const before = await repository.getSectionById(SECTION_ID);

        await expect(caller[action](contentInput())).rejects.toMatchObject({
          code: "FORBIDDEN",
          message: "Can only edit your own section.",
        });
        expect(await repository.getSectionById(SECTION_ID)).toEqual(before);
        expect(auditLogger.roleDenied).not.toHaveBeenCalled();
      },
    );

    it("retains unauthenticated rejection", async () => {
      const { caller } = setup(null);
      await expect(caller[action](contentInput())).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  },
);

it("retains the authenticated Viewer active-section read", async () => {
  const { caller } = setup("viewer");
  expect(await caller.getActive()).toMatchObject({
    reportSectionId: SECTION_ID,
    authorId: AUTHOR_ID,
    version: 1,
  });
});
