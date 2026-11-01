// Real-DB coverage that content writes (reports.saveDraft, reports.submit,
// leadForm.fillFrom) take the role from the database on every request. A Lead
// demoted to Viewer keeps the same session cookie and must be refused, and a
// Head or Admin must not write a section they do not author.
import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import {
  AUTH_COOKIE_NAME,
  type DraftSavePayload,
  type SubmitSectionPayload,
  type UserSession,
} from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createContextFactory } from "../../../infrastructure/trpc/trpc.context.js";
import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createAuthController } from "../../../modules/auth/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import {
  LeadFormPrismaRepository,
  LeadFormService,
  ReportSectionsService,
} from "../index.js";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository.js";

const env = {
  NODE_ENV: "test",
  AUTH_DEV_MODE: false,
  AUTH_JWT_SECRET: "content-write-roles-session-secret-0123456789",
  PDF_EXPORT_JWT_SECRET: "content-write-roles-pdf-export-secret-0123456789",
} as const;
const ADMIN_ID = "a0000000-0000-4000-a000-0000000000ad";
const ALLOWED_ROLES = ["lead", "head", "admin"] as const;
const STAGE_ID = "a1000000-0000-4000-a000-000000000001";
const STAGE_NAME = "Content write fixture";

const prisma = createTestPrisma();
const prismaService = prisma as unknown as PrismaService;
const notRevoked = { isRevoked: () => Promise.resolve(false) };
const nestApp = {
  get: (token: unknown) => (token === PrismaService ? prisma : notRevoked),
} as unknown as INestApplication;

// Local no-op telemetry: the module index does not export the shared one.
const NOOP_TELEMETRY = {
  recordCrossAuthorRead: () => undefined,
  recordReopenRequest: () => undefined,
  recordSectionSubmitted: () => undefined,
  observeSubmissionLatency: () => undefined,
};
const sectionRepository = new ReportSectionsPrismaRepository(prismaService);
const reportSectionsService = new ReportSectionsService(
  sectionRepository,
  NOOP_TELEMETRY,
  createNullLogger(),
);
const leadFormService = new LeadFormService(
  new LeadFormPrismaRepository(prismaService),
  NOOP_TELEMETRY,
);

function createSpy() {
  return {
    ...createNullAuditLogger(),
    roleDenied: vi.fn(),
    mutation: vi.fn(),
  };
}

type AuditSpy = ReturnType<typeof createSpy>;

