import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { SearchPrismaRepository } from "./search.prisma-repository";

/**
 * viewer-report-surface-parity (task 1.7): the load-bearing guard that
 * search content visibility == weekly-report read visibility for a viewer.
 *
 * The viewer's `published` search scope must surface EXACTLY the item/risk/
 * decision content the viewer can already open in `/reports/[reportId]`. The
 * report-read gate is two predicates:
 *   1. publish gate — `Report.periodStatus = 'published'`
 *      (`weekly-report.service.ts`: NOT_FOUND when `periodStatus !== 'published'`).
 *   2. group gate — the section author's `reportingGroupId` is in the viewer's
 *      granted groups (`weekly-report.prisma-repository.ts` section filter).
 *
 * This suite asserts the search repository applies the SAME two predicates for
 * `scope='published'`, and — critically — that the publish gate keys on
 * `periodStatus`, NOT `status`: a reopened period keeps `status='published'`
 * (the list column) while `periodStatus='reopened'` makes its content
 * unreadable. A `status`-based gate would leak reopened content; this test
 * pins the reopened case as excluded.
 */
describe("SearchPrismaRepository — published scope read-parity (integration)", () => {
  const prisma = createTestPrisma();
  let repo: SearchPrismaRepository;

  // Fixed UUIDs — version digit [1-8] in pos 13, variant [89ab] in pos 17.
  const GROUP_A_ID = "b0000000-0000-4000-a000-0000000000a1";
  const GROUP_B_ID = "b0000000-0000-4000-a000-0000000000a2";
  const LEAD_A_ID = "b0000000-0000-4000-a000-0000000000c1";
  const LEAD_B_ID = "b0000000-0000-4000-a000-0000000000c2";
  const PROJECT_ID = "b0000000-0000-4000-a000-0000000000d1";

  const REPORT_PUB_ID = "b0000000-0000-4000-a000-0000000000e1";
  const REPORT_OPEN_ID = "b0000000-0000-4000-a000-0000000000e2";
  const REPORT_REOPENED_ID = "b0000000-0000-4000-a000-0000000000e3";

  const SECTION_PUB_A_ID = "b0000000-0000-4000-a000-0000000000f1";
  const SECTION_PUB_B_ID = "b0000000-0000-4000-a000-0000000000f2";
  const SECTION_OPEN_A_ID = "b0000000-0000-4000-a000-0000000000f3";
  const SECTION_REOPENED_A_ID = "b0000000-0000-4000-a000-0000000000f4";

  const ITEM_PUB_IN_GROUP = "b0000000-0000-4000-a000-000000000101";
  const ITEM_OPEN_IN_GROUP = "b0000000-0000-4000-a000-000000000102";
  const ITEM_REOPENED_IN_GROUP = "b0000000-0000-4000-a000-000000000103";
  const ITEM_PUB_OUT_GROUP = "b0000000-0000-4000-a000-000000000104";

  // Distinct token present in every item's text so plainto_tsquery matches.
  const Q = "paritysearchtoken";

  async function createReport(
    id: string,
    status: "draft" | "published",
    periodStatus: "open" | "published" | "reopened",
    periodStart: string,
  ): Promise<void> {
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodStart),
        deadline: new Date(periodStart),
        status,
        periodStatus,
      },
    });
  }

  async function createSection(
    id: string,
    reportId: string,
    authorId: string,
  ): Promise<void> {
    await prisma.reportSection.create({
      data: { id, reportId, authorId, status: "submitted" },
    });
  }

  async function createItem(
    id: string,
    reportSectionId: string,
  ): Promise<void> {
    await prisma.item.create({
      data: {
        id,
        reportSectionId,
        projectId: PROJECT_ID,
        type: "current",
        text: `${Q} release blocker`,
        tag: "general",
        workflowStatus: "in_progress",
      },
    });
  }

  beforeAll(() => {
    repo = new SearchPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A_ID, name: "Group A" },
        { id: GROUP_B_ID, name: "Group B" },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: LEAD_A_ID,
          email: "lead-a@test.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "parity-lead-a",
          reportingGroupId: GROUP_A_ID,
        },
        {
          id: LEAD_B_ID,
          email: "lead-b@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "parity-lead-b",
          reportingGroupId: GROUP_B_ID,
        },
      ],
    });
    await prisma.project.create({
      data: { id: PROJECT_ID, name: "Parity Platform", leadId: LEAD_A_ID },
    });

    // A published report (status + periodStatus both 'published').
    await createReport(
      REPORT_PUB_ID,
      "published",
      "published",
      "2026-05-04T00:00:00.000Z",
    );
    // An open (never-published) report.
    await createReport(
      REPORT_OPEN_ID,
      "draft",
      "open",
      "2026-05-11T00:00:00.000Z",
    );
    // A REOPENED report: status stays 'published' (the list column) but
    // periodStatus='reopened' makes content unreadable — the leak the gate fixes.
    await createReport(
      REPORT_REOPENED_ID,
      "published",
      "reopened",
      "2026-05-18T00:00:00.000Z",
    );

    // Sections: group-A author in each report; one group-B author in the
    // published report (the out-of-group case).
    await createSection(SECTION_PUB_A_ID, REPORT_PUB_ID, LEAD_A_ID);
    await createSection(SECTION_PUB_B_ID, REPORT_PUB_ID, LEAD_B_ID);
    await createSection(SECTION_OPEN_A_ID, REPORT_OPEN_ID, LEAD_A_ID);
    await createSection(SECTION_REOPENED_A_ID, REPORT_REOPENED_ID, LEAD_A_ID);

    await createItem(ITEM_PUB_IN_GROUP, SECTION_PUB_A_ID);
    await createItem(ITEM_OPEN_IN_GROUP, SECTION_OPEN_A_ID);
    await createItem(ITEM_REOPENED_IN_GROUP, SECTION_REOPENED_A_ID);
    await createItem(ITEM_PUB_OUT_GROUP, SECTION_PUB_B_ID);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  async function publishedSearch(groupIds: string[] | null): Promise<string[]> {
    const hits = await repo.search({
      q: Q,
      scope: "published",
      userId: LEAD_A_ID,
      groupIds,
      excludeTypes: ["project"],
      limit: 50,
    });
    return hits.map((h) => h.id);
  }

  it("returns a published, in-group item to the viewer scope", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).toContain(ITEM_PUB_IN_GROUP);
  });

  it("excludes an item in an UNPUBLISHED (open) report — the publish gate", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).not.toContain(ITEM_OPEN_IN_GROUP);
  });

  it("excludes an item in a REOPENED report (status='published', periodStatus='reopened') — proves the gate keys on periodStatus, not status", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).not.toContain(ITEM_REOPENED_IN_GROUP);
  });

  it("excludes a published item authored OUTSIDE the viewer's groups — the group gate", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).not.toContain(ITEM_PUB_OUT_GROUP);
  });

  it("published scope returns EXACTLY the in-group published content (read-parity)", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect([...ids].sort()).toEqual([ITEM_PUB_IN_GROUP]);
  });

  it("a viewer with access to BOTH groups also sees the group-B published item", async () => {
    const ids = await publishedSearch([GROUP_A_ID, GROUP_B_ID]);
    expect(ids).toContain(ITEM_PUB_IN_GROUP);
    expect(ids).toContain(ITEM_PUB_OUT_GROUP);
    // Still no unpublished/reopened content, even with broader group access.
    expect(ids).not.toContain(ITEM_OPEN_IN_GROUP);
    expect(ids).not.toContain(ITEM_REOPENED_IN_GROUP);
  });

  it("the publish gate is scope-specific: scope='all' still surfaces unpublished in-group content", async () => {
    // Differentiator — proves the INNER JOIN applies ONLY to scope='published'
    // and did not silently constrain the existing 'all' scope.
    const hits = await repo.search({
      q: Q,
      scope: "all",
      userId: LEAD_A_ID,
      groupIds: [GROUP_A_ID],
      excludeTypes: [],
      limit: 50,
    });
    const ids = hits.map((h) => h.id);
    expect(ids).toContain(ITEM_PUB_IN_GROUP);
    expect(ids).toContain(ITEM_OPEN_IN_GROUP);
    expect(ids).toContain(ITEM_REOPENED_IN_GROUP);
  });
});
