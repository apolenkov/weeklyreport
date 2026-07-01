import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";
import {
  ReportSectionsService,
  SectionVersionConflictError,
} from "./report-sections.service";

describe("ReportSectionsPrismaRepository (integration)", () => {
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
    repo = new ReportSectionsPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("getSectionById returns full section with nested relations", async () => {
    await assignLeadToProject();
    // Seed additional nested data for the section
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Integration test item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
      },
    });

    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Test risk",
        impact: "High",
        mitigation: "Mitigate it",
      },
    });

    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Test decision",
        owner: "Test Lead 1",
        impact: "Medium",
      },
    });

    const result = await repo.getSectionById(testData.section.id);

    expect(result).not.toBeNull();
    expect(expectDefined(result).reportSectionId).toBe(testData.section.id);
    expect(expectDefined(result).authorName).toBe("Test Lead 1");
    expect(expectDefined(result).status).toBe("draft");
    expect(expectDefined(result).projects).toHaveLength(1);
    // W6 (fix-published-empty-stage-risk-floor): the fixture's risk has the
    // schema-default `severity: "at-risk"` and empty stageNames (covers-all),
    // so it now floors the owned stage's product status up to yellow at the
    // read layer. The dedicated "floors trafficLight by an own covering risk"
    // test pins this semantics; here we only track the consequence.
    expect(expectDefined(expectDefined(result).projects[0]).trafficLight).toBe(
      "yellow",
    );
    expect(expectDefined(result).items).toHaveLength(1);
    expect(expectDefined(expectDefined(result).items[0]).text).toBe(
      "Integration test item",
    );
    expect(expectDefined(result).risks).toHaveLength(1);
    expect(expectDefined(result).decisions).toHaveLength(1);
  });

  it("getSectionById returns null for non-existent ID", async () => {
    const result = await repo.getSectionById(
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    );
    expect(result).toBeNull();
  });

  it("getSectionById excludes product-owner projects without StageAssignment", async () => {
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "red",
      },
    });

    const result = await repo.getSectionById(testData.section.id);

    expect(result).not.toBeNull();
    expect(expectDefined(result).projects).toEqual([]);
  });

  it("submitSection ignores product-owner projects without StageAssignment", async () => {
    await assignLeadToProject();
    const ownerOnlyProject = await prisma.project.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000101",
        name: "Owner metadata only",
        leadId: testData.lead.id,
      },
    });

    await prisma.projectStatus.createMany({
      data: [
        {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          status: "green",
        },
        {
          reportSectionId: testData.section.id,
          projectId: ownerOnlyProject.id,
          status: "red",
        },
      ],
    });

    const service = new ReportSectionsService(repo);
    const result = await service.submitSection({
      reportSectionId: testData.section.id,
      version: 1,
      status: "draft",
      confirmed: true,
      projectStatuses: [{ projectId: testData.project.id, status: "green" }],
      items: [
        {
          projectId: testData.project.id,
          type: "current",
          text: "Current work for assigned stage only",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageIds: ["Development"],
        },
      ],
      risks: [],
      decisions: [],
      stageStatuses: [
        {
          projectId: testData.project.id,
          stageId,
          status: "green",
        },
      ],
    });

    expect(result.status).toBe("submitted");
    expect(result.projects).toHaveLength(1);
    expect(expectDefined(result.projects[0]).projectId).toBe(
      testData.project.id,
    );

    const ownerOnlyStatus = await prisma.projectStatus.findUnique({
      where: {
        reportSectionId_projectId: {
          reportSectionId: testData.section.id,
          projectId: ownerOnlyProject.id,
        },
      },
    });
    expect(ownerOnlyStatus).toBeNull();
  });

  it("getSectionById surfaces authorRole + projects[i].ownedStages from StageAssignment (35-03/04)", async () => {
    await assignLeadToProject();
    await prisma.stageStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        stageId,
        status: "yellow",
      },
    });

    const result = await repo.getSectionById(testData.section.id);
    expect(result).not.toBeNull();
    // 35-03: authorRole flows through from User.role.
    expect(expectDefined(result).authorRole).toBe("lead");
    // 35-04: owned stages on the project mirror the StageAssignment row.
    const project = expectDefined(expectDefined(result).projects[0]);
    expect(project.ownedStages).toEqual([
      expect.objectContaining({
        stageName: "Development",
        sortOrder: 3,
        status: "yellow",
      }),
    ]);
    expect(project.trafficLight).toBe("yellow");
  });

  it("saveSection persists stageName on Item / Risk / Decision / Priority (35-04)", async () => {
    await assignLeadToProject();
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    const original = await repo.getSectionById(testData.section.id);
    const modified = {
      ...expectDefined(original),
      items: [
        {
          projectId: testData.project.id,
          type: "current" as const,
          text: "Item with stage",
          tag: "feature",
          workflowStatus: "in_progress" as const,
          carriedOver: false,
          stageIds: ["Development"],
        },
      ],
      risks: [
        {
          projectId: testData.project.id,
          risk: "Risk",
          impact: "Impact",
          mitigation: "Mitigation",
          severity: "blocked" as const,
          stageIds: ["Testing"],
        },
      ],
      decisions: [
        {
          text: "Decision",
          owner: "Owner",
          deadline: null,
          impact: "Impact",
          resolvedAt: null,
          stageIds: ["Design"],
          productId: testData.project.id,
        },
      ],
    };

    const saved = await repo.saveSection(modified, modified.version);
    expect(expectDefined(saved.items[0]).stageIds).toEqual(["Development"]);
    expect(expectDefined(saved.risks[0]).stageIds).toEqual(["Testing"]);
    expect(expectDefined(saved.risks[0]).severity).toBe("blocked");
    expect(expectDefined(saved.decisions[0]).stageIds).toEqual(["Design"]);
  });

  // fix-published-empty-stage-risk-floor (task 4.1): the derived effective
  // product status reflects the author's OWN covering risk on an owned stage
  // with no submitted status (raw StageStatus.status = null). The author owns
  // "Development"; a covers-all blocked own risk (empty stageIds) and a stale
  // green ProjectStatus must read red through the read-layer floor, while the
  // raw persisted stage status stays null (D4).
  it("getSectionById floors trafficLight by an own covering risk on an owned empty stage", async () => {
    await assignLeadToProject();
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });
    // No StageStatus row for the owned "Development" stage -> raw status null.
    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Vendor outage",
        impact: "High",
        mitigation: "Failover",
        severity: "blocked",
        stageNames: [],
      },
    });

    const section = expectDefined(
      await repo.getSectionById(testData.section.id),
    );
    const project = expectDefined(
      section.projects.find((p) => p.projectId === testData.project.id),
    );
    expect(project.trafficLight).toBe("red");
    // D4: the raw per-stage status is untouched (no submitted status).
    expect(
      project.ownedStages?.find((s) => s.stageName === "Development")?.status ??
        null,
    ).toBeNull();
  });

  it("saveSection persists all nested entities and returns updated section", async () => {
    await assignLeadToProject();
    // First seed a project status so the section has a project
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    // Get the section via the repository
    const original = await repo.getSectionById(testData.section.id);
    expect(original).not.toBeNull();

    // Modify the section with new items, risks, decisions
    const modified = {
      ...expectDefined(original),
      status: "draft" as const,
      projects: [
        {
          projectId: testData.project.id,
          projectName: "Test Project 1",
          trafficLight: "yellow" as const,
        },
      ],
      items: [
        {
          projectId: testData.project.id,
          type: "current" as const,
          text: "Saved item",
          tag: "bugfix",
          workflowStatus: "done" as const,
          carriedOver: false,
        },
      ],
      risks: [
        {
          projectId: testData.project.id,
          risk: "Saved risk",
          impact: "Low",
          mitigation: "None needed",
        },
      ],
      decisions: [
        {
          text: "Saved decision",
          owner: "Lead",
          deadline: null,
          impact: "High",
          resolvedAt: null,
          productId: testData.project.id,
        },
      ],
    };

    const saved = await repo.saveSection(modified, modified.version);

    expect(saved.reportSectionId).toBe(testData.section.id);
    expect(saved.projects).toHaveLength(1);
    expect(expectDefined(saved.projects[0]).trafficLight).toBe("yellow");
    expect(saved.items).toHaveLength(1);
    expect(expectDefined(saved.items[0]).text).toBe("Saved item");
    expect(saved.risks).toHaveLength(1);
    expect(expectDefined(saved.risks[0]).risk).toBe("Saved risk");
    expect(saved.decisions).toHaveLength(1);
    expect(expectDefined(saved.decisions[0]).text).toBe("Saved decision");
  });

  it("saveSection persists Decision.productId and getSectionById returns it (R4-C)", async () => {
    await assignLeadToProject();
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    const original = await repo.getSectionById(testData.section.id);
    const modified = {
      ...expectDefined(original),
      decisions: [
        {
          text: "Decision with product",
          owner: "Lead",
          deadline: null,
          impact: "High",
          resolvedAt: null,
          productId: testData.project.id,
        },
      ],
    };

    const saved = await repo.saveSection(modified, modified.version);
    expect(saved.decisions).toHaveLength(1);
    expect(expectDefined(saved.decisions[0]).productId).toBe(
      testData.project.id,
    );

    // Confirm persistence via a fresh read
    const refetched = await repo.getSectionById(testData.section.id);
    expect(expectDefined(refetched).decisions).toHaveLength(1);
    expect(expectDefined(expectDefined(refetched).decisions[0]).productId).toBe(
      testData.project.id,
    );
  });

  // Optimistic-lock characterization, driven through the SERVICE (saveDraft)
  // rather than the repository, so it exercises the full path that decides the
  // expected version: the lock must compare against the CLIENT-loaded value
  // carried in the payload, not the row the service just re-fetched. If it ever
  // regressed to the fetched row, the second save below would silently succeed
  // (lost update) instead of conflicting.
  describe("optimistic lock (lost-update guard via saveDraft)", () => {
    const draftAtVersion = (version: number) => ({
      reportSectionId: testData.section.id,
      version,
      status: "draft" as const,
      projectStatuses: [],
      stageStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    });

    it("bumps the row version and returns it in the saved read model", async () => {
      const service = new ReportSectionsService(repo);

      // Seed rows are minted at version 1.
      const saved = await service.saveDraft(draftAtVersion(1));

      expect(saved.version).toBe(2);
    });

    it("rejects a second writer that carries a stale loaded version", async () => {
      const service = new ReportSectionsService(repo);

      // First writer loaded version 1, saves, and bumps the row to 2.
      await service.saveDraft(draftAtVersion(1));

      // Second writer also loaded version 1, edits offline, and saves last.
      // The row is now at 2, so the compare-and-set finds no match.
      await expect(service.saveDraft(draftAtVersion(1))).rejects.toThrow(
        SectionVersionConflictError,
      );
    });

    it("lets the second writer succeed after reloading the fresh version", async () => {
      const service = new ReportSectionsService(repo);

      await service.saveDraft(draftAtVersion(1));
      // Reload surfaces version 2; round-tripping it clears the conflict.
      const recovered = await service.saveDraft(draftAtVersion(2));

      expect(recovered.version).toBe(3);
    });
  });

  // introduce-durable-record-identity: a record's stableId must outlive
  // saveSection's delete-recreate (the PK id is re-minted every write) and be
  // minted once for a brand-new record. These go through the real DB so the
  // `@default(uuid())` mint and the (reportSectionId, stableId) guard are
  // exercised, not mocked.
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
            stageIds: ["Development"],
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
          stageIds: ["Development"],
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
      const service = new ReportSectionsService(repo);
      const itemInput = (text: string, stableId?: string) => ({
        ...(stableId ? { stableId } : {}),
        projectId: testData.project.id,
        type: "current" as const,
        text,
        tag: "feature",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
        stageIds: ["Development"],
      });

      const created = await service.saveDraft({
        reportSectionId: testData.section.id,
        version: 1,
        status: "draft",
        projectStatuses: [{ projectId: testData.project.id, status: "green" }],
        stageStatuses: [],
        items: [itemInput("svc item")],
        risks: [],
        decisions: [],
      });
      const stableId = expectDefined(expectDefined(created.items[0]).stableId);

      const updated = await service.saveDraft({
        reportSectionId: testData.section.id,
        version: created.version,
        status: "draft",
        projectStatuses: [{ projectId: testData.project.id, status: "green" }],
        stageStatuses: [],
        items: [itemInput("svc item edited", stableId)],
        risks: [],
        decisions: [],
      });
      expect(expectDefined(updated.items[0]).stableId).toBe(stableId);
      expect(expectDefined(updated.items[0]).text).toBe("svc item edited");
    });
  });
});
