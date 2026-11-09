import type { PrismaReportSectionWithRelations } from "@weeklyreport/report-persistence";
import { mapPrismaToAuthorReportSection } from "@weeklyreport/report-persistence";
import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  baseRow,
  fullDecision,
  fullRisk,
  OWNED_PROJECT,
  SECTION_ID,
} from "../infrastructure/__tests__/report-sections-prisma-harness";
import {
  RetainedIncompleteRecordsService,
  type RetainedSource,
} from "./retained-incomplete-records.service.js";

// The harness rows belong to this report.
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const INPUT = { reportId: REPORT_ID, reportSectionId: SECTION_ID };
const UNAVAILABLE = { status: "unavailable" };
const PARENT = {
  projectId: OWNED_PROJECT,
  project: { name: "Owned Project" },
  stageNames: ["Development"],
};
const DRAFT_RISK_ID = "77777777-7777-4777-8777-777777777777";
const DONE_RISK_ID = "88888888-8888-4888-8888-888888888888";
const DRAFT_DECISION_ID = "99999999-9999-4999-8999-999999999999";

const section = mapPrismaToAuthorReportSection(
  baseRow({
    risks: [
      { ...fullRisk({ ...PARENT, id: DRAFT_RISK_ID }), mitigation: null },
      fullRisk({ ...PARENT, id: DONE_RISK_ID }),
    ],
    decisions: [
      {
        ...fullDecision({ ...PARENT, productId: OWNED_PROJECT }),
        impact: null,
      },
    ],
  }) as unknown as PrismaReportSectionWithRelations,
);

const PUBLISHED = {
  status: "published",
  periodStatus: "published",
  archived: false,
} as const;
const OPEN = {
  status: "draft",
  periodStatus: "open",
  archived: false,
} as const;

function sourceOf(overrides: Partial<RetainedSource> = {}): RetainedSource {
  return {
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    periodStart: new Date("2026-10-26T00:00:00.000Z"),
    periodEnd: new Date("2026-11-01T00:00:00.000Z"),
    lifecycle: PUBLISHED,
    onCurrentForm: false,
    risks: section.risks,
    decisions: section.decisions,
    ...overrides,
  };
}

function setup(source: RetainedSource | null) {
  const readOwnSource = vi.fn().mockResolvedValue(source);
  const service = new RetainedIncompleteRecordsService({ readOwnSource });
  return { readOwnSource, service };
}

describe("RetainedIncompleteRecordsService", () => {
  it("asks for the named source as the authenticated actor", async () => {
    const { readOwnSource, service } = setup(null);

    await expect(service.read(INPUT, AUTHOR_ID)).resolves.toEqual(UNAVAILABLE);

    expect(readOwnSource).toHaveBeenCalledExactlyOnceWith({
      ...INPUT,
      actorId: AUTHOR_ID,
    });
  });

  it("returns only the unfinished records, without their discussion", async () => {
    const commented = {
      ...section.risks[0],
      comments: [{ text: "Reviewer note" }],
    } as unknown as RetainedSource["risks"][number];
    const { service } = setup(
      sourceOf({ risks: [commented, ...section.risks.slice(1)] }),
    );

    const result = await service.read(INPUT, AUTHOR_ID);

    expect(result).toMatchObject({
      status: "available",
      reportId: REPORT_ID,
      reportSectionId: SECTION_ID,
      periodStart: new Date("2026-10-26T00:00:00.000Z"),
      periodEnd: new Date("2026-11-01T00:00:00.000Z"),
      readOnlyReason: "published",
      risks: [{ stableId: DRAFT_RISK_ID, mitigation: null }],
      decisions: [{ stableId: DRAFT_DECISION_ID, impact: null }],
    });
    expect(JSON.stringify(result)).not.toContain("Reviewer note");
    expect(JSON.stringify(result)).not.toContain(DONE_RISK_ID);
    expect(JSON.stringify(result)).not.toContain("comments");
  });

  it.each([
    ["published", PUBLISHED],
    ["reopened", { ...PUBLISHED, periodStatus: "reopened" }],
    ["archived", { ...PUBLISHED, archived: true }],
    ["archived", { ...OPEN, archived: true }],
    ["not-current", OPEN],
  ] as const)("explains a %s source", async (reason, lifecycle) => {
    const { service } = setup(sourceOf({ lifecycle }));

    await expect(service.read(INPUT, AUTHOR_ID)).resolves.toMatchObject({
      readOnlyReason: reason,
    });
  });

  it("leaves the drafts of the open current section to the form", async () => {
    const { service } = setup(
      sourceOf({ lifecycle: OPEN, onCurrentForm: true }),
    );

    await expect(service.read(INPUT, AUTHOR_ID)).resolves.toEqual(UNAVAILABLE);
  });

  it("still offers a reopened source the form is editing", async () => {
    const { service } = setup(
      sourceOf({
        lifecycle: { ...PUBLISHED, periodStatus: "reopened" },
        onCurrentForm: true,
      }),
    );

    await expect(service.read(INPUT, AUTHOR_ID)).resolves.toMatchObject({
      status: "available",
      readOnlyReason: "reopened",
    });
  });

  it("is unavailable when the source holds no unfinished record", async () => {
    const { service } = setup(
      sourceOf({ risks: section.risks.slice(1), decisions: [] }),
    );

    await expect(service.read(INPUT, AUTHOR_ID)).resolves.toEqual(UNAVAILABLE);
  });
});
