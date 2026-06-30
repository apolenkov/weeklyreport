import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { canReadReport } from "./pdf-export.download-handler";

/**
 * D3 security gate against a real database: `canReadReport` must return true
 * only when the caller's current group scope intersects the report (≥1 section
 * authored in a group the caller can see), so a viewer whose access was revoked
 * cannot pull the artifact. The seeded report has one section authored by the
 * lead, whose `reportingGroupId` is `TEST_IDS.group`.
 */
describe("canReadReport (integration)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
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
});
