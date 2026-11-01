import type {
  LeadOpenWorkHistoryOutput,
  MyHistoryResult,
} from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { ReportSectionDomainError } from "../application/report-sections.contract.js";
import { LeadFormConstraintError } from "../domain/lead-form-shared.js";
import {
  publishReportFixture,
  seedOutcomeItem,
} from "./item-outcome.integration.fixtures";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

// Mondays, one week apart. None overlaps the seeded live period 2026-04-07..04-13.
const PERIOD_STARTS = ["2026-04-20", "2026-04-27", "2026-05-04", "2026-05-11"];
// Open work pages backward from the seeded live period (2026-04-07), so its
// history must sit fully before it; Mondays again, one week apart.
const OPEN_WORK_PERIOD_STARTS = ["2026-03-16", "2026-03-23", "2026-03-30"];
const DAY_MS = 86_400_000;
const MAX_PAGES = 10;

// Identities follow the canonical 8-4-4-4-12 layout: version nibble = version,
// variant nibble in [89ab]. Only the trailing digits differ between rows.
function periodIds(version: number, index: number) {
  const suffix = `${index + 1}`;
  return {
    reportId: `a0000000-0000-${version}000-8000-0000000000${suffix}1`,
    sectionId: `a0000000-0000-${version}000-8000-0000000000${suffix}2`,
  };
}

