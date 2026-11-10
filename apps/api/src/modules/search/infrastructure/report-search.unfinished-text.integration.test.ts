// What the assistant is ever given to read or embed (openspec:
// lead-incomplete-record-drafts, task 4.5): an unfinished risk or decision
// never enters a live occurrence, so its text cannot reach a candidate, an
// embedding input, a prompt or a citation.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { semanticDocuments } from "../application/semantic-preparation.documents";
import { ReportSearchPrismaRepository } from "./report-search.prisma-repository";

const GROUP = "d1000000-0000-4000-a000-000000000001";
const LEAD = "d1000000-0000-4000-a000-000000000002";
const PROJECT = "d1000000-0000-4000-a000-000000000003";
const REPORT = "d1000000-0000-4000-a000-000000000004";
const SECTION = "d1000000-0000-4000-a000-000000000005";
const START = new Date("2036-03-03T00:00:00.000Z");

describe("assistant source excludes unfinished records (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new ReportSearchPrismaRepository(prisma as never);

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.create({
      data: { id: GROUP, name: "Assistant Source Group" },
    });
    await prisma.user.create({
      data: {
        id: LEAD,
        email: "assistant-source-lead@test.local",
        name: "Source Lead",
        lastName: "Lead",
        firstName: "Source",
        role: "lead",
        samlId: "assistant-source-lead",
        reportingGroupId: GROUP,
      },
    });
    await prisma.project.create({
      data: { id: PROJECT, name: "Source platform", leadId: LEAD },
    });
    await prisma.report.create({
      data: {
        id: REPORT,
        periodStart: START,
        periodEnd: START,
        deadline: START,
        status: "draft",
        periodStatus: "open",
      },
    });
    await prisma.reportSection.create({
      data: { id: SECTION, reportId: REPORT, authorId: LEAD },
    });
    const risk = {
      reportSectionId: SECTION,
      projectId: PROJECT,
      severity: "at-risk",
      stageNames: ["Development"],
    };
    await prisma.risk.createMany({
      data: [
        { ...risk, risk: "PRIVATE-RISK-NAME", impact: null, mitigation: null },
        {
          ...risk,
          risk: "HALF-RISK-NAME",
          impact: "PRIVATE-RISK-IMPACT",
          mitigation: null,
        },
        {
          ...risk,
          risk: "FINISHED-RISK-NAME",
          impact: "Date slips",
          mitigation: "Second vendor",
        },
      ],
    });
    const decision = {
      reportSectionId: SECTION,
      productId: PROJECT,
      owner: "owner",
      stageNames: ["Development"],
    };
    await prisma.decision.createMany({
      data: [
        { ...decision, text: "PRIVATE-DECISION-TEXT", impact: null },
        { ...decision, text: "FINISHED-DECISION-TEXT", impact: "Budget" },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("keeps unfinished text out of the occurrence and of every embedding input", async () => {
    const occurrences = await repository.loadOccurrences([
      {
        reportId: REPORT,
        periodId: REPORT,
        periodLabel: "Week 10",
        periodStart: START,
        periodStatus: "open",
        source: "live",
      },
    ]);
    expect(occurrences).toHaveLength(1);

    const read = JSON.stringify(occurrences);
    const embedded = JSON.stringify(semanticDocuments(occurrences, "v-test"));

    for (const payload of [read, embedded]) {
      expect(payload).toContain("FINISHED-RISK-NAME");
      expect(payload).toContain("FINISHED-DECISION-TEXT");
      expect(payload).not.toMatch(/PRIVATE-|HALF-RISK-NAME/u);
    }
  });
});
