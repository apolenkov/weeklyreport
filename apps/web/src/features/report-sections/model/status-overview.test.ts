import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { statusOverviewProgressLabel } from "../ui/status-overview-item-metadata";
import {
  projectStatusOverview,
  type StatusOverviewItem,
} from "./status-overview";
import { statusOverviewItemActions } from "./status-overview-items";

const CURRENT_PRODUCT = "10000000-0000-4000-8000-000000000010";
const HISTORICAL_PRODUCT = "10000000-0000-4000-8000-000000000011";
const CURRENT_ACTIVITY = "10000000-0000-4000-8000-000000000012";
const HISTORICAL_ACTIVITY = "10000000-0000-4000-8000-000000000013";
const LINKED_PRODUCT_A = "10000000-0000-4000-8000-000000000014";
const LINKED_PRODUCT_B = "10000000-0000-4000-8000-000000000015";
const STABLE_CONTINUED = "10000000-0000-4000-8000-000000000020";
const STABLE_UNPLANNED = "10000000-0000-4000-8000-000000000021";
const RESOLVED_STABLE = "10000000-0000-4000-8000-000000000024";

const WON_T_DO_RESOLUTION = {
  kind: "wont_do" as const,
  eventId: "10000000-0000-4000-8000-000000000025",
  reason: "The dependency closed.",
  actorId: "10000000-0000-4000-8000-000000000026",
  actorName: "Lead",
  occurredAt: "2026-09-05T12:00:00.000Z",
  previousState: {
    type: "current" as const,
    workflowStatus: "in_progress" as const,
    pausedReason: null,
    nextStepText: null,
    text: "Cancelled delivery",
  },
};

function item(overrides: {
  readonly id: string;
  readonly stableId: string;
  readonly projectId?: string;
  readonly activityId?: string;
  readonly type: "current" | "next";
  readonly text: string;
  readonly comments?: readonly {
    readonly id: string;
    readonly reviewerId: string;
    readonly reviewerName: string;
    readonly text: string;
    readonly createdAt: Date;
  }[];
}) {
  return {
    ...overrides,
    tag: "delivery",
    workflowStatus:
      overrides.type === "next"
        ? ("planned" as const)
        : ("in_progress" as const),
    carriedOver: false,
  };
}

