import { describe, expect, it, vi } from "vitest";

import type { ReportSearchRepository } from "./report-search.repository.js";
import {
  assertSeedAssistantReadiness,
  type SeedReadinessInput,
} from "./seed-readiness.js";

const ACTOR_ID = "actor-1";
const CURRENT_ID = "report-current";
const FUTURE_ID = "report-future";
const PUBLISHED_ID = "report-published";

const source = (
  reportId: string,
  periodStart: string,
  sourceKind: "live" | "snapshot",
  periodStatus: "open" | "published",
) => ({
  reportId,
  periodId: reportId,
  periodLabel: reportId,
  periodStart: new Date(periodStart),
  source: sourceKind,
  periodStatus,
});

const section = (reportId: string, sectionId = `${reportId}-section`) => ({
  reportSectionId: sectionId,
  reportId,
  authorId: ACTOR_ID,
  authorName: "Seed Lead",
  authorRole: "lead" as const,
  version: 1,
  status: "submitted" as const,
  submittedAt: null,
  projects: [
    {
      projectId: "product-1",
      projectName: "Seed Product",
      trafficLight: "green" as const,
      ownedStages: [],
    },
  ],
  referencedProjects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
});

const occurrence = (reportId: string) => ({
  reportId,
  periodId: reportId,
  periodLabel: reportId,
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  source: reportId === PUBLISHED_ID ? ("snapshot" as const) : ("live" as const),
  sections: [section(reportId)],
});

function input(
  overrides: Partial<SeedReadinessInput> = {},
): SeedReadinessInput {
  return {
    actorId: ACTOR_ID,
    label: "test-seed",
    now: new Date("2026-08-04T00:00:00.000Z"),
    publishedReportIds: [PUBLISHED_ID],
    ...overrides,
  };
}

function repository(
  options: {
    readonly ownSection?: boolean;
    readonly candidates?: boolean;
    readonly duplicate?: boolean;
    readonly invalidPublished?: boolean;
  } = {},
): ReportSearchRepository {
  const sources = [
    source(CURRENT_ID, "2026-08-01T00:00:00.000Z", "live", "open"),
    source(FUTURE_ID, "2026-08-08T00:00:00.000Z", "live", "open"),
    source(PUBLISHED_ID, "2026-07-25T00:00:00.000Z", "snapshot", "published"),
  ];
  const occurrences = new Map(
    [CURRENT_ID, FUTURE_ID, PUBLISHED_ID].map((reportId) => [
      reportId,
      occurrence(reportId),
    ]),
  );
  return {
    listSources: vi.fn().mockResolvedValue(sources),
    loadOccurrences: vi
      .fn()
      .mockImplementation((requested: readonly { reportId: string }[]) => {
        const reportId = requested[0]?.reportId;
        if (options.invalidPublished && reportId === PUBLISHED_ID) {
          throw new Error("invalid snapshot");
        }
        const current = reportId ? occurrences.get(reportId) : undefined;
        if (!current) return [];
        if (options.duplicate && reportId === CURRENT_ID) {
          return [
            { ...current, sections: [section(reportId), section(reportId)] },
          ];
        }
        return options.candidates === false
          ? [
              {
                ...current,
                sections: [{ ...section(current.reportId), projects: [] }],
              },
            ]
          : [current];
      }),
    hasOwnSection: vi.fn().mockResolvedValue(options.ownSection ?? true),
    getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([]),
  };
}

describe("seed assistant readiness", () => {
  it("checks current, aged-future, and published sources without provider ports", async () => {
    const result = await assertSeedAssistantReadiness(repository(), input());

    expect(result).toEqual({
      currentReportIds: [CURRENT_ID, FUTURE_ID],
      publishedReportIds: [PUBLISHED_ID],
      candidateCount: 3,
    });
  });

  it.each([
    ["missing caller section", { ownSection: false }, "caller_section"],
    ["zero candidates", { candidates: false }, "candidate_projection"],
    ["invalid snapshot", { invalidPublished: true }, "published_snapshot"],
    [
      "duplicate occurrence identity",
      { duplicate: true },
      "occurrence_identity",
    ],
  ] as const)("fails on %s", async (_label, options, stage) => {
    await expect(
      assertSeedAssistantReadiness(repository(options), input()),
    ).rejects.toThrow(`assistant readiness failed at ${stage}`);
  });

  it("fails when an advertised published report is absent", async () => {
    await expect(
      assertSeedAssistantReadiness(
        repository(),
        input({ publishedReportIds: ["missing-published"] }),
      ),
    ).rejects.toThrow(
      "published_snapshot for report missing-published: missing",
    );
  });
});
