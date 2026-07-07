// Real-DB integration coverage for Project Activities: admin CRUD + M:M lead
// attachment, ActivityStatus seeding at section provisioning, independent
// per-lead statuses through the section save, the period-dual-state
// exemption (a lead save writes child rows only — never the Report period),
// the detach cascade on editable periods, and the group-move guard.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { ensureLeadSection } from "../report-sections/domain/ensure-lead-section";
import { ReportSectionsPrismaRepository } from "../report-sections/infrastructure/report-sections.prisma-repository";
import { ProjectActivityPrismaRepository } from "./project-activity.prisma-repository";
import {
  ProjectActivityDomainError,
  ProjectActivityService,
} from "./project-activity.service";

describe("ProjectActivity (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ProjectActivityPrismaRepository;
  let sectionsRepo: ReportSectionsPrismaRepository;

  const groupA = "b0000000-0000-4000-a000-000000000001";
  const leadA = "b0000000-0000-4000-a000-000000000002";
  const leadB = "b0000000-0000-4000-a000-000000000003";
  const productId = "b0000000-0000-4000-a000-000000000004";
  const reportId = "b0000000-0000-4000-a000-000000000005";
  const activityId = "b0000000-0000-4000-a000-000000000006";

  beforeAll(() => {
    repo = new ProjectActivityPrismaRepository(prisma as never);
    sectionsRepo = new ReportSectionsPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await prisma.reportingGroup.create({
      data: { id: groupA, name: "Core Development" },
    });
    await prisma.user.createMany({
      data: [
        {
          id: leadA,
          email: "lead-a@test.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "pa-lead-a",
          reportingGroupId: groupA,
        },
        {
          id: leadB,
          email: "lead-b@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "pa-lead-b",
          reportingGroupId: groupA,
        },
      ],
    });
    await prisma.project.create({
      data: { id: productId, name: "CRM Portal", leadId: leadA },
    });
    await prisma.report.create({
      data: {
        id: reportId,
        periodStart: new Date("2026-06-29T00:00:00.000Z"),
        periodEnd: new Date("2026-07-05T00:00:00.000Z"),
        deadline: new Date("2026-07-03T15:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "open",
      },
    });
    await prisma.projectActivity.create({
      data: {
        id: activityId,
        name: "Jira triage duty",
        groupId: groupA,
        activityProducts: { create: [{ productId }] },
        jiraAccounts: ["OPS", "SUP-billing"],
      },
    });
    await prisma.projectActivityLead.createMany({
      data: [
        { activityId, leadId: leadA },
        { activityId, leadId: leadB },
      ],
    });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("round-trips the admin read model with lead attachments and Jira accounts", async () => {
    const activity = await repo.findById(activityId);

    expect(activity).toMatchObject({
      id: activityId,
      name: "Jira triage duty",
      groupId: groupA,
      jiraAccounts: ["OPS", "SUP-billing"],
      archived: false,
    });
    expect(activity?.linkedProducts).toEqual([
      { productId, productName: "CRM Portal" },
    ]);
    expect(activity?.leadIds).toEqual([leadA, leadB].sort());
  });

  it("attach is idempotent and detach removes exactly one edge", async () => {
    await repo.attachLead({ activityId, leadId: leadA });
    await repo.detachLead({ activityId, leadId: leadB });

    const activity = await repo.findById(activityId);
    expect(activity?.leadIds).toEqual([leadA]);
  });

  it("seeds one default-green ActivityStatus per attached activity at section provisioning", async () => {
    const { sectionId } = await ensureLeadSection(prisma, reportId, leadA);

    const seeded = await prisma.activityStatus.findMany({
      where: { reportSectionId: sectionId },
    });
    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({ activityId, status: "green" });
  });

  it("does not seed archived activities", async () => {
    await prisma.projectActivity.update({
      where: { id: activityId },
      data: { archived: true },
    });

    const { sectionId } = await ensureLeadSection(prisma, reportId, leadA);

    const seeded = await prisma.activityStatus.findMany({
      where: { reportSectionId: sectionId },
    });
    expect(seeded).toEqual([]);
  });

  it("two leads report independent statuses for one activity, and the save writes no Report period field", async () => {
    const { sectionId: sectionA } = await ensureLeadSection(
      prisma,
      reportId,
      leadA,
    );
    const { sectionId: sectionB } = await ensureLeadSection(
      prisma,
      reportId,
      leadB,
    );
    const reportBefore = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });

    const readA = await sectionsRepo.getSectionById(sectionA);
    const readB = await sectionsRepo.getSectionById(sectionB);
    if (!readA || !readB) throw new Error("expected both sections to load");

    await sectionsRepo.saveSection(
      {
        ...readA,
        activities: readA.activities.map((activity) => ({
          ...activity,
          status: "red" as const,
          note: "Blocked on vendor",
        })),
      },
      readA.version,
    );
    await sectionsRepo.saveSection(
      {
        ...readB,
        activities: readB.activities.map((activity) => ({
          ...activity,
          status: "green" as const,
        })),
      },
      readB.version,
    );

    const rows = await prisma.activityStatus.findMany({
      where: { activityId },
      orderBy: { reportSectionId: "asc" },
    });
    expect(rows).toHaveLength(2);
    const byId = new Map(rows.map((row) => [row.reportSectionId, row]));
    expect(byId.get(sectionA)).toMatchObject({
      status: "red",
      note: "Blocked on vendor",
    });
    expect(byId.get(sectionB)).toMatchObject({ status: "green", note: null });

    // period-dual-state exemption: the section save writes child rows only —
    // every Report period/lifecycle field is byte-identical after both saves.
    const reportAfter = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(reportAfter.periodState).toBe(reportBefore.periodState);
    expect(reportAfter.periodStatus).toBe(reportBefore.periodStatus);
    expect(reportAfter.status).toBe(reportBefore.status);
    expect(reportAfter.archived).toBe(reportBefore.archived);
    expect(reportAfter.periodStart.getTime()).toBe(
      reportBefore.periodStart.getTime(),
    );
    expect(reportAfter.periodEnd.getTime()).toBe(
      reportBefore.periodEnd.getTime(),
    );
  });

  it("the section read model surfaces the seeded activity with its name", async () => {
    const { sectionId } = await ensureLeadSection(prisma, reportId, leadA);

    const section = await sectionsRepo.getSectionById(sectionId);

    expect(section?.activities).toEqual([
      {
        activityId,
        activityName: "Jira triage duty",
        status: "green",
        note: null,
        // activity-first-class: the read model now joins the label-only linked
        // products and the risk/blocker-derived floor (no records here -> stored;
        // alarmFloor null because no covering risk/blocker).
        linkedProducts: [{ productId, productName: "CRM Portal" }],
        derivedStatus: "green",
        alarmFloor: null,
      },
    ]);
  });

  it("detach cascades the lead's ActivityStatus rows on open periods and leaves published history frozen", async () => {
    const publishedReportId = "b0000000-0000-4000-a000-000000000007";
    const publishedSectionId = "b0000000-0000-4000-a000-000000000008";
    const { sectionId: openSectionA } = await ensureLeadSection(
      prisma,
      reportId,
      leadA,
    );
    const { sectionId: openSectionB } = await ensureLeadSection(
      prisma,
      reportId,
      leadB,
    );
    // A prior published period carrying leadB's frozen status for the same
    // activity — detach must never rewrite that history.
    await prisma.report.create({
      data: {
        id: publishedReportId,
        periodStart: new Date("2026-06-22T00:00:00.000Z"),
        periodEnd: new Date("2026-06-28T00:00:00.000Z"),
        deadline: new Date("2026-06-26T15:00:00.000Z"),
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: new Date("2026-06-26T16:00:00.000Z"),
      },
    });
    await prisma.reportSection.create({
      data: {
        id: publishedSectionId,
        reportId: publishedReportId,
        authorId: leadB,
        status: "submitted",
      },
    });
    await prisma.activityStatus.create({
      data: {
        reportSectionId: publishedSectionId,
        activityId,
        status: "yellow",
        note: "Frozen in the published record",
      },
    });

    await repo.detachLead({ activityId, leadId: leadB });

    // The join edge is gone; leadA stays attached.
    const activity = await repo.findById(activityId);
    expect(activity?.leadIds).toEqual([leadA]);
    // leadB's open-period row is cascaded away; leadA's row survives.
    expect(
      await prisma.activityStatus.findMany({
        where: { reportSectionId: openSectionB },
      }),
    ).toEqual([]);
    expect(
      await prisma.activityStatus.findMany({
        where: { reportSectionId: openSectionA },
      }),
    ).toHaveLength(1);
    // The published-period row stays byte-identical.
    const frozen = await prisma.activityStatus.findMany({
      where: { reportSectionId: publishedSectionId },
    });
    expect(frozen).toHaveLength(1);
    expect(frozen[0]).toMatchObject({
      activityId,
      status: "yellow",
      note: "Frozen in the published record",
    });
  });

  it("after detach the re-fetched section omits the activity and a round-trip save passes", async () => {
    const { sectionId } = await ensureLeadSection(prisma, reportId, leadB);

    await repo.detachLead({ activityId, leadId: leadB });

    const section = await sectionsRepo.getSectionById(sectionId);
    if (!section) throw new Error("expected the section to load");
    expect(section.activities).toEqual([]);

    // The lead's next save round-trips the re-fetched model — no bricked save.
    const saved = await sectionsRepo.saveSection(section, section.version);
    expect(saved.activities).toEqual([]);
  });

  it("rejects a group move while attachments exist and allows it after detaching", async () => {
    const service = new ProjectActivityService(repo);
    const groupB = "b0000000-0000-4000-a000-000000000009";
    await prisma.reportingGroup.create({
      data: { id: groupB, name: "Integrations" },
    });

    await expect(
      service.update({
        id: activityId,
        name: "Jira triage duty",
        groupId: groupB,
        linkedProductIds: [productId],
        jiraAccounts: [],
      }),
    ).rejects.toBeInstanceOf(ProjectActivityDomainError);

    await service.detachLead({ activityId, leadId: leadA });
    await service.detachLead({ activityId, leadId: leadB });

    const moved = await service.update({
      id: activityId,
      name: "Jira triage duty",
      groupId: groupB,
      linkedProductIds: [productId],
      jiraAccounts: [],
    });
    expect(moved.groupId).toBe(groupB);
  });
});
