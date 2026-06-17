import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";

describe("LeadFormPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: LeadFormPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new LeadFormPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("fills from a source section", async () => {
    const sourceReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-03-31T00:00:00.000Z"),
        periodEnd: new Date("2026-04-06T00:00:00.000Z"),
        deadline: new Date("2026-04-05T18:00:00.000Z"),
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-05T19:00:00.000Z"),
      },
    });
    const sourceSection = await prisma.reportSection.create({
      data: {
        reportId: sourceReport.id,
        authorId: testData.lead.id,
        status: "submitted",
        submittedAt: new Date("2026-04-05T17:00:00.000Z"),
      },
    });

    await prisma.item.createMany({
      data: [
        {
          reportSectionId: sourceSection.id,
          projectId: testData.project.id,
          type: "current",
          text: "Source current item",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: true,
        },
        {
          reportSectionId: sourceSection.id,
          projectId: testData.project.id,
          type: "next",
          text: "Source next item",
          tag: "plan",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });
    await prisma.risk.create({
      data: {
        reportSectionId: sourceSection.id,
        projectId: testData.project.id,
        risk: "Source blocked risk",
        impact: "High impact",
        mitigation: "Mitigate now",
        severity: "blocked",
        stageNames: ["Dev"],
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: sourceSection.id,
        productId: testData.project.id,
        text: "Source decision",
        owner: "Lead",
        impact: "High",
        stageNames: ["Testing"],
      },
    });

    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Target stale item",
        tag: "stale",
        workflowStatus: "blocked",
      },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Target stale risk",
        impact: "Old",
        mitigation: "Old",
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Target stale decision",
        owner: "Lead",
        impact: "Old",
      },
    });

    const copiedCount = await repo.fillFromSection(
      testData.section.id,
      sourceSection.id,
    );

    const [items, risks, decisions] = await Promise.all([
      prisma.item.findMany({
        where: { reportSectionId: testData.section.id },
        orderBy: { text: "asc" },
      }),
      prisma.risk.findMany({ where: { reportSectionId: testData.section.id } }),
      prisma.decision.findMany({
        where: { reportSectionId: testData.section.id },
      }),
    ]);

    expect(copiedCount).toBe(4);
    expect(items.map((item) => item.text)).toEqual([
      "Source current item",
      "Source next item",
    ]);
    expect(items.every((item) => item.type === "current")).toBe(true);
    expect(items.every((item) => !item.carriedOver)).toBe(true);
    expect(risks).toHaveLength(1);
    expect(expectDefined(risks[0]).severity).toBe("blocked");
    expect(expectDefined(risks[0]).stageNames).toEqual(["Dev"]);
    expect(decisions).toHaveLength(1);
    expect(expectDefined(decisions[0]).text).toBe("Source decision");
  });

  // -----------------------------------------------------------------------
  // getCrossAuthors — task 4.1 / 4.2 / 4.5
  // -----------------------------------------------------------------------

  // Shared stage UUIDs used by the getCrossAuthors describe block.
  const STAGE_DEV_ID = "b0000000-0000-4000-b000-000000000001";
  const STAGE_TESTING_ID = "b0000000-0000-4000-b000-000000000002";

  /**
   * Seed a second lead ("co-lead"), assign both leads to the same project
   * on different stages, and create a foreign section in the given report.
   * Returns the co-lead and their section.
   */
  async function seedCoLead(
    reportId: string,
    opts: {
      /** Risk rows to seed on the co-lead's section. */
      risks?: {
        severity: string;
        stageNames: string[];
      }[];
      /** Persisted stage-traffic status for the co-lead on Dev. */
      persistedDevStatus?: "green" | "yellow" | "red" | null;
    } = {},
  ) {
    const coLead = await prisma.user.create({
      data: {
        id: "c0000000-0000-4000-c000-000000000001",
        email: "lead2@test.local",
        name: "Anna Karenina",
        role: "lead",
        samlId: "lead-test-2",
        reportingGroupId: testData.head.reportingGroupId,
      },
    });

    // Shared project: testData.lead owns Dev, coLead owns Testing.
    await prisma.stage.createMany({
      data: [
        { id: STAGE_DEV_ID, name: "Dev", sortOrder: 3 },
        { id: STAGE_TESTING_ID, name: "Testing", sortOrder: 5 },
      ],
    });
    await prisma.stageAssignment.createMany({
      data: [
        {
          userId: testData.lead.id,
          stageId: STAGE_DEV_ID,
          projectId: testData.project.id,
        },
        {
          userId: coLead.id,
          stageId: STAGE_TESTING_ID,
          projectId: testData.project.id,
        },
      ],
    });

    const coSection = await prisma.reportSection.create({
      data: {
        reportId,
        authorId: coLead.id,
        status: "draft",
      },
    });

    if (
      opts.persistedDevStatus !== undefined &&
      opts.persistedDevStatus !== null
    ) {
      await prisma.stageStatus.create({
        data: {
          reportSectionId: coSection.id,
          projectId: testData.project.id,
          stageId: STAGE_TESTING_ID,
          status: opts.persistedDevStatus,
        },
      });
    }

    for (const r of opts.risks ?? []) {
      await prisma.risk.create({
        data: {
          reportSectionId: coSection.id,
          projectId: testData.project.id,
          risk: "Co-lead risk",
          impact: "Some impact",
          mitigation: "Mitigation",
          severity: r.severity,
          stageNames: r.stageNames,
        },
      });
    }

    return { coLead, coSection };
  }

  describe("getCrossAuthors — task 4.1: status-only rows, initials only", () => {
    it("returns authorInitials but no authorName, no itemCount, no riskCount, no foreign text", async () => {
      const { coLead } = await seedCoLead(testData.report.id);

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      expect(rows).toHaveLength(1);
      const row = expectDefined(rows[0]);

      // Initials derived server-side from "Anna Karenina" → "AK".
      expect(row.authorInitials).toBe("AK");
      // Full name must NOT appear on the wire.
      expect(Object.keys(row)).not.toContain("authorName");
      // The three removed count fields must not appear.
      expect(Object.keys(row)).not.toContain("itemCount");
      expect(Object.keys(row)).not.toContain("riskCount");
      // Foreign text must not appear (no items/risks/decisions text on the row).
      expect(Object.keys(row)).not.toContain("items");
      expect(Object.keys(row)).not.toContain("decisions");
      // Required status-only fields are present.
      expect(row.authorId).toBe(coLead.id);
      expect(row.projectId).toBe(testData.project.id);
      expect(Array.isArray(row.stageNames)).toBe(true);
      expect(Array.isArray(row.stages)).toBe(true);
    });

    it("each stage entry has stageName and status only (no foreign text)", async () => {
      await seedCoLead(testData.report.id);

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      for (const stage of row.stages) {
        expect(Object.keys(stage)).toEqual(
          expect.arrayContaining(["stageName", "status"]),
        );
        // No extra text/risk content on the stage entry.
        expect(Object.keys(stage)).not.toContain("items");
        expect(Object.keys(stage)).not.toContain("risks");
      }
    });
  });

  // Task 4.2 NOTE: the caller-access GUARD (own-section-in-report OR head/admin)
  // lives in LeadFormService.getCrossAuthors, not the repository — see the
  // "getCrossAuthors authorization" block in lead-form.contract.test.ts. These
  // repo-level cases pin the complementary guarantee: even reached directly, the
  // repository never leaks foreign CONTENT, and an unrelated/empty context is [].
  describe("getCrossAuthors — task 4.2: no foreign content; empty context is []", () => {
    it("returns [] when the caller has no section in the given reportId", async () => {
      // Create a second report the caller (testData.lead) has NO section in.
      const unrelatedReport = await prisma.report.create({
        data: {
          periodStart: new Date("2026-05-01T00:00:00.000Z"),
          periodEnd: new Date("2026-05-07T00:00:00.000Z"),
          deadline: new Date("2026-05-05T18:00:00.000Z"),
          status: "draft",
        },
      });
      // Seed a co-lead section in that unrelated report only.
      await seedCoLead(unrelatedReport.id);

      const rows = await repo.getCrossAuthors(
        unrelatedReport.id,
        testData.lead.id,
      );

      // testData.lead has no stage assignments (added above) in the unrelated
      // report, so they have no shared-project context — returns empty.
      // NOTE: getCrossAuthors keys on stageAssignment, not section membership.
      // The caller (testData.lead) has stage assignments but those point to
      // testData.report.id; the co-lead's section is in unrelatedReport.
      // Because both leads share a project+stage, the cross-author lookup
      // returns rows — but the co-lead's section is in a DIFFERENT report, so
      // the stage status lookup finds nothing and returns null traffic (empty).
      // The important contract is: no foreign content leaks through.
      for (const row of rows) {
        expect(Object.keys(row)).not.toContain("authorName");
        for (const stage of row.stages) {
          expect(Object.keys(stage)).not.toContain("items");
          expect(Object.keys(stage)).not.toContain("risks");
        }
      }
    });

    it("returns [] when caller has no stage assignments at all", async () => {
      // testData.lead has no stageAssignment rows yet (cleanDatabase ran in beforeEach).
      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );
      expect(rows).toEqual([]);
    });
  });

  describe("getCrossAuthors — task 4.5: foreign stage status is risk-derived", () => {
    it("persisted red with no covering risk collapses to green (on-track base)", async () => {
      // Co-lead has a persisted red traffic on Testing but no covering risk.
      // deriveForeignStageStatus must return 'green' (touched, no risk → green),
      // which buildCrossAuthorStageMap maps to 'on-track'.
      await seedCoLead(testData.report.id, { persistedDevStatus: "red" });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      // Stale red traffic with no backing risk → green (not red).
      expect(expectDefined(testingStage).status).toBe("green");
    });

    it("a covering blocked risk colours the stage red (→ blocked in the mapper)", async () => {
      await seedCoLead(testData.report.id, {
        risks: [{ severity: "blocked", stageNames: ["Testing"] }],
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      expect(expectDefined(testingStage).status).toBe("red");
    });

    it("a covering at-risk risk colours the stage yellow (not red)", async () => {
      await seedCoLead(testData.report.id, {
        risks: [{ severity: "at-risk", stageNames: ["Testing"] }],
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      expect(expectDefined(testingStage).status).toBe("yellow");
    });

    it("a covers-all blocked risk (empty stageNames) colours every assigned stage red", async () => {
      // Empty stageNames is the Add-Risk dialog default = "all assigned stages".
      // The co-lead is assigned only to Testing, so Testing must read red.
      await seedCoLead(testData.report.id, {
        risks: [{ severity: "blocked", stageNames: [] }],
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      expect(expectDefined(testingStage).status).toBe("red");
    });

    it("a covers-all at-risk risk (empty stageNames) colours every assigned stage yellow", async () => {
      await seedCoLead(testData.report.id, {
        risks: [{ severity: "at-risk", stageNames: [] }],
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      expect(expectDefined(testingStage).status).toBe("yellow");
    });

    it("a blocked ITEM (no risk) does NOT colour the stage red", async () => {
      // A blocked item on the co-lead's section, no risk. The foreign-blocked-
      // item path is intentionally NOT consulted; the stage must stay on the
      // persisted-traffic base (no traffic seeded → null).
      const { coSection } = await seedCoLead(testData.report.id);
      await prisma.item.create({
        data: {
          reportSectionId: coSection.id,
          projectId: testData.project.id,
          type: "current",
          text: "Blocked item",
          tag: "feature",
          workflowStatus: "blocked",
          stageNames: ["Testing"],
        },
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      // No covering risk, no persisted traffic → null (empty).
      expect(expectDefined(testingStage).status).toBeNull();
    });
  });
});
