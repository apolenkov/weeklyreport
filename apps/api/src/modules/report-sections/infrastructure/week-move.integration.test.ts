// Real-DB coverage that a Lead's week move (TASK-766) is a plain `type` change
// on reports.saveDraft. The stableId, text, tag and progress survive the
// PostgreSQL round-trip, a stale expected version is refused with CONFLICT, and
// the last successful placement stays in the database.
import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import {
  AUTH_COOKIE_NAME,
  type DraftSavePayload,
  type UserSession,
} from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createContextFactory } from "../../../infrastructure/trpc/trpc.context.js";
import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createAuthController } from "../../../modules/auth/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
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
  AUTH_JWT_SECRET: "week-move-integration-session-secret-0123456789",
  PDF_EXPORT_JWT_SECRET: "week-move-integration-pdf-export-secret-0123456789",
} as const;
const STAGE_ID = "a1000000-0000-4000-a000-000000000002";
const STAGE_NAME = "Week move fixture";
const ITEM_STABLE_ID = "66666666-6666-4666-8666-666666666666";
const ITEM_TEXT = "Migrate billing export";
const ITEM_TAG = "feature";

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
const reportSectionsService = new ReportSectionsService(
  new ReportSectionsPrismaRepository(prismaService),
  NOOP_TELEMETRY,
  createNullLogger(),
);
const leadFormService = new LeadFormService(
  new LeadFormPrismaRepository(prismaService),
  NOOP_TELEMETRY,
);

function leadSession(): UserSession {
  return {
    userId: TEST_IDS.lead,
    email: "lead-week-move@test.local",
    name: "Synthetic lead",
    role: "lead",
    reportingGroupId: TEST_IDS.group,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

// The caller is built from the Lead's session cookie, as a real request would.
async function leadCaller() {
  const { token } = createAuthController(env).issueSessionCookie(leadSession());
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
  ).createCaller({ ...ctx, auditLogger: createNullAuditLogger() });
}

// One item in the fixture stage. Only `type` changes between the week moves;
// the stableId, text, tag and progress are the same on every save.
function draftPayload(
  reportSectionId: string,
  version: number,
  projectId: string,
  type: "current" | "next",
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
        stableId: ITEM_STABLE_ID,
        projectId,
        type,
        text: ITEM_TEXT,
        tag: ITEM_TAG,
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [STAGE_NAME],
      },
    ],
    risks: [],
    decisions: [],
  };
}

describe("week move through reports.saveDraft (integration)", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  const readSection = () =>
    prisma.reportSection.findUnique({
      where: { id: testData.section.id },
      include: { items: true },
    });

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

    // The seeded section has no items, so the first save places the item in
    // the current week; the week-move scenarios start from that state.
    const lead = await leadCaller();
    await lead.reports.saveDraft(
      draftPayload(
        testData.section.id,
        testData.section.version,
        testData.project.id,
        "current",
      ),
    );
    expectDefined(await readSection());
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("persists a current → next move with stableId, text, tag and progress unchanged", async () => {
    const lead = await leadCaller();
    const before = expectDefined(await readSection());
    expect(before.items.at(0)?.type).toBe("current");

    await lead.reports.saveDraft(
      draftPayload(
        testData.section.id,
        before.version,
        testData.project.id,
        "next",
      ),
    );

    const after = expectDefined(await readSection());
    expect(after.version).toBe(before.version + 1);
    expect(after.items).toHaveLength(1);
    expect(after.items.at(0)).toMatchObject({
      stableId: ITEM_STABLE_ID,
      type: "next",
      text: ITEM_TEXT,
      tag: ITEM_TAG,
      workflowStatus: "in_progress",
    });
  });

  it("moves the item next → current on a later version and keeps exactly one row for its stableId", async () => {
    const lead = await leadCaller();
    const start = expectDefined(await readSection());

    await lead.reports.saveDraft(
      draftPayload(
        testData.section.id,
        start.version,
        testData.project.id,
        "next",
      ),
    );
    const middle = expectDefined(await readSection());
    await lead.reports.saveDraft(
      draftPayload(
        testData.section.id,
        middle.version,
        testData.project.id,
        "current",
      ),
    );

    const end = expectDefined(await readSection());
    expect(end.version).toBe(start.version + 2);
    expect(end.items).toHaveLength(1);
    expect(
      end.items.filter((item) => item.stableId === ITEM_STABLE_ID),
    ).toHaveLength(1);
    expect(end.items.at(0)).toMatchObject({
      stableId: ITEM_STABLE_ID,
      type: "current",
      text: ITEM_TEXT,
      tag: ITEM_TAG,
      workflowStatus: "in_progress",
    });
  });

  it("refuses an already-used version with CONFLICT and keeps the last successful placement", async () => {
    const lead = await leadCaller();
    const start = expectDefined(await readSection());

    await lead.reports.saveDraft(
      draftPayload(
        testData.section.id,
        start.version,
        testData.project.id,
        "next",
      ),
    );
    const moved = expectDefined(await readSection());

    // The expected version was used by the successful move, so the write is stale.
    await expect(
      lead.reports.saveDraft(
        draftPayload(
          testData.section.id,
          start.version,
          testData.project.id,
          "current",
        ),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const after = expectDefined(await readSection());
    expect(after).toEqual(moved);
    expect(after.items.at(0)?.type).toBe("next");
  });
});
