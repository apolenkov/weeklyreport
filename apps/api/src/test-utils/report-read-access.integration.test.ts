import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "./prisma-test-helper";
import { canReadReport } from "./report-read-access.js";

// Exercise report visibility against persisted rows. Artifact downloads use
// their separate immutable job-owner contract.
describe("report-read-access canReadReport (integration)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  function viewerWithGroups(groups: string[]): UserSession {
    return {
      userId: "a0000000-0000-4000-8000-0000000000v9",
      email: "viewer9@test.local",
      name: "Viewer Nine",
      role: "viewer",
      activeReportId: null,
      activeReportSectionId: null,
      viewerGroupAccess: groups,
    };
  }

  function adminSession(): UserSession {
    return {
      userId: "a0000000-0000-4000-8000-0000000000a9",
      email: "admin9@test.local",
      name: "Admin Nine",
      role: "admin",
      activeReportId: null,
      activeReportSectionId: null,
    };
  }

  it("authorizes a viewer whose group access includes the report's section group", async () => {
    const allowed = await canReadReport(
      viewerWithGroups([TEST_IDS.group]),
      testData.report.id,
      prisma as never,
    );
    expect(allowed).toBe(true);
  });

  it("denies a viewer whose group access was revoked (empty scope)", async () => {
    const allowed = await canReadReport(
      viewerWithGroups([]),
      testData.report.id,
      prisma as never,
    );
    expect(allowed).toBe(false);
  });

  it("denies a viewer scoped only to an unrelated group", async () => {
    const allowed = await canReadReport(
      viewerWithGroups(["a0000000-0000-4000-8000-000000000fff"]),
      testData.report.id,
      prisma as never,
    );
    expect(allowed).toBe(false);
  });

  it("authorizes the head of the report's section group", async () => {
    const head: UserSession = {
      userId: testData.head.id,
      email: "head@test.local",
      name: "Test Head",
      role: "head",
      activeReportId: null,
      activeReportSectionId: null,
      reportingGroupId: TEST_IDS.group,
    };
    expect(await canReadReport(head, testData.report.id, prisma as never)).toBe(
      true,
    );
  });

  it("authorizes an admin for any existing report", async () => {
    expect(
      await canReadReport(adminSession(), testData.report.id, prisma as never),
    ).toBe(true);
  });

  it("denies both scoped and admin callers when the report is missing", async () => {
    const missingReportId = "a0000000-0000-4000-8000-0000000000ff";

    expect(
      await canReadReport(
        viewerWithGroups([TEST_IDS.group]),
        missingReportId,
        prisma as never,
      ),
    ).toBe(false);
    expect(
      await canReadReport(adminSession(), missingReportId, prisma as never),
    ).toBe(false);
  });
});