describe("projectStatusOverview", () => {
  it("projects the canonical covering risk explanation only on the live covered item", () => {
    const source = item({
      id: "risk-covered",
      stableId: STABLE_CONTINUED,
      projectId: CURRENT_PRODUCT,
      type: "current",
      text: "Covered work",
    });
    const section = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Product",
          trafficLight: "green",
        },
      ],
      items: [
        {
          ...source,
          stageNames: ["Development"],
          nextStepText: "Next commitment",
        },
      ],
      risks: [
        {
          id: "risk-1",
          projectId: CURRENT_PRODUCT,
          stageNames: ["Development"],
          severity: "blocked",
          risk: "Access unavailable",
          impact: "Cannot ship",
          mitigation: "Escalate",
        },
      ],
    });
    const model = projectStatusOverview(
      {
        current: {
          reportId: section.reportId,
          periodStart: new Date("2026-10-19"),
          periodEnd: new Date("2026-10-25"),
          section,
        },
        predecessor: { availability: "unavailable", reason: "no_predecessor" },
      },
      { currentItemsEditable: true },
    );
    expect(model.units[0]?.columns.currentWeek.items[0]).toMatchObject({
      statusRiskText: "Access unavailable",
      nextStepText: "Next commitment",
    });
    expect(
      model.units[0]?.columns.nextWeek.items[0]?.statusRiskText,
    ).toBeNull();
  });
  it("projects products and activities as peers exactly once and appends historical parents", () => {
    const currentSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Current product",
          trafficLight: "green",
        },
      ],
      activities: [
        {
          activityId: CURRENT_ACTIVITY,
          activityName: "Current activity",
          titleOverride: "Weekly override",
          status: "green",
          linkedProducts: [
            { productId: LINKED_PRODUCT_A, productName: "Alpha" },
            { productId: LINKED_PRODUCT_B, productName: "Beta" },
          ],
        },
      ],
      items: [
        item({
          id: "10000000-0000-4000-8000-000000000030",
          stableId: STABLE_CONTINUED,
          projectId: CURRENT_PRODUCT,
          type: "current",
          text: "Continued delivery",
        }),
        item({
          id: "10000000-0000-4000-8000-000000000031",
          stableId: STABLE_UNPLANNED,
          activityId: CURRENT_ACTIVITY,
          type: "current",
          text: "Unplanned support",
        }),
      ],
    });
    const previousSection = {
      ...makeReportSectionFixture({
        projects: [
          {
            projectId: CURRENT_PRODUCT,
            projectName: "Current product",
            trafficLight: "green",
          },
          {
            projectId: HISTORICAL_PRODUCT,
            projectName: "Retired product",
            trafficLight: "yellow",
          },
        ],
        activities: [
          {
            activityId: CURRENT_ACTIVITY,
            activityName: "Current activity",
            titleOverride: "Weekly override",
            status: "green",
          },
          {
            activityId: HISTORICAL_ACTIVITY,
            activityName: "Former duty",
            status: "red",
          },
        ],
        items: [
          item({
            id: "10000000-0000-4000-8000-000000000032",
            stableId: STABLE_CONTINUED,
            projectId: CURRENT_PRODUCT,
            type: "next",
            text: "Agreed delivery",
          }),
          item({
            id: "10000000-0000-4000-8000-000000000033",
            stableId: "10000000-0000-4000-8000-000000000022",
            projectId: HISTORICAL_PRODUCT,
            type: "next",
            text: "Historical commitment",
          }),
          item({
            id: "10000000-0000-4000-8000-000000000034",
            stableId: "10000000-0000-4000-8000-000000000023",
            activityId: HISTORICAL_ACTIVITY,
            type: "next",
            text: "Historical duty",
          }),
        ],
      }),
      status: "submitted" as const,
    };

    const result = projectStatusOverview(
      {
        current: {
          reportId: currentSection.reportId,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section: currentSection,
        },
        predecessor: {
          availability: "available",
          source: "submitted",
          reportId: previousSection.reportId,
          periodStart: new Date("2026-08-24T00:00:00.000Z"),
          periodEnd: new Date("2026-08-30T00:00:00.000Z"),
          section: previousSection,
        },
      },
      { currentItemsEditable: true },
    );

    expect(result.units.map((unit) => [unit.kind, unit.name])).toEqual([
      ["product", "Current product"],
      ["product", "Retired product"],
      ["activity", "Weekly override"],
      ["activity", "Former duty"],
    ]);
    expect(
      result.units.filter((unit) => unit.id === CURRENT_ACTIVITY),
    ).toHaveLength(1);
    expect(result.units[2]?.linkedProducts).toEqual(["Alpha", "Beta"]);
    expect(result.units[1]?.historical).toBe(true);
    expect(result.units[3]?.historical).toBe(true);
    expect(result.units[0]?.columns.currentWeek.items[0]?.continuity).toBe(
      "continued",
    );
    expect(result.units[0]?.columns.currentWeek.items[0]).toMatchObject({
      recordId: "10000000-0000-4000-8000-000000000030",
      source: "current",
      editTarget: {
        recordId: "10000000-0000-4000-8000-000000000030",
        source: "current",
      },
    });
    expect(
      result.units[0]?.columns.previouslyPlanned.items[0]?.editTarget,
    ).toBeNull();
    expect(result.units[2]?.columns.currentWeek.items[0]?.continuity).toBe(
      "unplanned",
    );
    expect(result.sourceCounts).toEqual({
      previouslyPlanned: 3,
      currentWeek: 2,
      nextWeek: 0,
    });
    expect(
      result.units.reduce(
        (count, unit) => count + unit.columns.previouslyPlanned.items.length,
        0,
      ),
    ).toBe(result.sourceCounts.previouslyPlanned);
    expect(
      result.units.reduce(
        (count, unit) => count + unit.columns.currentWeek.items.length,
        0,
      ),
    ).toBe(result.sourceCounts.currentWeek);
    expect(
      result.units.reduce(
        (count, unit) => count + unit.columns.nextWeek.items.length,
        0,
      ),
    ).toBe(result.sourceCounts.nextWeek);
  });

  it("derives product health from risk-floored owned stages without activity bleed", () => {
    const currentSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Payments",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "10000000-0000-4000-8000-000000000040",
              stageName: "Development",
              sortOrder: 0,
              status: "green",
            },
          ],
        },
      ],
      activities: [
        {
          activityId: CURRENT_ACTIVITY,
          activityName: "Incident duty",
          status: "green",
          derivedStatus: "red",
        },
      ],
      risks: [
        {
          id: "10000000-0000-4000-8000-000000000041",
          stableId: "10000000-0000-4000-8000-000000000042",
          projectId: CURRENT_PRODUCT,
          risk: "Vendor delay",
          impact: "Release delay",
          mitigation: "Escalate",
          severity: "at-risk",
          stageNames: ["Development"],
        },
      ],
    });

    const result = projectStatusOverview({
      current: {
        reportId: currentSection.reportId,
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T00:00:00.000Z"),
        section: currentSection,
      },
      predecessor: {
        availability: "unavailable",
        reason: "no_predecessor",
      },
    });

    expect(result.units[0]).toMatchObject({
      kind: "product",
      status: "at-risk",
      stages: [{ name: "Development", status: "at-risk" }],
    });
    expect(result.units[1]).toMatchObject({
      kind: "activity",
      status: "blocked",
    });
    expect(result.units[0]?.status).not.toBe(result.units[1]?.status);
    expect(result.units[0]?.columns.previouslyPlanned).toEqual({
      availability: "unavailable",
      reason: "No previous reporting period",
      items: [],
    });
    expect(result.periods).toEqual({
      previouslyPlanned: null,
      currentWeek: "Aug 31–Sep 6, 2026",
      nextWeek: "Sep 7–13, 2026",
    });
  });

  it("projects current items from the live editor draft and keeps read-only items inert", () => {
    const serverSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Payments",
          trafficLight: "green",
        },
      ],
      items: [
        item({
          id: "10000000-0000-4000-8000-000000000050",
          stableId: STABLE_CONTINUED,
          projectId: CURRENT_PRODUCT,
          type: "current",
          text: "Server text",
        }),
      ],
    });
    const liveDraft = {
      ...serverSection,
      items: serverSection.items.map((entry) => ({
        ...entry,
        text: "Unsaved editor text",
        carriedOver: true,
      })),
    };
    const output = {
      current: {
        reportId: serverSection.reportId,
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T00:00:00.000Z"),
        section: serverSection,
      },
      predecessor: {
        availability: "unavailable" as const,
        reason: "no_predecessor" as const,
      },
    };

    const editable = projectStatusOverview(output, {
      currentSection: liveDraft,
      currentItemsEditable: true,
    });
    const readOnly = projectStatusOverview(output, {
      currentSection: liveDraft,
      currentItemsEditable: false,
    });

    expect(editable.units[0]?.columns.currentWeek.items[0]?.text).toBe(
      "Unsaved editor text",
    );
    expect(
      editable.units[0]?.columns.currentWeek.items[0]?.editTarget,
    ).not.toBeNull();
    expect(
      editable.units[0]?.columns.currentWeek.items[0]?.needsConfirmation,
    ).toBe(true);
    expect(
      readOnly.units[0]?.columns.currentWeek.items[0]?.editTarget,
    ).toBeNull();
    expect(
      readOnly.units[0]?.columns.currentWeek.items[0]?.needsConfirmation,
    ).toBe(true);
    expect(readOnly.units[0]?.columns.currentWeek.items[0]?.canResolve).toBe(
      false,
    );
  });

  it("preserves resolution audit metadata, keeps cancelled plans non-editable, and counts rendered rows", () => {
    const currentSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Payments",
          trafficLight: "green",
        },
      ],
      items: [
        {
          id: "10000000-0000-4000-8000-000000000027",
          stableId: RESOLVED_STABLE,
          projectId: CURRENT_PRODUCT,
          type: "current",
          text: "Cancelled delivery",
          tag: "delivery",
          workflowStatus: "done",
          carriedOver: false,
          resolution: WON_T_DO_RESOLUTION,
          outcomeHistory: [],
        },
      ],
    });
    const previousSection = {
      ...makeReportSectionFixture({
        projects: [
          {
            projectId: CURRENT_PRODUCT,
            projectName: "Payments",
            trafficLight: "green",
          },
        ],
        items: [
          {
            id: "10000000-0000-4000-8000-000000000028",
            stableId: RESOLVED_STABLE,
            projectId: CURRENT_PRODUCT,
            type: "current",
            text: "Cancelled prior commitment",
            tag: "delivery",
            workflowStatus: "done",
            carriedOver: false,
            resolution: WON_T_DO_RESOLUTION,
            outcomeHistory: [],
          },
        ],
      }),
      status: "submitted" as const,
    };

    const result = projectStatusOverview(
      {
        current: {
          reportId: currentSection.reportId,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section: currentSection,
        },
        predecessor: {
          availability: "available",
          source: "submitted",
          reportId: previousSection.reportId,
          periodStart: new Date("2026-08-24T00:00:00.000Z"),
          periodEnd: new Date("2026-08-30T00:00:00.000Z"),
          section: previousSection,
        },
      },
      { currentItemsEditable: true },
    );

    const unit = result.units[0];
    expect(unit?.columns.previouslyPlanned.items[0]).toMatchObject({
      resolution: WON_T_DO_RESOLUTION,
      canResolve: false,
      canRestore: false,
    });
    expect(unit?.columns.currentWeek.items[0]).toMatchObject({
      resolution: WON_T_DO_RESOLUTION,
      editTarget: null,
      canResolve: false,
      canRestore: true,
    });
    // Resolved rows stay visible, and each source count equals its rendered
    // item count — including the resolved rows.
    expect(result.sourceCounts).toEqual({
      previouslyPlanned: 1,
      currentWeek: 1,
      nextWeek: 0,
    });
  });

  it("offers prior resolution only when no current record already owns its stable identity", () => {
    const currentSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Payments",
          trafficLight: "green",
        },
      ],
      items: [
        item({
          id: "10000000-0000-4000-8000-000000000029",
          stableId: STABLE_CONTINUED,
          projectId: CURRENT_PRODUCT,
          type: "current",
          text: "Already resolved from prior",
        }),
      ],
    });
    const previousSection = {
      ...makeReportSectionFixture({
        projects: [
          {
            projectId: CURRENT_PRODUCT,
            projectName: "Payments",
            trafficLight: "green",
          },
        ],
        items: [
          item({
            id: "10000000-0000-4000-8000-000000000030",
            stableId: STABLE_CONTINUED,
            projectId: CURRENT_PRODUCT,
            type: "next",
            text: "Linked prior plan",
          }),
          item({
            id: "10000000-0000-4000-8000-000000000031",
            stableId: STABLE_UNPLANNED,
            projectId: CURRENT_PRODUCT,
            type: "next",
            text: "Unlinked prior plan",
          }),
        ],
      }),
      status: "submitted" as const,
    };

    const result = projectStatusOverview(
      {
        current: {
          reportId: currentSection.reportId,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section: currentSection,
        },
        predecessor: {
          availability: "available",
          source: "submitted",
          reportId: previousSection.reportId,
          periodStart: new Date("2026-08-24T00:00:00.000Z"),
          periodEnd: new Date("2026-08-30T00:00:00.000Z"),
          section: previousSection,
        },
      },
      { currentItemsEditable: true },
    );

    expect(result.units[0]?.columns.previouslyPlanned.items).toMatchObject([
      { text: "Linked prior plan", canResolve: false },
      { text: "Unlinked prior plan", canResolve: true },
    ]);
  });

  it("derives the verdict of a Previous item from the selected week's record", () => {
    const ids = [31, 32, 33, 34].map(
      (n) => `10000000-0000-4000-8000-0000000000${String(n)}`,
    );
    const stable = [41, 42, 43].map(
      (n) => `10000000-0000-4000-8000-0000000000${String(n)}`,
    );
    const parent = { projectId: CURRENT_PRODUCT };
    const projects = [
      {
        projectId: CURRENT_PRODUCT,
        projectName: "Payments",
        trafficLight: "green" as const,
      },
    ];
    const currentSection = makeReportSectionFixture({
      projects,
      items: [
        {
          ...item({
            id: ids[0] ?? "",
            stableId: stable[0] ?? "",
            ...parent,
            type: "current",
            text: "Shipped",
          }),
          workflowStatus: "done" as const,
        },
        {
          ...item({
            id: ids[1] ?? "",
            stableId: stable[1] ?? "",
            ...parent,
            type: "current",
            text: "Suggested",
          }),
          workflowStatus: "planned" as const,
          carriedOver: true,
        },
      ],
    });
    const previousSection = {
      ...makeReportSectionFixture({
        projects,
        items: stable.map((stableId, index) =>
          item({
            id: ids[index + 1] ?? "",
            stableId,
            ...parent,
            type: "next",
            text: ["Shipped plan", "Suggested plan", "Open plan"][index] ?? "",
          }),
        ),
      }),
      status: "submitted" as const,
    };
    const output = {
      current: {
        reportId: currentSection.reportId,
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T00:00:00.000Z"),
        section: currentSection,
      },
      predecessor: {
        availability: "available" as const,
        source: "submitted" as const,
        reportId: previousSection.reportId,
        periodStart: new Date("2026-08-24T00:00:00.000Z"),
        periodEnd: new Date("2026-08-30T00:00:00.000Z"),
        section: previousSection,
      },
    };
    const verdicts = (editable: boolean) =>
      projectStatusOverview(output, {
        currentItemsEditable: editable,
      }).units[0]?.columns.previouslyPlanned.items.map(
        (entry) => entry.verdict,
      );

    expect(verdicts(true)).toEqual(["done", "pending", "pending"]);
    expect(verdicts(false)).toEqual(["done", undefined, undefined]);
    expect(
      projectStatusOverview(output, {
        currentItemsEditable: true,
      }).units[0]?.columns.currentWeek.items.map((entry) => entry.verdict),
    ).toEqual([undefined, undefined]);
  });

  // MOVE-ORDER: reuse the collection order and preserve text/status plus the
  // linked source identity — no re-sorting, no fractional index, no date sort.
  it("reuses the collection order for continuation and promotion", () => {
    const records = [
      {
        id: "10000000-0000-4000-8000-000000000031",
        stableId: "10000000-0000-4000-8000-000000000041",
        projectId: CURRENT_PRODUCT,
        type: "current" as const,
        text: "First result",
      },
      {
        id: "10000000-0000-4000-8000-000000000032",
        stableId: "10000000-0000-4000-8000-000000000042",
        projectId: CURRENT_PRODUCT,
        type: "current" as const,
        text: "Second result",
      },
    ];
    const project = (
      items: readonly ReturnType<typeof item>[],
    ): ReturnType<typeof projectStatusOverview> =>
      projectStatusOverview({
        current: {
          reportId: "10000000-0000-4000-8000-000000000051",
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section: makeReportSectionFixture({
            projects: [
              {
                projectId: CURRENT_PRODUCT,
                projectName: "Current product",
                trafficLight: "green",
              },
            ],
            items: [...items],
          }),
        },
        predecessor: {
          availability: "unavailable",
          reason: "no_predecessor",
        },
      });
    const lane = (result: ReturnType<typeof projectStatusOverview>) =>
      result.units[0]?.columns.currentWeek.items ?? [];

    const plain = project(records.map((record) => item(record)));
    const continued = project(
      records.map((record, index) =>
        index === 1
          ? { ...item(record), nextStepText: "Linked next step" }
          : item(record),
      ),
    );
    const promoted = project(
      records.map((record, index) =>
        index === 1
          ? {
              ...item(record),
              text: "Promoted next step",
              nextStepText: null,
            }
          : item(record),
      ),
    );

    expect(lane(continued).map((entry) => entry.stableId)).toEqual(
      lane(plain).map((entry) => entry.stableId),
    );
    expect(lane(promoted).map((entry) => entry.stableId)).toEqual(
      lane(plain).map((entry) => entry.stableId),
    );
    expect(lane(plain)[0]).toMatchObject({
      text: "First result",
      workflowStatus: "in_progress",
    });
    expect(lane(continued)[1]).toMatchObject({
      stableId: records[1]?.stableId,
      text: "Second result",
      workflowStatus: "in_progress",
    });
    // The linked commitment is projected into the Next lane under the same
    // lineage while its source record keeps its place in Current.
    expect(
      continued.units[0]?.columns.nextWeek.items.find(
        (entry) => entry.text === "Linked next step",
      ),
    ).toMatchObject({
      stableId: records[1]?.stableId,
      source: "next",
      text: "Linked next step",
    });
    expect(lane(promoted)[1]).toMatchObject({
      stableId: records[1]?.stableId,
      text: "Promoted next step",
      workflowStatus: "in_progress",
    });
  });

  it("keeps lineage comments on the lane that owns the record", () => {
    const records = [
      {
        id: "10000000-0000-4000-8000-000000000041",
        stableId: "10000000-0000-4000-8000-000000000051",
      },
      {
        id: "10000000-0000-4000-8000-000000000042",
        stableId: "10000000-0000-4000-8000-000000000052",
      },
    ];
    const comment = {
      id: "10000000-0000-4000-8000-000000000061",
      reviewerId: "10000000-0000-4000-8000-000000000062",
      reviewerName: "Head",
      text: "Please clarify the rollout",
      createdAt: new Date("2026-09-10T09:00:00.000Z"),
    };
    const project = (
      nextStepText: string | null,
    ): ReturnType<typeof projectStatusOverview> =>
      projectStatusOverview({
        current: {
          reportId: "10000000-0000-4000-8000-000000000051",
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section: makeReportSectionFixture({
            projects: [
              {
                projectId: CURRENT_PRODUCT,
                projectName: "Current product",
                trafficLight: "green",
              },
            ],
            items: records.map((record, index) =>
              item({
                ...record,
                projectId: CURRENT_PRODUCT,
                type: "current" as const,
                text: `Result ${index + 1}`,
                comments: [comment],
                ...(index === 1 ? { nextStepText } : {}),
              }),
            ),
          }),
        },
        predecessor: {
          availability: "unavailable",
          reason: "no_predecessor",
        },
      });

    const continued = project("Linked next step");
    const second = records[1];
    if (!second) throw new Error("Expected a second seeded record");
    const currentRow = continued.units[0]?.columns.currentWeek.items.find(
      (entry) => entry.stableId === second.stableId,
    );
    const linkedRow = continued.units[0]?.columns.nextWeek.items.find(
      (entry) => entry.text === "Linked next step",
    );

    expect(currentRow?.comments).toHaveLength(1);
    // The linked Next projection resolves to the same record, so the lineage's
    // comments stay on the owning lane instead of rendering twice in one row.
    expect(linkedRow?.stableId).toBe(second.stableId);
    expect(linkedRow?.comments).toEqual([]);
  });

  it("keeps previous-lane comments, the only projection of that record", () => {
    const comment = {
      id: "10000000-0000-4000-8000-000000000071",
      reviewerId: "10000000-0000-4000-8000-000000000072",
      reviewerName: "Head",
      text: "Carry this into the next period",
      createdAt: new Date("2026-09-10T09:00:00.000Z"),
    };
    const previousSection = {
      ...makeReportSectionFixture({
        projects: [
          {
            projectId: CURRENT_PRODUCT,
            projectName: "Payments",
            trafficLight: "green",
          },
        ],
        items: [
          item({
            id: "10000000-0000-4000-8000-000000000073",
            stableId: "10000000-0000-4000-8000-000000000074",
            projectId: CURRENT_PRODUCT,
            type: "next",
            text: "Previous period result",
            comments: [comment],
          }),
        ],
      }),
      status: "submitted" as const,
    };
    const result = projectStatusOverview({
      current: {
        reportId: "10000000-0000-4000-8000-000000000051",
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T00:00:00.000Z"),
        section: makeReportSectionFixture({
          projects: [
            {
              projectId: CURRENT_PRODUCT,
              projectName: "Payments",
              trafficLight: "green",
            },
          ],
          items: [],
        }),
      },
      predecessor: {
        availability: "available",
        source: "submitted",
        reportId: previousSection.reportId,
        periodStart: new Date("2026-08-24T00:00:00.000Z"),
        periodEnd: new Date("2026-08-30T00:00:00.000Z"),
        section: previousSection,
      },
    });

    const previous = result.units[0]?.columns.previouslyPlanned.items.find(
      (entry) => entry.text === "Previous period result",
    );
    expect(previous?.source).toBe("previous");
    expect(previous?.comments).toHaveLength(1);
  });
});