function sessionFor(userId: string, role: UserSession["role"]): UserSession {
  return {
    userId,
    email: `${role}-content@test.local`,
    name: `Synthetic ${role}`,
    role,
    reportingGroupId: TEST_IDS.group,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

// Every call builds a fresh context from the cookie, so the role is re-read
// from the database exactly as a real request would do it.
async function callerFor(
  userId: string,
  role: UserSession["role"],
  spy: AuditSpy,
) {
  const { token } = createAuthController(env).issueSessionCookie(
    sessionFor(userId, role),
  );
  const createContext = createContextFactory(nestApp, createNullLogger(), env);
  const ctx = await createContext({
    req: { cookies: { [AUTH_COOKIE_NAME]: token }, headers: {} },
  } as unknown as CreateExpressContextOptions);
  return createAppRouter(
    createStubAppRouterDeps({
      prisma,
      reportSectionsService,
      leadFormService,
    }),
  ).createCaller({ ...ctx, auditLogger: spy });
}

async function demoteLeadToViewer(): Promise<void> {
  await prisma.user.update({
    where: { id: TEST_IDS.lead },
    data: { role: "viewer" },
  });
}

const sectionRow = (sectionId: string) =>
  prisma.reportSection.findUnique({
    where: { id: sectionId },
    include: { items: true },
  });

// Minimal schema-valid draft: one current item in the fixture stage. Only the
// text differs between attempts; the expected version is passed in.
function draftPayload(
  reportSectionId: string,
  version: number,
  projectId: string,
  text: string,
): DraftSavePayload {
  return {
    reportSectionId,
    version,
    status: "draft",
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: [],
    items: [
      {
        projectId,
        type: "current",
        text,
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [STAGE_NAME],
      },
    ],
    risks: [],
    decisions: [],
  };
}

function submitPayload(
  draft: DraftSavePayload,
  projectId: string,
): SubmitSectionPayload {
  return {
    ...draft,
    confirmed: true,
    projectStatuses: [{ projectId, status: "green" }],
    activityStatuses: [],
  };
}

describe("content writes take the role from the database (integration)", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let foreignSourceId: string;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await prisma.stage.create({
      data: { id: STAGE_ID, name: STAGE_NAME, sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: STAGE_ID,
        projectId: testData.project.id,
      },
    });
    await prisma.user.create({
      data: {
        id: ADMIN_ID,
        email: "admin-content@test.local",
        name: "Test Admin",
        lastName: "Test",
        firstName: "Admin",
        role: "admin",
        samlId: "admin-content-test",
        reportingGroupId: TEST_IDS.group,
      },
    });
    // A second, older section of the same Lead serves as the fillFrom source.
    await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-03-31"),
        periodEnd: new Date("2026-04-06"),
        deadline: new Date("2026-04-04"),
        status: "draft",
      },
    });
    const source = await prisma.reportSection.create({
      data: {
        reportId: TEST_IDS.targetReport,
        authorId: TEST_IDS.lead,
        status: "draft",
      },
    });
    foreignSourceId = source.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("lets a Lead save their own section and records no role denial", async () => {
    const spy = createSpy();
    const caller = await callerFor(TEST_IDS.lead, "lead", spy);
    const before = await sectionRow(testData.section.id);

    await caller.reports.saveDraft(
      draftPayload(
        testData.section.id,
        testData.section.version,
        testData.project.id,
        "Lead delivery note",
      ),
    );

    const row = await sectionRow(testData.section.id);
    expect(row?.version).toBeGreaterThan(testData.section.version);
    expect(row?.items.map((item) => item.text)).toEqual(["Lead delivery note"]);
    expect(before?.items).toHaveLength(0);
    expect(spy.roleDenied).not.toHaveBeenCalled();
  });

  it("forbids a demoted Viewer's saveDraft on the old cookie and leaves the section unchanged", async () => {
    await demoteLeadToViewer();
    const spy = createSpy();
    const caller = await callerFor(TEST_IDS.lead, "lead", spy);
    const before = await sectionRow(testData.section.id);

    await expect(
      caller.reports.saveDraft(
        draftPayload(
          testData.section.id,
          testData.section.version,
          testData.project.id,
          "Viewer attempt",
        ),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(sectionRow(testData.section.id)).resolves.toEqual(before);
    expect(spy.roleDenied).toHaveBeenCalledOnce();
    expect(spy.roleDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "viewer",
        attemptedRole: ALLOWED_ROLES,
      }),
    );
    expect(spy.mutation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "fail", reason: "FORBIDDEN" }),
    );
  });

  it("forbids a demoted Viewer's submit on the old cookie and leaves the section unchanged", async () => {
    await demoteLeadToViewer();
    const spy = createSpy();
    const caller = await callerFor(TEST_IDS.lead, "lead", spy);
    const before = await sectionRow(testData.section.id);

    await expect(
      caller.reports.submit(
        submitPayload(
          draftPayload(
            testData.section.id,
            testData.section.version,
            testData.project.id,
            "Viewer submit attempt",
          ),
          testData.project.id,
        ),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(sectionRow(testData.section.id)).resolves.toEqual(before);
    expect(spy.roleDenied).toHaveBeenCalledOnce();
    expect(spy.roleDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "viewer",
        attemptedRole: ALLOWED_ROLES,
      }),
    );
    expect(spy.mutation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "fail", reason: "FORBIDDEN" }),
    );
  });

  it("forbids a demoted Viewer's leadForm.fillFrom and leaves the target and its items unchanged", async () => {
    await demoteLeadToViewer();
    const spy = createSpy();
    const caller = await callerFor(TEST_IDS.lead, "lead", spy);
    const before = await sectionRow(testData.section.id);

    await expect(
      caller.leadForm.fillFrom({
        targetSectionId: testData.section.id,
        sourceSectionId: foreignSourceId,
        version: testData.section.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(sectionRow(testData.section.id)).resolves.toEqual(before);
    expect(spy.roleDenied).toHaveBeenCalledOnce();
    expect(spy.mutation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "fail", reason: "FORBIDDEN" }),
    );
  });

  it.each([
    ["head", TEST_IDS.head],
    ["admin", ADMIN_ID],
  ] as const)(
    "refuses a %s saveDraft on a section they do not author",
    async (role, userId) => {
      const spy = createSpy();
      const caller = await callerFor(userId, role, spy);
      const before = await sectionRow(testData.section.id);

      await expect(
        caller.reports.saveDraft(
          draftPayload(
            testData.section.id,
            testData.section.version,
            testData.project.id,
            "Foreign attempt",
          ),
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Can only edit your own section.",
      });

      await expect(sectionRow(testData.section.id)).resolves.toEqual(before);
    },
  );

  it("refuses a Head's fillFrom into a section they do not author", async () => {
    const spy = createSpy();
    const caller = await callerFor(TEST_IDS.head, "head", spy);
    const before = await sectionRow(testData.section.id);

    await expect(
      caller.leadForm.fillFrom({
        targetSectionId: testData.section.id,
        sourceSectionId: foreignSourceId,
        version: testData.section.version,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Can only fill your own section.",
    });

    await expect(sectionRow(testData.section.id)).resolves.toEqual(before);
  });

  it("refuses a Head's fillFrom from a source section they do not author", async () => {
    const headSection = await prisma.reportSection.create({
      data: {
        reportId: TEST_IDS.targetReport,
        authorId: TEST_IDS.head,
        status: "draft",
      },
    });
    const spy = createSpy();
    const caller = await callerFor(TEST_IDS.head, "head", spy);
    const before = await sectionRow(headSection.id);

    await expect(
      caller.leadForm.fillFrom({
        targetSectionId: headSection.id,
        sourceSectionId: foreignSourceId,
        version: headSection.version,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Can only fill from your own section.",
    });

    await expect(sectionRow(headSection.id)).resolves.toEqual(before);
  });
});
