// What the assistant is ever given to read or embed (openspec:
// lead-incomplete-record-drafts, task 4.5): an unfinished risk or decision
// never enters a live occurrence, so its text cannot reach a candidate, an
// embedding input, a prompt or a citation.
import type { SearchPlan } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { PeriodPrismaRepository } from "../../period/infrastructure/period.prisma-repository.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import { resolveReportAssistantCandidates } from "../application/report-assistant.retrieval.js";
import { basePlan } from "../application/report-assistant.test-support.js";
import { semanticDocuments } from "../application/semantic-preparation.documents";
import { ReportSearchPrismaRepository } from "./report-search.prisma-repository";

const GROUP = "d1000000-0000-4000-a000-000000000001";
const LEAD = "d1000000-0000-4000-a000-000000000002";
const PROJECT = "d1000000-0000-4000-a000-000000000003";
const REPORT = "d1000000-0000-4000-a000-000000000004";
const SECTION = "d1000000-0000-4000-a000-000000000005";
const PRIVATE_PROJECT = "d1000000-0000-4000-a000-000000000006";
const HEAD = "d1000000-0000-4000-a000-000000000007";
const FOREIGN = "d1000000-0000-4000-a000-000000000008";
const FOREIGN_SECTION = "d1000000-0000-4000-a000-000000000009";
const DEVELOPMENT = "d1000000-0000-4000-a000-00000000000a";
const TESTING = "d1000000-0000-4000-a000-00000000000b";
const START = new Date("2036-03-03T00:00:00.000Z");

