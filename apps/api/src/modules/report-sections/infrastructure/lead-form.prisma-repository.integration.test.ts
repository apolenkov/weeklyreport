import type { TrafficLightStatus } from "@customreport/shared";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createPauseGate } from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { LeadFormDomainError } from "../domain/lead-form-shared";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";

describe("LeadFormPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: LeadFormPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  const sourceReportId = "a0000000-0000-4000-a000-000000000710";

  beforeAll(() => {
    repo = new LeadFormPrismaRepository(prisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
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
        id: sourceReportId,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: sourceReportId,
          periodStart: "2026-03-31T00:00:00.000Z",
          periodEnd: "2026-04-06T00:00:00.000Z",
          deadline: "2026-04-05T18:00:00.000Z",
          publishedAt: "2026-04-05T19:00:00.000Z",
        }),
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
          stageNames: ["Dev"],
        },
        {
          reportSectionId: sourceSection.id,
          projectId: testData.project.id,
          type: "next",
          text: "Source next item",
          tag: "plan",
          workflowStatus: "planned",
          carriedOver: false,
          stageNames: ["Dev"],
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
        workflowStatus: "in_progress",
        stageNames: ["Dev"],
      },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Target stale risk",
        impact: "Old",
        mitigation: "Old",
        severity: "at-risk",
        stageNames: ["Dev"],
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Target stale decision",
        owner: "Lead",
        impact: "Old",
        stageNames: ["Dev"],
      },
    });

    const copiedCount = await repo.fillFromSection(
      testData.section.id,
      sourceSection.id,
      testData.section.version,
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

  it("keeps LeadForm lifecycle and content in one snapshot across publish and assignment drift", async () => {
    const originalGroupId = expectDefined(testData.head.reportingGroupId);
    const groupB = await prisma.reportingGroup.create({
      data: { name: "Drifted group", description: null },
    });
    const gate = createPauseGate();
    const pausedPrisma = new Proxy(prisma, {
      get(target, property, receiver): unknown {
        if (property !== "$transaction")
          return Reflect.get(target, property, receiver);
        return async (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: Parameters<typeof prisma.$transaction>[1],
        ) => {
          const transaction = prisma.$transaction.bind(prisma);
          return transaction(
            async (tx) =>
              callback(
                new Proxy(tx, {
                  get(txTarget, txProperty, txReceiver): unknown {
                    if (txProperty !== "report")
                      return Reflect.get(txTarget, txProperty, txReceiver);
                    return new Proxy(txTarget.report, {
                      get(
                        reportTarget,
                        reportProperty,
                        reportReceiver,
                      ): unknown {
                        return reportProperty === "findUnique"
                          ? async (
                              ...args: Parameters<
                                typeof txTarget.report.findUnique
                              >
                            ) => {
                              const findUnique =
                                txTarget.report.findUnique.bind(
                                  txTarget.report,
                                );
                              const result = await findUnique(...args);
                              await gate.pause();
                              return result;
                            }
                          : Reflect.get(
                              reportTarget,
                              reportProperty,
                              reportReceiver,
                            );
                      },
                    });
                  },
                }) as Prisma.TransactionClient,
              ),
            options,
          );
        };
      },
    });

    const snapshot = publishedSnapshotFixture({
      reportId: testData.report.id,
      periodStart: testData.report.periodStart.toISOString(),
      periodEnd: testData.report.periodEnd.toISOString(),
      publishedAt: "2026-05-10T16:00:00.000Z",
      sectionOwners: [
        {
          reportSectionId: testData.section.id,
          authorId: testData.lead.id,
          authorName: "Frozen lead",
          groupId: originalGroupId,
          groupName: "Original group",
        },
      ],
    });
    const read = new LeadFormPrismaRepository(
      pausedPrisma as never,
    ).getSectionForPeriod(testData.report.id, testData.lead.id);
    await gate.paused;
    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt: new Date("2026-05-10T16:00:00.000Z"),
          publishedSnapshot: snapshot,
        },
      });
      await tx.user.update({
        where: { id: testData.lead.id },
        data: { reportingGroupId: groupB.id },
      });
      await tx.publishedSectionScope.create({
        data: {
          reportId: testData.report.id,
          reportSectionId: testData.section.id,
          authorId: testData.lead.id,
          groupId: originalGroupId,
        },
      });
    });
    gate.release();

    const result = await read;
    expect(result?.readOnly).toBe(false);
    expect(result?.section.reportSectionId).toBe(testData.section.id);
  });

  it("fillFromSection throws LeadFormDomainError when the source section is absent on the copy re-read (TOCTOU)", async () => {
    // The repository re-reads the source inside the copy; if it vanished since
    // the service precheck, the re-read surfaces NOT_FOUND (LeadFormDomainError),
    // not a bare Error (→ 500).
    const missingSourceId = "99999999-9999-4999-8999-999999999999";

    await expect(
      repo.fillFromSection(
        testData.section.id,
        missingSourceId,
        testData.section.version,
      ),
    ).rejects.toBeInstanceOf(LeadFormDomainError);
  });

  // Shared stage UUIDs used by the getCrossAuthors describe block.
  const STAGE_DEV_ID = "b0000000-0000-4000-b000-000000000001";
  const STAGE_TESTING_ID = "b0000000-0000-4000-b000-000000000002";

  async function seedCoLead(
    reportId: string,
    opts: {
      risks?: {
        severity: string;
        stageNames: string[];
      }[];
      persistedTestingStatus?: TrafficLightStatus | null;
    } = {},
  ) {
    const coLead = await prisma.user.create({
      data: {
        id: "c0000000-0000-4000-c000-000000000001",
        email: "lead2@test.local",
        name: "Anna Karenina",
        lastName: "Anna",
        firstName: "Karenina",
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
      opts.persistedTestingStatus !== undefined &&
      opts.persistedTestingStatus !== null
    ) {
      await prisma.stageStatus.create({
        data: {
          reportSectionId: coSection.id,
          projectId: testData.project.id,
          stageId: STAGE_TESTING_ID,
          status: opts.persistedTestingStatus,
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

  describe("getCrossAuthors — status-only rows, initials only", () => {
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
      // The SHORT form (surname + initials) leaves the server for the
      // cross-author stage label — "Anna Karenina" → "Anna K.".
      expect(row.authorShortName).toBe("Anna K.");
      // The FULL ФИО must still NOT appear on the wire.
      expect(Object.keys(row)).not.toContain("authorName");
      // The row exposes no aggregate count fields.
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

  // The caller-access guard lives in LeadFormService.getCrossAuthors, not the
  // repository. These repo-level cases pin the complement: even reached
  // directly, the repository never leaks foreign content; unrelated/empty → [].
  describe("getCrossAuthors — no foreign content; empty context is []", () => {
    it("no section in the given reportId still returns rows scoped by shared stageAssignment, never foreign content", async () => {
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
      const { coLead } = await seedCoLead(unrelatedReport.id);

      const rows = await repo.getCrossAuthors(
        unrelatedReport.id,
        testData.lead.id,
      );

      // getCrossAuthors keys on shared stageAssignment rows, which are
      // report-independent — so a co-lead row comes back even with no section
      // in this report, yet still carries no foreign content.
      expect(rows).toHaveLength(1);
      const row = expectDefined(rows[0]);
      expect(row.authorId).toBe(coLead.id);
      expect(row.projectId).toBe(testData.project.id);
      expect(row.stageNames).toEqual(["Testing"]);
      expect(row.stages).toEqual([{ stageName: "Testing", status: null }]);
      expect(Object.keys(row)).not.toContain("authorName");
      for (const stage of row.stages) {
        expect(Object.keys(stage)).not.toContain("items");
        expect(Object.keys(stage)).not.toContain("risks");
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

  describe("getCrossAuthors — least-privilege co-owned scoping", () => {
    it("excludes a product the caller does NOT co-own", async () => {
      const { coLead } = await seedCoLead(testData.report.id);
      // A second product the co-lead is assigned to but the CALLER is not.
      const otherProject = await prisma.project.create({
        data: {
          id: "a0000000-0000-4000-a000-0000000000c2",
          name: "Caller-not-co-owned",
          leadId: coLead.id,
        },
      });
      await prisma.groupProduct.create({
        data: {
          groupId: expectDefined(testData.lead.reportingGroupId),
          productId: otherProject.id,
        },
      });
      await prisma.stageAssignment.create({
        data: {
          userId: coLead.id,
          stageId: STAGE_TESTING_ID,
          projectId: otherProject.id,
        },
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      // Only the shared product is returned; the product the caller does not
      // co-own is excluded (pins the `projectId IN myProjectIds` scoping — if a
      // future edit broadened the read, otherProject would leak in here).
      const projectIds = rows.map((r) => r.projectId);
      expect(projectIds).toContain(testData.project.id);
      expect(projectIds).not.toContain(otherProject.id);
    });
  });

  describe("getCrossAuthors — foreign stage status is risk-derived", () => {
    it("persisted red with no covering risk collapses to green (on-track base)", async () => {
      // Co-lead has a persisted red traffic on Testing but no covering risk.
      // deriveForeignStageStatus must return 'green' (touched, no risk → green),
      // which buildCrossAuthorStageMap maps to 'on-track'.
      await seedCoLead(testData.report.id, { persistedTestingStatus: "red" });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      // Stale red traffic with no backing risk → green (not red).
      expect(expectDefined(testingStage).status).toBe("green");
    });

    it.each([
      {
        label:
          "a covering blocked risk colours the stage red (→ blocked in the mapper)",
        severity: "blocked",
        expectedStatus: "red",
      },
      {
        label: "a covering at-risk risk colours the stage yellow (not red)",
        severity: "at-risk",
        expectedStatus: "yellow",
      },
      {
        label: "a blocked risk naming the assigned stage colours it red",
        severity: "blocked",
        expectedStatus: "red",
      },
      {
        label: "an at-risk risk naming the assigned stage colours it yellow",
        severity: "at-risk",
        expectedStatus: "yellow",
      },
    ] as const)("$label", async ({ severity, expectedStatus }) => {
      await seedCoLead(testData.report.id, {
        risks: [{ severity, stageNames: ["Testing"] }],
      });

      const rows = await repo.getCrossAuthors(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      const testingStage = row.stages.find((s) => s.stageName === "Testing");
      expect(expectDefined(testingStage).status).toBe(expectedStatus);
    });

    it("an item's own workflowStatus (no risk) does NOT colour the stage red", async () => {
      // An item with no covering risk: workflowStatus never colours a stage
      // (only risks do), so the stage stays on the persisted-traffic base (no
      // traffic seeded → null).
      const { coSection } = await seedCoLead(testData.report.id);
      await prisma.item.create({
        data: {
          reportSectionId: coSection.id,
          projectId: testData.project.id,
          type: "current",
          text: "In-progress item",
          tag: "feature",
          workflowStatus: "in_progress",
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

  // The contract tests mock the repository and so cannot catch a dropped WHERE
  // clause; these cases exercise the live query instead. Clauses:
  // openspec/specs/lead-form-cross-author-scope.
  describe("getCrossAuthorContent — full-content co-ownership filter", () => {
    // Second, NON-shared project the caller is never assigned to.
    const OTHER_PROJECT_ID = "a0000000-0000-4000-a000-000000000200";

    async function seedContent(
      reportSectionId: string,
      projectId: string,
      marker: string,
    ) {
      await prisma.item.create({
        data: {
          reportSectionId,
          projectId,
          type: "current",
          text: `Item-${marker}`,
          tag: "feature",
          workflowStatus: "in_progress",
          stageNames: ["Testing"],
        },
      });
      await prisma.risk.create({
        data: {
          reportSectionId,
          projectId,
          risk: `Risk-${marker}`,
          impact: "Impact",
          mitigation: "Mitigation",
          severity: "at-risk",
          stageNames: ["Testing"],
        },
      });
      await prisma.decision.create({
        data: {
          reportSectionId,
          productId: projectId,
          text: `Decision-${marker}`,
          owner: "Owner",
          impact: "Impact",
          stageNames: ["Testing"],
        },
      });
    }

    it("allows: co-owner's full records on a shared product return with text + full name", async () => {
      const { coLead, coSection } = await seedCoLead(testData.report.id);
      await seedContent(coSection.id, testData.project.id, "shared");

      const { coOwnsShared, rows } = await repo.getCrossAuthorContent(
        testData.report.id,
        testData.lead.id,
      );

      expect(coOwnsShared).toBe(true);
      expect(rows).toHaveLength(1);
      const row = expectDefined(rows[0]);
      // Full name is intentionally exposed on this two-tier authorized read.
      expect(row.authorId).toBe(coLead.id);
      expect(row.authorName).toBe("Anna Karenina");
      expect(row.sharedProductIds).toContain(testData.project.id);
      // Full foreign text crosses the boundary for an authorized co-owner.
      expect(row.items.map((i) => i.text)).toContain("Item-shared");
      expect(row.risks.map((r) => r.risk)).toContain("Risk-shared");
      expect(row.decisions.map((d) => d.text)).toContain("Decision-shared");
    });

    it("self-exclusion: the caller's OWN content never appears in any returned row", async () => {
      // Seed the caller's own content on the shared product, plus a co-lead so
      // coOwnsShared holds. If `userId: { not: userId }` were dropped, the
      // caller's own section would join in and leak back to them.
      const { coSection } = await seedCoLead(testData.report.id);
      await seedContent(coSection.id, testData.project.id, "shared");
      await seedContent(testData.section.id, testData.project.id, "self");

      const { rows } = await repo.getCrossAuthorContent(
        testData.report.id,
        testData.lead.id,
      );

      expect(rows.map((r) => r.authorId)).not.toContain(testData.lead.id);
      const allItemText = rows.flatMap((r) => r.items.map((i) => i.text));
      const allRiskText = rows.flatMap((r) => r.risks.map((r2) => r2.risk));
      const allDecisionText = rows.flatMap((r) =>
        r.decisions.map((d) => d.text),
      );
      expect(allItemText).not.toContain("Item-self");
      expect(allRiskText).not.toContain("Risk-self");
      expect(allDecisionText).not.toContain("Decision-self");
    });

    it("co-ownership scope: a co-owner's content on a NON-shared product is filtered out", async () => {
      // The co-lead authors content on BOTH the shared product and one the
      // CALLER is not assigned to. Only shared-product records may cross; the
      // unshared assignment makes `projectId: { in: myProjectIds }` load-bearing.
      const OTHER_STAGE_ID = "b0000000-0000-4000-b000-000000000009";
      const { coLead, coSection } = await seedCoLead(testData.report.id);
      await prisma.project.create({
        data: {
          id: OTHER_PROJECT_ID,
          name: "Unshared Project",
          leadId: testData.lead.id,
        },
      });
      await prisma.groupProduct.create({
        data: {
          groupId: expectDefined(testData.lead.reportingGroupId),
          productId: OTHER_PROJECT_ID,
        },
      });
      // Co-lead is assigned to the unshared product; the caller is NOT. Without
      // the `projectId: { in: myProjectIds }` clause this assignment would enter
      // the co-lead's shared set and leak the unshared records.
      await prisma.stage.create({
        data: { id: OTHER_STAGE_ID, name: "Design", sortOrder: 1 },
      });
      await prisma.stageAssignment.create({
        data: {
          userId: coLead.id,
          stageId: OTHER_STAGE_ID,
          projectId: OTHER_PROJECT_ID,
        },
      });
      await seedContent(coSection.id, testData.project.id, "shared");
      await seedContent(coSection.id, OTHER_PROJECT_ID, "unshared");

      const { rows } = await repo.getCrossAuthorContent(
        testData.report.id,
        testData.lead.id,
      );

      const row = expectDefined(rows[0]);
      expect(row.sharedProductIds).toEqual([testData.project.id]);
      const allItemText = rows.flatMap((r) => r.items.map((i) => i.text));
      const allRiskText = rows.flatMap((r) => r.risks.map((r2) => r2.risk));
      const allDecisionText = rows.flatMap((r) =>
        r.decisions.map((d) => d.text),
      );
      expect(allItemText).toContain("Item-shared");
      expect(allItemText).not.toContain("Item-unshared");
      expect(allRiskText).not.toContain("Risk-unshared");
      expect(allDecisionText).not.toContain("Decision-unshared");
    });

    it("archived guard: an archived shared product denies the read (coOwnsShared:false, [])", async () => {
      // The only shared product is archived: the `project: { archived: false }`
      // clause must drop it from the co-ownership scope, so the caller co-owns
      // nothing shared and the read is denied (else archived content leaks).
      const { coSection } = await seedCoLead(testData.report.id);
      await seedContent(coSection.id, testData.project.id, "shared");
      await prisma.project.update({
        where: { id: testData.project.id },
        data: { archived: true },
      });

      const { coOwnsShared, rows } = await repo.getCrossAuthorContent(
        testData.report.id,
        testData.lead.id,
      );

      expect(coOwnsShared).toBe(false);
      expect(rows).toEqual([]);
    });

    it("no assignments: a caller with no stage assignments co-owns nothing ([], coOwnsShared:false)", async () => {
      // testData.lead has no stageAssignment rows (cleanDatabase ran), and no
      // seedCoLead call added any. The early `myProjectIds.length === 0` guard
      // returns denied without touching foreign sections.
      const { coOwnsShared, rows } = await repo.getCrossAuthorContent(
        testData.report.id,
        testData.lead.id,
      );

      expect(coOwnsShared).toBe(false);
      expect(rows).toEqual([]);
    });
  });

  describe("getSharedNonArchivedProductIds — pair-scoped, non-archived only", () => {
    const ARCHIVED_PROJECT_ID = "a0000000-0000-4000-a000-000000000210";
    const AUTHOR_ONLY_PROJECT_ID = "a0000000-0000-4000-a000-000000000220";
    const SHARE_AUTHOR_ID = "c0000000-0000-4000-c000-000000000002";
    const BUILD_STAGE_ID = "b0000000-0000-4000-b000-000000000011";
    const QA_STAGE_ID = "b0000000-0000-4000-b000-000000000012";

    // testData.project is shared + non-archived: the viewer (testData.lead)
    // owns Build, the author owns QA. The same pair also co-owns an ARCHIVED
    // project; the author additionally owns a non-archived project alone.
    async function seedSharing() {
      const author = await prisma.user.create({
        data: {
          id: SHARE_AUTHOR_ID,
          email: "author@test.local",
          name: "Boris Author",
          lastName: "Boris",
          firstName: "Author",
          role: "lead",
          samlId: "author-test",
          reportingGroupId: testData.head.reportingGroupId,
        },
      });
      await prisma.stage.createMany({
        data: [
          { id: BUILD_STAGE_ID, name: "Build", sortOrder: 1 },
          { id: QA_STAGE_ID, name: "QA", sortOrder: 2 },
        ],
      });
      await prisma.project.create({
        data: {
          id: ARCHIVED_PROJECT_ID,
          name: "Archived Shared",
          leadId: author.id,
          archived: true,
        },
      });
      await prisma.project.create({
        data: {
          id: AUTHOR_ONLY_PROJECT_ID,
          name: "Author Only",
          leadId: author.id,
        },
      });
      await prisma.groupProduct.createMany({
        data: [
          {
            groupId: expectDefined(testData.lead.reportingGroupId),
            productId: ARCHIVED_PROJECT_ID,
          },
          {
            groupId: expectDefined(testData.lead.reportingGroupId),
            productId: AUTHOR_ONLY_PROJECT_ID,
          },
        ],
      });
      await prisma.stageAssignment.createMany({
        data: [
          {
            userId: testData.lead.id,
            stageId: BUILD_STAGE_ID,
            projectId: testData.project.id,
          },
          {
            userId: author.id,
            stageId: QA_STAGE_ID,
            projectId: testData.project.id,
          },
          {
            userId: testData.lead.id,
            stageId: BUILD_STAGE_ID,
            projectId: ARCHIVED_PROJECT_ID,
          },
          {
            userId: author.id,
            stageId: QA_STAGE_ID,
            projectId: ARCHIVED_PROJECT_ID,
          },
          {
            userId: author.id,
            stageId: BUILD_STAGE_ID,
            projectId: AUTHOR_ONLY_PROJECT_ID,
          },
        ],
      });
      return author;
    }

    it("returns only the shared non-archived product (archived + author-only excluded)", async () => {
      const author = await seedSharing();

      const shared = await repo.getSharedNonArchivedProductIds(
        testData.lead.id,
        author.id,
      );

      expect(shared).toEqual([testData.project.id]);
    });

    it("returns [] when the viewer holds no stage assignments", async () => {
      const author = await seedSharing();

      const shared = await repo.getSharedNonArchivedProductIds(
        testData.head.id,
        author.id,
      );

      expect(shared).toEqual([]);
    });
  });
});
