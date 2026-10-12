import { PublishedSnapshotIntegrityError } from "@weeklyreport/report-persistence";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  baseRow,
  fullItem,
  mapRow,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness.js";
import {
  assertLatestOutcomeSource,
  type OutcomeSourceReportRow,
  resolveEligibleOutcomeSourceSection,
} from "./item-outcome-source-freshness.js";
import { resolveStatusOverviewPredecessor } from "./lead-form-status-overview.predecessor.js";

vi.mock("./lead-form-status-overview.predecessor.js", () => ({
  resolveStatusOverviewPredecessor: vi.fn(),
}));

const SOURCE_ID = "10000000-0000-4000-8000-000000000001";
const STABLE_ID = "20000000-0000-4000-8000-000000000002";
const GROUP_ID = "30000000-0000-4000-8000-000000000003";
const SOURCE = report(SOURCE_ID, 1);
const TARGET_PERIOD_START = new Date("2026-09-01T00:00:00.000Z");

function uuid(index: number): string {
  return `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function report(
  id: string,
  day: number,
  overrides: Partial<OutcomeSourceReportRow> = {},
): OutcomeSourceReportRow {
  const date = String(day).padStart(2, "0");
  return {
    id,
    periodStart: new Date(`2026-08-${date}T00:00:00.000Z`),
    periodEnd: new Date(`2026-08-${date}T23:59:59.999Z`),
    createdAt: new Date(`2026-08-${date}T08:00:00.000Z`),
    status: "draft",
    periodStatus: "open",
    publishedSnapshot: null,
    publishedSectionScopes: [],
    ...overrides,
  };
}

function section(items: ReturnType<typeof fullItem>[] = []) {
  return {
    ...mapRow(
      baseRow({
        status: "submitted",
        submittedAt: new Date("2026-08-20T12:00:00.000Z"),
        items,
      }),
    ),
    status: "submitted" as const,
  };
}

function coordinate(row: OutcomeSourceReportRow) {
  return {
    id: row.id,
    periodStart: row.periodStart,
    createdAt: row.createdAt,
  };
}

function sqlText(query: unknown): string {
  if (!query || typeof query !== "object" || !("strings" in query)) return "";
  const strings = (query as { strings?: readonly string[] }).strings;
  return strings?.join("?") ?? "";
}

beforeEach(() => {
  vi.mocked(resolveStatusOverviewPredecessor).mockReset();
});

describe("resolveEligibleOutcomeSourceSection", () => {
  it("fails closed for an own frozen scope whose required snapshot is absent", async () => {
    const missingSnapshot = report(uuid(1), 10, {
      status: "published",
      periodStatus: "published",
      publishedSectionScopes: [
        {
          authorId: AUTHOR_ID,
          reportSectionId: uuid(101),
          groupId: GROUP_ID,
        },
      ],
    });

    await expect(
      resolveEligibleOutcomeSourceSection(
        {} as never,
        missingSnapshot,
        AUTHOR_ID,
      ),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
    expect(resolveStatusOverviewPredecessor).not.toHaveBeenCalled();
  });

  it("does not fall back from malformed frozen content", async () => {
    const frozen = report(uuid(2), 11, {
      publishedSnapshot: { reportId: uuid(2) },
      publishedSectionScopes: [
        {
          authorId: AUTHOR_ID,
          reportSectionId: uuid(102),
          groupId: GROUP_ID,
        },
      ],
    });
    vi.mocked(resolveStatusOverviewPredecessor).mockResolvedValue({
      availability: "unavailable",
      reason: "invalid_published_snapshot",
      reportId: frozen.id,
      periodStart: frozen.periodStart,
      periodEnd: frozen.periodEnd,
    });

    await expect(
      resolveEligibleOutcomeSourceSection({} as never, frozen, AUTHOR_ID),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
  });
});

describe("assertLatestOutcomeSource", () => {
  it("locks bounded pages and rejects a stableId found on a later page", async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) =>
      report(uuid(index + 10), 28 - Math.floor(index / 2), {
        createdAt: new Date(
          `2026-08-${String(28 - Math.floor(index / 2)).padStart(2, "0")}T${String(23 - (index % 2)).padStart(2, "0")}:00:00.000Z`,
        ),
      }),
    );
    const terminal = report(uuid(99), 8);
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce(firstPage.map(coordinate))
      .mockResolvedValueOnce([coordinate(terminal)]);
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([terminal]);
    vi.mocked(resolveStatusOverviewPredecessor).mockImplementation((_tx, row) =>
      Promise.resolve({
        availability: "available",
        source: "submitted",
        reportId: row.id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        section:
          row.id === terminal.id
            ? section([
                fullItem({
                  id: STABLE_ID,
                  projectId: OWNED_PROJECT,
                  project: { name: "Owned" },
                  stageNames: ["Development"],
                  workflowStatus: "done",
                }),
              ])
            : section(),
      }),
    );
    const tx = { $queryRaw: queryRaw, report: { findMany } };

    await expect(
      assertLatestOutcomeSource(tx as never, {
        source: SOURCE,
        targetPeriodStart: TARGET_PERIOD_START,
        authorId: AUTHOR_ID,
        stableId: STABLE_ID,
      }),
    ).rejects.toThrow("newer historical occurrence");
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledTimes(2);
    const firstSql = sqlText(queryRaw.mock.calls[0]?.[0]);
    const secondSql = sqlText(queryRaw.mock.calls[1]?.[0]);
    expect(firstSql).toContain("FOR UPDATE");
    expect(firstSql).toContain("LIMIT ?");
    expect(firstSql).toContain('report."periodStart" > ?');
    expect(firstSql).toContain('report."createdAt" > ?');
    expect(firstSql).toContain('report."id" > ?');
    expect(firstSql).not.toContain("::uuid");
    expect(secondSql).toContain('report."periodStart" < ?');
    expect(secondSql).toContain('report."createdAt" < ?');
    expect(secondSql).toContain('report."id" < ?');
    expect(secondSql).not.toContain("::uuid");
  });

  it("allows the source when no newer report coordinate exists", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findMany = vi.fn();

    await expect(
      assertLatestOutcomeSource(
        { $queryRaw: queryRaw, report: { findMany } } as never,
        {
          source: SOURCE,
          targetPeriodStart: TARGET_PERIOD_START,
          authorId: AUTHOR_ID,
          stableId: STABLE_ID,
        },
      ),
    ).resolves.toBeUndefined();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects a newer non-terminal occurrence", async () => {
    const newer = report(uuid(100), 20);
    const queryRaw = vi.fn().mockResolvedValue([coordinate(newer)]);
    const findMany = vi.fn().mockResolvedValue([newer]);
    vi.mocked(resolveStatusOverviewPredecessor).mockResolvedValue({
      availability: "available",
      source: "submitted",
      reportId: newer.id,
      periodStart: newer.periodStart,
      periodEnd: newer.periodEnd,
      section: section([
        fullItem({
          id: STABLE_ID,
          projectId: OWNED_PROJECT,
          project: { name: "Owned" },
          stageNames: ["Development"],
          workflowStatus: "in_progress",
        }),
      ]),
    });

    await expect(
      assertLatestOutcomeSource(
        { $queryRaw: queryRaw, report: { findMany } } as never,
        {
          source: SOURCE,
          targetPeriodStart: TARGET_PERIOD_START,
          authorId: AUTHOR_ID,
          stableId: STABLE_ID,
        },
      ),
    ).rejects.toThrow("newer historical occurrence");
  });
});
