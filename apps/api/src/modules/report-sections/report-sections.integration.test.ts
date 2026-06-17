import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";
import { ReportSectionsService } from "./report-sections.service";

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

    const saved = await repo.saveSection(modified);
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

    const saved = await repo.saveSection(modified);

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

    const saved = await repo.saveSection(modified);
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
});
