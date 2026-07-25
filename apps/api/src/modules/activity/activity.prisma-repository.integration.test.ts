import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { ActivityPrismaRepository } from "./activity.prisma-repository";

describe("ActivityPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new ActivityPrismaRepository(prisma as never);

  const groupA = "a0000000-0000-4000-a000-000000000401";
  const groupB = "a0000000-0000-4000-a000-000000000402";
  const headA = "a0000000-0000-4000-a000-000000000403";
  const leadA = "a0000000-0000-4000-a000-000000000404";
  const leadB = "a0000000-0000-4000-a000-000000000405";
  const reportId = "a0000000-0000-4000-a000-000000000406";

  const headSession: UserSession = {
    userId: headA,
    email: "head-a@test.local",
    name: "Head A",
    role: "head",
    reportingGroupId: groupA,
  };

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await prisma.reportingGroup.createMany({
      data: [
        { id: groupA, name: "Core Development", description: null },
        { id: groupB, name: "Finance", description: null },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: headA,
          email: "head-a@test.local",
          name: "Head A",
          lastName: "Head",
          firstName: "A",
          role: "head",
          samlId: "head-a",
          reportingGroupId: groupA,
        },
        {
          id: leadA,
          email: "lead-a@test.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "lead-a",
          reportingGroupId: groupA,
        },
        {
          id: leadB,
          email: "lead-b@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "lead-b",
          reportingGroupId: groupB,
        },
      ],
    });
    await prisma.report.create({
      data: {
        id: reportId,
        periodStart: new Date("2026-05-04T00:00:00.000Z"),
        periodEnd: new Date("2026-05-10T00:00:00.000Z"),
        deadline: new Date("2026-05-09T12:00:00.000Z"),
        status: "draft",
        periodStatus: "reopened",
        periodState: "open",
      },
    });
    await prisma.reportSection.createMany({
      data: [
        { reportId, authorId: leadA, status: "draft" },
        { reportId, authorId: leadB, status: "submitted" },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("scopes live rows to the head reporting group and includes reopened periods", async () => {
    const session: UserSession = {
      userId: headA,
      email: "head-a@test.local",
      name: "Head A",
      role: "head",
      reportingGroupId: groupA,
    };

    const result = await repo.getLiveActivity(reportId, session);

    expect(result.reportId).toBe(reportId);
    expect(result.periodStatus).toBe("reopened");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.leadId).toBe(leadA);
  });

  it("ignores a scheduled future-period report when resolving live activity for the current period", async () => {
    const futureReportId = "a0000000-0000-4000-a000-000000000407";
    const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.report.create({
      data: {
        id: futureReportId,
        periodStart: futureStart,
        periodEnd: new Date(futureStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        deadline: new Date(futureStart.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: "draft",
        periodStatus: "open",
        periodState: "scheduled",
      },
    });

    const session: UserSession = {
      userId: headA,
      email: "head-a@test.local",
      name: "Head A",
      role: "head",
      reportingGroupId: groupA,
    };

    const result = await repo.getLiveActivity(reportId, session);

    expect(result.reportId).toBe(reportId);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.leadId).toBe(leadA);
  });

  it("keeps a no-section lead in the published-report roster", async () => {
    const leadNoSection = "a0000000-0000-4000-a000-000000000410";
    await prisma.user.create({
      data: {
        id: leadNoSection,
        email: "lead-nosection@test.local",
        name: "Lead NoSection",
        lastName: "Lead",
        firstName: "NoSection",
        role: "lead",
        samlId: "lead-nosection",
        reportingGroupId: groupA,
      },
    });
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
      },
    });

    const result = await repo.getLiveActivity(reportId, headSession);

    expect(result.periodStatus).toBe("published");
    const row = result.rows.find((r) => r.leadId === leadNoSection);
    expect(row).toBeDefined();
    expect(row?.reportSectionId).toBeNull();
    expect(row?.status).toBe("draft");
    expect(row?.itemCount).toBe(0);
    expect(row?.riskCount).toBe(0);
    expect(row?.decisionCount).toBe(0);
    expect(row?.lastEditAt).toBeNull();
  });

  it("sorts a draft-status lead before a submitted-status lead regardless of name or record recency", async () => {
    // Draft must sort first even when a submitted lead has an earlier name and
    // a later edit: status dominates alpha tiebreaker and record recency.
    const leadSubmitted = "a0000000-0000-4000-a000-000000000411";
    const projectSubmitted = "a0000000-0000-4000-a000-000000000413";
    await prisma.user.create({
      data: {
        id: leadSubmitted,
        email: "lead-submitted@test.local",
        name: "AAA Submitted",
        lastName: "Submitted",
        firstName: "AAA",
        role: "lead",
        samlId: "lead-submitted",
        reportingGroupId: groupA,
      },
    });
    await prisma.project.create({
      data: {
        id: projectSubmitted,
        name: "Submitted Project",
        leadId: leadSubmitted,
      },
    });
    const submittedSection = await prisma.reportSection.create({
      data: { reportId, authorId: leadSubmitted, status: "submitted" },
    });
    await prisma.item.create({
      data: {
        reportSectionId: submittedSection.id,
        projectId: projectSubmitted,
        type: "current",
        text: "Late-edited submitted item",
        tag: "feature",
        workflowStatus: "done",
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    });

    const result = await repo.getLiveActivity(reportId, headSession);

    const draftIndex = result.rows.findIndex((r) => r.leadId === leadA);
    const submittedIndex = result.rows.findIndex(
      (r) => r.leadId === leadSubmitted,
    );
    expect(draftIndex).toBeGreaterThanOrEqual(0);
    expect(submittedIndex).toBeGreaterThan(draftIndex);
    expect(result.rows[draftIndex]?.status).toBe("draft");
    expect(result.rows[submittedIndex]?.status).toBe("submitted");
  });

  it("computes lastEditAt as the max across the LEAD's own records — a later reviewer comment does not count", async () => {
    // lastEditAt is max of the lead's own records, not section.updatedAt.
    // A later reviewer comment must not count — live activity tracks lead edits only.
    const leadMulti = "a0000000-0000-4000-a000-000000000420";
    const projectMulti = "a0000000-0000-4000-a000-000000000421";
    const sectionUpdatedAt = new Date("2026-05-05T10:00:00.000Z");
    const itemUpdatedAt = new Date("2026-05-06T10:00:00.000Z");
    const riskUpdatedAt = new Date("2026-05-07T10:00:00.000Z");
    const decisionUpdatedAt = new Date("2026-05-09T10:00:00.000Z");
    const commentAt = new Date("2026-05-12T10:00:00.000Z");

    await prisma.user.create({
      data: {
        id: leadMulti,
        email: "lead-multi@test.local",
        name: "Lead Multi",
        lastName: "Lead",
        firstName: "Multi",
        role: "lead",
        samlId: "lead-multi",
        reportingGroupId: groupA,
      },
    });
    await prisma.project.create({
      data: { id: projectMulti, name: "Multi Project", leadId: leadMulti },
    });
    const section = await prisma.reportSection.create({
      data: {
        reportId,
        authorId: leadMulti,
        status: "draft",
        updatedAt: sectionUpdatedAt,
      },
    });
    const item = await prisma.item.create({
      data: {
        reportSectionId: section.id,
        projectId: projectMulti,
        type: "current",
        text: "Multi item",
        tag: "feature",
        workflowStatus: "done",
        updatedAt: itemUpdatedAt,
      },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: section.id,
        projectId: projectMulti,
        risk: "Multi risk",
        impact: "High",
        mitigation: "Mitigate",
        severity: "at-risk",
        updatedAt: riskUpdatedAt,
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: section.id,
        productId: projectMulti,
        text: "Multi decision",
        owner: "Owner",
        impact: "High",
        updatedAt: decisionUpdatedAt,
      },
    });
    await prisma.recordComment.create({
      data: {
        reviewerId: headA,
        itemId: item.id,
        text: "Reviewer note",
        createdAt: commentAt,
        updatedAt: commentAt,
      },
    });

    const result = await repo.getLiveActivity(reportId, headSession);

    const row = result.rows.find((r) => r.leadId === leadMulti);
    expect(row).toBeDefined();
    // Max is the decision timestamp — later than the section's own updatedAt
    // and every other LEAD record; the even-later reviewer comment is
    // excluded from the recency signal by design.
    expect(row?.lastEditAt?.getTime()).toBe(decisionUpdatedAt.getTime());
    expect(row?.lastEditAt?.getTime()).toBeLessThan(commentAt.getTime());
    expect(row?.lastEditAt?.getTime()).toBeGreaterThan(
      sectionUpdatedAt.getTime(),
    );
    expect(row?.itemCount).toBe(1);
    expect(row?.riskCount).toBe(1);
    expect(row?.decisionCount).toBe(1);
  });
});