function overviewActionItem(
  overrides: Partial<StatusOverviewItem>,
): StatusOverviewItem {
  return {
    key: "current:stable-1",
    recordId: "record-1",
    source: "current",
    editTarget: { recordId: "record-1", source: "current" },
    stableId: "stable-1",
    text: "Tracked work",
    tag: "delivery",
    stageNames: [],
    pausedReason: null,
    outcomeHistory: [],
    comments: [],
    resolution: null,
    canResolve: true,
    canRestore: false,
    workflowStatus: "in_progress",
    continuity: null,
    ...overrides,
  };
}

describe("statusOverviewItemActions", () => {
  it("gives an editable active item one status menu and one quiet overflow", () => {
    expect(statusOverviewItemActions(overviewActionItem({}))).toEqual({
      primary: "status",
      secondary: ["edit", "move"],
      recovery: [],
    });
  });

  it("keeps the same status menu on unconfirmed carried items", () => {
    for (const workflowStatus of ["planned", "in_progress"] as const) {
      expect(
        statusOverviewItemActions(
          overviewActionItem({ needsConfirmation: true, workflowStatus }),
        ),
      ).toEqual({
        primary: "status",
        secondary: ["edit", "move"],
        recovery: [],
      });
    }
  });

  it("keeps the status menu on a done item so it can be reopened", () => {
    expect(
      statusOverviewItemActions(overviewActionItem({ workflowStatus: "done" })),
    ).toEqual({
      primary: "status",
      secondary: ["edit"],
      recovery: [],
    });
  });

  it("withholds the status menu from read-only items", () => {
    expect(
      statusOverviewItemActions(
        overviewActionItem({ canResolve: false, editTarget: null }),
      ),
    ).toEqual({ primary: null, secondary: [], recovery: [] });
  });

  it("withholds the status menu from an uneditable carried item", () => {
    expect(
      statusOverviewItemActions(
        overviewActionItem({
          needsConfirmation: true,
          editTarget: null,
          canResolve: false,
          canRestore: true,
          resolution: WON_T_DO_RESOLUTION,
        }),
      ),
    ).toEqual({
      primary: null,
      secondary: [],
      recovery: ["restore"],
    });
  });

  it("keeps paused and postponed items on the same status menu", () => {
    for (const workflowStatus of ["paused", "postponed"] as const) {
      expect(
        statusOverviewItemActions(
          overviewActionItem({
            workflowStatus,
            pausedReason:
              workflowStatus === "paused" ? "Waiting for legal" : null,
          }),
        ),
      ).toEqual({
        primary: "status",
        secondary: ["edit", "move"],
        recovery: [],
      });
    }
  });

  it("keeps the linked next-step projection movable, with no status of its own", () => {
    expect(
      statusOverviewItemActions(
        overviewActionItem({
          source: "next",
          workflowStatus: "planned",
          editTarget: {
            recordId: "record-1",
            source: "current",
            focusNextStep: true,
          },
        }),
      ),
    ).toEqual({
      primary: null,
      secondary: ["move"],
      recovery: [],
    });
  });

  it("keeps Previous informational with only the explicit replan action", () => {
    expect(
      statusOverviewItemActions(
        overviewActionItem({
          source: "previous",
          editTarget: null,
          canResolve: true,
        }),
      ),
    ).toEqual({ primary: null, secondary: [], recovery: ["replan"] });
    expect(
      statusOverviewItemActions(
        overviewActionItem({
          source: "previous",
          editTarget: null,
          canResolve: false,
        }),
      ),
    ).toEqual({ primary: null, secondary: [], recovery: [] });
  });

  it("leaves a pending Previous verdict to the rail, with no replan", () => {
    expect(
      statusOverviewItemActions(
        overviewActionItem({
          source: "previous",
          editTarget: null,
          canResolve: true,
          verdict: "pending",
        }),
      ),
    ).toEqual({ primary: null, secondary: [], recovery: [] });
  });

  it("keeps a resolved item restorable without competing primaries", () => {
    expect(
      statusOverviewItemActions(
        overviewActionItem({
          resolution: WON_T_DO_RESOLUTION,
          editTarget: null,
          canResolve: false,
          canRestore: true,
        }),
      ),
    ).toEqual({ primary: null, secondary: [], recovery: ["restore"] });
  });
});