describe("assistant source excludes unfinished records (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new ReportSearchPrismaRepository(prisma as never);
  const periods = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );

  async function publishAndChangeLiveRows() {
    await prisma.user.create({
      data: {
        id: HEAD,
        email: "assistant-head@test.local",
        name: "Source Head",
        lastName: "Head",
        firstName: "Source",
        role: "head",
        samlId: "assistant-head",
        reportingGroupId: GROUP,
      },
    });
    await prisma.reportSection.create({
      data: { reportId: REPORT, authorId: HEAD, status: "submitted" },
    });
    await expect(
      periods.publishPeriod(
        REPORT,
        HEAD,
        expectDefined(await periods.getReportById(REPORT)),
      ),
    ).resolves.toEqual({ transitioned: true });
    // Deliberately diverge mutable rows after freeze: published retrieval must
    // keep the publication's counts and must never read this newer text.
    await prisma.risk.updateMany({
      where: { impact: null },
      data: { impact: "NEW-LIVE-ONLY", mitigation: "NEW-LIVE-ONLY" },
    });
    await prisma.decision.updateMany({
      where: { impact: null },
      data: { impact: "NEW-LIVE-ONLY" },
    });
  }

  const query = (
    source: "live" | "snapshot",
    overrides: Partial<SearchPlan> = {},
  ) =>
    resolveReportAssistantCandidates(
      repository,
      {
        ...basePlan,
        periods: {
          includeCurrent: source === "live",
          published: {
            mode: source === "live" ? "none" : "all",
            count: null,
            references: [],
          },
        },
        ...overrides,
      },
      {
        actorId: LEAD,
        clock: { now: START },
        timeZone: "UTC",
        resolutionTokens: [],
        tokenCodec: {
          encode: () => {
            throw new Error("Fixture must be unambiguous");
          },
          decode: () => null,
        },
      },
    );

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
    await prisma.project.create({
      data: { id: PRIVATE_PROJECT, name: "PRIVATE-PROJECT-NAME", leadId: LEAD },
    });
    await prisma.user.create({
      data: {
        id: FOREIGN,
        email: "assistant-foreign@test.local",
        name: "Foreign Source",
        lastName: "Source",
        firstName: "Foreign",
        role: "lead",
        samlId: "assistant-foreign",
        reportingGroupId: GROUP,
      },
    });
    await prisma.stage.createMany({
      data: [
        { id: DEVELOPMENT, name: "Development", sortOrder: 1 },
        { id: TESTING, name: "Testing", sortOrder: 2 },
      ],
    });
    await prisma.stageAssignment.createMany({
      data: [
        { stageId: DEVELOPMENT, projectId: PROJECT, userId: LEAD },
        { stageId: TESTING, projectId: PROJECT, userId: FOREIGN },
      ],
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
    await prisma.reportSection.create({
      data: { id: FOREIGN_SECTION, reportId: REPORT, authorId: FOREIGN },
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
        {
          ...risk,
          risk: "PRIVATE-TESTING",
          impact: null,
          mitigation: null,
          stageNames: ["Testing"],
        },
        {
          ...risk,
          risk: "PRIVATE-MULTISTAGE",
          impact: null,
          mitigation: null,
          stageNames: ["Development", "Testing"],
        },
        {
          ...risk,
          projectId: PRIVATE_PROJECT,
          risk: "PRIVATE-OTHER-PRODUCT",
          impact: null,
          mitigation: null,
        },
        {
          ...risk,
          reportSectionId: FOREIGN_SECTION,
          risk: "PRIVATE-FOREIGN-TESTING",
          impact: null,
          mitigation: null,
          stageNames: ["Testing"],
        },
        {
          ...risk,
          reportSectionId: FOREIGN_SECTION,
          risk: "PRIVATE-FOREIGN-MULTISTAGE",
          impact: null,
          mitigation: null,
          stageNames: ["Development", "Testing"],
        },
        {
          ...risk,
          reportSectionId: FOREIGN_SECTION,
          projectId: PRIVATE_PROJECT,
          risk: "PRIVATE-FOREIGN-UNSHARED",
          impact: null,
          mitigation: null,
        },
        {
          ...risk,
          reportSectionId: FOREIGN_SECTION,
          risk: "FINISHED-FOREIGN-RISK",
          impact: "Delay",
          mitigation: "Second vendor",
          stageNames: ["Testing"],
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

  it.each(["live", "snapshot"] as const)(
    "keeps unfinished %s text out of the occurrence and every embedding input",
    async (source) => {
      if (source === "snapshot") await publishAndChangeLiveRows();
      const occurrences = await repository.loadOccurrences([
        {
          reportId: REPORT,
          periodId: REPORT,
          periodLabel: "Week 10",
          periodStart: START,
          periodStatus: source === "live" ? "open" : "published",
          source,
        },
      ]);
      expect(occurrences).toHaveLength(1);

      const read = JSON.stringify(occurrences);
      const embedded = JSON.stringify(semanticDocuments(occurrences, "v-test"));

      for (const payload of [read, embedded]) {
        expect(payload).toContain("FINISHED-RISK-NAME");
        expect(payload).toContain("FINISHED-DECISION-TEXT");
        expect(payload).not.toMatch(/PRIVATE-|HALF-RISK-NAME|NEW-LIVE-ONLY/u);
      }
    },
  );

  it.each(["live", "snapshot"] as const)(
    "counts the selected %s author, Product, stage union and kind",
    async (source) => {
      if (source === "snapshot") await publishAndChangeLiveRows();
      const selected: Partial<SearchPlan> = {
        subjects: {
          ...basePlan.subjects,
          productReferences: ["Source platform"],
        },
        recordKinds: ["risk"],
        stages: { references: ["Development"] },
      };
      await expect(query(source)).resolves.toMatchObject({
        coverage: { risks: 5, decisions: 1, unknown: false },
      });
      await expect(query(source, selected)).resolves.toMatchObject({
        kind: "resolved",
        coverage: { risks: 3, decisions: 0, unknown: false },
      });
      await expect(
        query(source, { ...selected, stages: { references: ["Testing"] } }),
      ).resolves.toEqual({
        kind: "no_results",
        coverage: { risks: 2, decisions: 0, unknown: false },
      });
      const everyone = {
        ...selected,
        authors: {
          mode: "all_visible" as const,
          references: [],
          includeSelf: true,
        },
        stages: { references: ["Development", "Testing"] },
      };
      await expect(query(source, everyone)).resolves.toMatchObject({
        coverage: { risks: 6, decisions: 0, unknown: false },
      });
      await expect(
        query(source, {
          ...selected,
          authors: {
            mode: "selected",
            references: ["Foreign Source"],
            includeSelf: false,
          },
          stages: { references: ["Testing"] },
        }),
      ).resolves.toMatchObject({
        coverage: { risks: 2, decisions: 0, unknown: false },
      });
      await expect(
        query(source, { recordKinds: ["decision"] }),
      ).resolves.toMatchObject({
        coverage: { risks: 0, decisions: 1, unknown: false },
      });
      await expect(
        query(source, {
          subjects: {
            ...basePlan.subjects,
            productReferences: [PRIVATE_PROJECT],
          },
        }),
      ).resolves.toEqual({
        kind: "no_results",
        coverage: { risks: 0, decisions: 0, unknown: false },
      });
      await prisma.stageAssignment.deleteMany({ where: { userId: FOREIGN } });
      await expect(query(source, everyone)).resolves.toMatchObject({
        coverage: { risks: 4, decisions: 0, unknown: false },
      });
    },
  );
});
