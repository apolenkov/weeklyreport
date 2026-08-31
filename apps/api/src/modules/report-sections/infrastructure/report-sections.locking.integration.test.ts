import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import {
  ReportSectionsService,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const testGraceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });
const PUBLISHED_AT = new Date("2026-08-02T10:00:00.000Z");

describe("ReportSectionsPrismaRepository (integration) — locking, identity & write gates", () => {
  const prisma = createTestPrisma();
  let repo: ReportSectionsPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  const stageId = "a0000000-0000-4000-a000-000000000aa1";

  async function assignLeadToProject() {
    await prisma.stage.create({
      data: { id: stageId, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId,
        projectId: testData.project.id,
      },
    });
  }

  beforeAll(() => {
    // PrismaClient structurally satisfies PrismaService (both extend PrismaClient)
    repo = new ReportSectionsPrismaRepository(
      prisma as unknown as PrismaService,
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  // Lock must compare against client-loaded version, not a just-refetched row.
  describe("optimistic lock (lost-update guard via saveDraft)", () => {
    const draftAtVersion = (version: number) => ({
      reportSectionId: testData.section.id,
      version,
      status: "draft" as const,
      projectStatuses: [],
      stageStatuses: [],
      activityStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    });

    it("bumps the row version and returns it in the saved read model", async () => {
      const service = new ReportSectionsService(repo, testGraceSettings);

      // Seed rows are minted at version 1.
      const saved = await service.saveDraft(
        draftAtVersion(1),
        testData.lead.id,
      );

      expect(saved.version).toBe(2);
    });

    it("rejects a second writer that carries a stale loaded version", async () => {
      const service = new ReportSectionsService(repo, testGraceSettings);

      // First writer loaded version 1, saves, and bumps the row to 2.
      await service.saveDraft(draftAtVersion(1), testData.lead.id);

      // Second writer also loaded version 1, edits offline, and saves last.
      // The row is now at 2, so the compare-and-set finds no match.
      await expect(
        service.saveDraft(draftAtVersion(1), testData.lead.id),
      ).rejects.toThrow(SectionVersionConflictError);
    });

    it("lets the second writer succeed after reloading the fresh version", async () => {
      const service = new ReportSectionsService(repo, testGraceSettings);

      await service.saveDraft(draftAtVersion(1), testData.lead.id);
      // Reload surfaces version 2; round-tripping it clears the conflict.
      const recovered = await service.saveDraft(
        draftAtVersion(2),
        testData.lead.id,
      );

      expect(recovered.version).toBe(3);
    });
  });

  // Repo FOR UPDATE fails closed on published even if service gate is raced.
  describe("publish/save mutual exclusion (repo-level row lock)", () => {
    it("fails a direct repository save closed on a published report, touching no child rows", async () => {
      const section = await repo.getSectionById(testData.section.id);
      if (!section) {
        throw new Error("seed section missing");
      }

      await prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt: PUBLISHED_AT,
          publishedSnapshot: publishedSnapshotFixture({
            reportId: testData.report.id,
            periodStart: testData.report.periodStart,
            periodEnd: testData.report.periodEnd,
            publishedAt: PUBLISHED_AT,
          }),
        },
      });
      const itemsBefore = await prisma.item.findMany({
        where: { reportSectionId: testData.section.id },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      await expect(repo.saveSection(section, section.version)).rejects.toThrow(
        "Cannot edit sections of a published report.",
      );

      const itemsAfter = await prisma.item.findMany({
        where: { reportSectionId: testData.section.id },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      expect(itemsAfter).toEqual(itemsBefore);
    });
  });

  // stableId must outlive delete-recreate; mint once for new records.
  describe("durable record identity (stableId)", () => {
    beforeEach(async () => {
      await assignLeadToProject();
      await prisma.projectStatus.create({
        data: {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          status: "green",
        },
      });
    });

    async function saveOneItem(text: string, stableId?: string) {
      const original = expectDefined(
        await repo.getSectionById(testData.section.id),
      );
      const modified = {
        ...original,
        items: [
          {
            stableId,
            projectId: testData.project.id,
            type: "current" as const,
            text,
            tag: "feature",
            workflowStatus: "in_progress" as const,
            carriedOver: false,
            stageNames: ["Development"],
          },
        ],
      };
      return repo.saveSection(modified, modified.version);
    }

    it("preserves stableId across a save while the PK id is re-minted", async () => {
      const first = await saveOneItem("original text");
      const item1 = expectDefined(first.items[0]);
      const stableId = expectDefined(item1.stableId);
      // Lineage key is distinct from the volatile PK.
      expect(stableId).not.toBe(item1.id);

      // Edit unrelated text, round-tripping the stableId the client loaded.
      const second = await saveOneItem("edited text", stableId);
      const item2 = expectDefined(second.items[0]);

      expect(item2.stableId).toBe(stableId); // survived the recreate
      expect(item2.text).toBe("edited text");
      expect(item2.id).not.toBe(item1.id); // PK re-minted by the delete-recreate
    });

    it("mints a stableId for a brand-new record and keeps it on the next save", async () => {
      const first = await saveOneItem("new item"); // no stableId supplied
      const minted = expectDefined(expectDefined(first.items[0]).stableId);
      expect(minted).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      const second = await saveOneItem("new item edited", minted);
      expect(expectDefined(second.items[0]).stableId).toBe(minted);
    });

    it("gives two records in one section distinct stableIds that survive a re-save", async () => {
      const original = expectDefined(
        await repo.getSectionById(testData.section.id),
      );
      const twoItems = {
        ...original,
        items: ["one", "two"].map((text) => ({
          projectId: testData.project.id,
          type: "current" as const,
          text,
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: false,
          stageNames: ["Development"],
        })),
      };
      const saved = await repo.saveSection(twoItems, twoItems.version);
      const ids = saved.items.map((i) => expectDefined(i.stableId));
      expect(new Set(ids).size).toBe(2);

      // Re-save round-tripping both stableIds: the delete-recreate happens inside
      // one transaction, so the @@unique([reportSectionId, stableId]) guard must
      // not trip on the reinserted rows.
      const roundTrip = expectDefined(
        await repo.getSectionById(testData.section.id),
      );
      await expect(
        repo.saveSection(roundTrip, roundTrip.version),
      ).resolves.toBeDefined();
      const reread = expectDefined(
        await repo.getSectionById(testData.section.id),
      );
      expect(
        new Set(reread.items.map((i) => expectDefined(i.stableId))).size,
      ).toBe(2);
    });

    it("round-trips stableId through the saveDraft service path (input optional, read model preserved)", async () => {
      // This is the make-or-break for the OPTIONAL read model: the FIRST save
      // carries a new item with NO stableId, so mergeSection (which parses the
      // raw input items against the read-model schema) must not reject it.
      const service = new ReportSectionsService(repo, testGraceSettings);
      const itemInput = (text: string, stableId?: string) => ({
        ...(stableId ? { stableId } : {}),
        projectId: testData.project.id,
        type: "current" as const,
        text,
        tag: "feature",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
        stageNames: ["Development"],
      });

      const created = await service.saveDraft(
        {
          reportSectionId: testData.section.id,
          version: 1,
          status: "draft",
          projectStatuses: [
            { projectId: testData.project.id, status: "green" },
          ],
          stageStatuses: [],
          activityStatuses: [],
          items: [itemInput("svc item")],
          risks: [],
          decisions: [],
        },
        testData.lead.id,
      );
      const stableId = expectDefined(expectDefined(created.items[0]).stableId);

      const updated = await service.saveDraft(
        {
          reportSectionId: testData.section.id,
          version: created.version,
          status: "draft",
          projectStatuses: [
            { projectId: testData.project.id, status: "green" },
          ],
          stageStatuses: [],
          activityStatuses: [],
          items: [itemInput("svc item edited", stableId)],
          risks: [],
          decisions: [],
        },
        testData.lead.id,
      );
      expect(expectDefined(updated.items[0]).stableId).toBe(stableId);
      expect(expectDefined(updated.items[0]).text).toBe("svc item edited");
    });
  });

  // Gate on periodStatus, not just status; reopened stays editable.
  describe("period-status write gates", () => {
    it("saveDraft persists on a reopened period even though status reads published", async () => {
      await assignLeadToProject();
      await prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodState: "open",
          periodStatus: "reopened",
          publishedAt: PUBLISHED_AT,
          reopenedAt: new Date("2026-08-01T09:00:00.000Z"),
          publishedSnapshot: publishedSnapshotFixture({
            reportId: testData.report.id,
            periodStart: testData.report.periodStart,
            periodEnd: testData.report.periodEnd,
            publishedAt: PUBLISHED_AT,
          }),
        },
      });

      const service = new ReportSectionsService(repo, testGraceSettings);
      const saved = await service.saveDraft(
        {
          reportSectionId: testData.section.id,
          version: 1,
          status: "draft",
          projectStatuses: [],
          stageStatuses: [],
          activityStatuses: [],
          items: [],
          risks: [],
          decisions: [],
        },
        testData.lead.id,
      );

      expect(saved.version).toBe(2);
    });

    it("submitSection on a published period is rejected and leaves the child rows unchanged", async () => {
      await assignLeadToProject();
      await prisma.projectStatus.create({
        data: {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          status: "green",
        },
      });
      const item = await prisma.item.create({
        data: {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          type: "current",
          text: "Live item",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageNames: ["Development"],
        },
      });
      const risk = await prisma.risk.create({
        data: {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          risk: "Live risk",
          impact: "High",
          mitigation: "Mitigate",
          severity: "at-risk",
          stageNames: ["Development"],
        },
      });
      const decision = await prisma.decision.create({
        data: {
          reportSectionId: testData.section.id,
          productId: testData.project.id,
          text: "Live decision",
          owner: "Owner",
          impact: "Medium",
          stageNames: ["Development"],
        },
      });

      await prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt: PUBLISHED_AT,
          publishedSnapshot: publishedSnapshotFixture({
            reportId: testData.report.id,
            periodStart: testData.report.periodStart,
            periodEnd: testData.report.periodEnd,
            publishedAt: PUBLISHED_AT,
          }),
        },
      });

      const service = new ReportSectionsService(repo, testGraceSettings);
      await expect(
        service.submitSection(
          {
            reportSectionId: testData.section.id,
            version: 1,
            status: "draft",
            confirmed: true,
            projectStatuses: [
              { projectId: testData.project.id, status: "green" },
            ],
            items: [],
            risks: [],
            decisions: [],
            stageStatuses: [
              { projectId: testData.project.id, stageId, status: "green" },
            ],
            activityStatuses: [],
          },
          testData.lead.id,
        ),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Cannot submit sections of a published report.",
      });

      // saveSection delete-recreates every child row with a fresh PK, so the
      // ORIGINAL PKs surviving proves the destructive write never ran — a
      // "rows still exist" check would also pass a delete-recreate.
      expect(
        await prisma.item.findUnique({ where: { id: item.id } }),
      ).not.toBeNull();
      expect(
        await prisma.risk.findUnique({ where: { id: risk.id } }),
      ).not.toBeNull();
      expect(
        await prisma.decision.findUnique({ where: { id: decision.id } }),
      ).not.toBeNull();
    });
  });
});