describe("statusOverviewProgressLabel", () => {
  it("states that carried planned work was not updated this week", () => {
    expect(
      statusOverviewProgressLabel(
        overviewActionItem({
          needsConfirmation: true,
          workflowStatus: "planned",
        }),
      ),
    ).toBe("Planned · not updated this week");
  });

  it("states that carried in-progress work continued but was not updated", () => {
    expect(
      statusOverviewProgressLabel(
        overviewActionItem({
          needsConfirmation: true,
          workflowStatus: "in_progress",
        }),
      ),
    ).toBe("Continued · not updated this week");
  });

  it("keeps ordinary progress labels untouched", () => {
    expect(
      statusOverviewProgressLabel(
        overviewActionItem({ workflowStatus: "planned" }),
      ),
    ).toBe("Not started");
    expect(
      statusOverviewProgressLabel(
        overviewActionItem({ source: "next", workflowStatus: "planned" }),
      ),
    ).toBe("Planned");
    expect(
      statusOverviewProgressLabel(
        overviewActionItem({ workflowStatus: "in_progress" }),
      ),
    ).toBe("In progress");
    expect(
      statusOverviewProgressLabel(
        overviewActionItem({
          workflowStatus: "paused",
          pausedReason: "Waiting for legal",
        }),
      ),
    ).toBe("Paused");
  });
});