describe("history cursors with UUID v6/v7/v8 identities (real database)", () => {
  const prisma = createTestPrisma();
  const repo = new ReportSectionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const leadFormRepo = new LeadFormPrismaRepository(
    prisma as unknown as PrismaService,
  );
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  // Follows nextCursor until null; bounded so a repeating cursor fails fast.
  async function collectPages(
    authorId: string,
    cursor?: string,
    pages: MyHistoryResult[] = [],
  ): Promise<MyHistoryResult[]> {
    if (pages.length >= MAX_PAGES) {
      throw new Error("my-history pagination did not terminate");
    }
    const page = await repo.getMyHistoryPage(authorId, { limit: 1, cursor });
    const collected = [...pages, page];
    return page.nextCursor === null
      ? collected
      : collectPages(authorId, page.nextCursor, collected);
  }

  it.each([4, 6, 7, 8])(
    "pages my-history through UUID v%s report and section identities",
    async (version) => {
      const groupId = expectDefined(testData.lead.reportingGroupId);
      const periods = PERIOD_STARTS.map((start, index) => ({
        start,
        ...periodIds(version, index),
      }));
      await Promise.all(
        periods.map(async (period) => {
          const periodStart = new Date(`${period.start}T00:00:00.000Z`);
          await prisma.report.create({
            data: {
              id: period.reportId,
              periodStart,
              periodEnd: new Date(periodStart.getTime() + 6 * DAY_MS),
            },
          });
          await prisma.reportSection.create({
            data: {
              id: period.sectionId,
              reportId: period.reportId,
              authorId: testData.lead.id,
            },
          });
          await publishReportFixture(prisma, {
            reportId: period.reportId,
            sectionId: period.sectionId,
            authorId: testData.lead.id,
            groupId,
          });
        }),
      );

      // Newest first; the seeded live period (2026-04-07) is the oldest row.
      const expectedSectionIds = [
        ...[...periods].reverse().map((period) => period.sectionId),
        testData.section.id,
      ];

      const pages = await collectPages(testData.lead.id);

      expect(pages.map((page) => page.items.length)).toEqual(
        expectedSectionIds.map(() => 1),
      );
      expect(
        pages.flatMap((page) => page.items.map((item) => item.sectionId)),
      ).toEqual(expectedSectionIds);
      expect(pages.at(-1)?.nextCursor).toBeNull();
    },
  );

  it("rejects a malformed cursor before touching history", async () => {
    const rejection = repo.getMyHistoryPage(testData.lead.id, {
      limit: 1,
      cursor: "not-a-cursor",
    });

    await expect(rejection).rejects.toBeInstanceOf(ReportSectionDomainError);
    await expect(rejection).rejects.toMatchObject({
      code: "INVALID_HISTORY_CURSOR",
    });
  });

  it("rejects a well-formed cursor whose id is not a UUID", async () => {
    // Same shape as encodeCursor: base64url JSON with ISO timestamps.
    const cursor = Buffer.from(
      JSON.stringify({
        periodStart: "2026-04-20T00:00:00.000Z",
        eventAt: "2026-04-20T00:00:00.000Z",
        source: "live",
        id: "not-a-uuid",
      }),
      "utf8",
    ).toString("base64url");

    const rejection = repo.getMyHistoryPage(testData.lead.id, {
      limit: 1,
      cursor,
    });

    await expect(rejection).rejects.toBeInstanceOf(ReportSectionDomainError);
    await expect(rejection).rejects.toMatchObject({
      code: "INVALID_HISTORY_CURSOR",
    });
  });

  it.each([4, 6, 7, 8])(
    "pages open-work history through UUID v%s report identities",
    async (version) => {
      const groupId = expectDefined(testData.lead.reportingGroupId);
      const periods = OPEN_WORK_PERIOD_STARTS.map((start, index) => ({
        start,
        ...periodIds(version, index),
      }));
      await Promise.all(
        periods.map(async (period) => {
          const periodStart = new Date(`${period.start}T00:00:00.000Z`);
          await prisma.report.create({
            data: {
              id: period.reportId,
              periodStart,
              periodEnd: new Date(periodStart.getTime() + 6 * DAY_MS),
            },
          });
          await prisma.reportSection.create({
            data: {
              id: period.sectionId,
              reportId: period.reportId,
              authorId: testData.lead.id,
            },
          });
          await seedOutcomeItem(prisma, {
            sectionId: period.sectionId,
            projectId: testData.project.id,
            text: `Open work item from ${period.start}`,
          });
          await publishReportFixture(prisma, {
            reportId: period.reportId,
            sectionId: period.sectionId,
            authorId: testData.lead.id,
            groupId,
          });
        }),
      );

      // limit 1 forces one keyset hop per historical period; bounded so a
      // repeating cursor fails fast like collectPages above.
      const pages: LeadOpenWorkHistoryOutput[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await leadFormRepo.getOpenWorkHistoryPage(
          testData.report.id,
          testData.lead.id,
          cursor === undefined ? { limit: 1 } : { limit: 1, cursor },
        );
        if (result === null) {
          throw new Error(
            "open-work page was null for the seeded target report",
          );
        }
        pages.push(result);
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }

      // Newest historical period first; one seeded item per published period.
      const expected = [...periods].reverse();
      expect(pages.map((page) => page.occurrences.length)).toEqual([1, 1, 1]);
      expect(
        pages.flatMap((page) =>
          page.occurrences.map((occurrence) => occurrence.reportSectionId),
        ),
      ).toEqual(expected.map((period) => period.sectionId));
      expect(
        pages.flatMap((page) =>
          page.occurrences.map((occurrence) => occurrence.reportId),
        ),
      ).toEqual(expected.map((period) => period.reportId));
      expect(
        pages.flatMap((page) =>
          page.occurrences.map((occurrence) => occurrence.source),
        ),
      ).toEqual(["published", "published", "published"]);
      expect(
        pages.flatMap((page) =>
          page.occurrences.map((occurrence) => occurrence.parent),
        ),
      ).toEqual(
        expected.map(() => ({
          kind: "product",
          id: testData.project.id,
          name: "Test Project 1",
        })),
      );
      expect(
        pages.flatMap((page) =>
          page.occurrences.map((occurrence) => occurrence.item.text),
        ),
      ).toEqual(
        expected.map((period) => `Open work item from ${period.start}`),
      );
      expect(pages.at(-1)?.nextCursor).toBeNull();
    },
  );

  it("rejects an open-work cursor whose id is not a UUID", async () => {
    // Same shape as encodeOpenWorkCursor: base64url JSON with ISO timestamps.
    const cursor = Buffer.from(
      JSON.stringify({
        periodStart: "2026-03-30T00:00:00.000Z",
        createdAt: "2026-03-30T00:00:00.000Z",
        id: "not-a-uuid",
      }),
      "utf8",
    ).toString("base64url");

    const rejection = leadFormRepo.getOpenWorkHistoryPage(
      testData.report.id,
      testData.lead.id,
      { limit: 1, cursor },
    );

    await expect(rejection).rejects.toBeInstanceOf(LeadFormConstraintError);
  });
});
