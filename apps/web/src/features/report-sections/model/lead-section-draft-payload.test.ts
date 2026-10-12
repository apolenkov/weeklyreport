import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import {
  countLocalOnlyRows,
  sectionToDraftPayload,
} from "./lead-section-draft-payload";
import { buildLeadSubmitPayload } from "./lead-submit-readiness";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "99999999-9999-4999-8999-999999999999";
const STABLE_ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeSection(
  overrides: ReportSectionFixture = {},
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: "22222222-2222-4222-8222-222222222222",
    reportId: "33333333-3333-4333-8333-333333333333",
    authorId: "44444444-4444-4444-8444-444444444444",
    authorName: "Test Lead",
    ...overrides,
  });
}

// Distinct per fixture so a mapper that swaps risk/decision stableIds (not
// just drops them) also fails the round-trip assertions below.
const RISK_STABLE_ID = "77777777-7777-4777-8777-777777777777";
const DECISION_STABLE_ID = "88888888-8888-4888-8888-888888888888";

function makeRisk(impact: string) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    stableId: RISK_STABLE_ID,
    projectId: PROJECT_ID,
    activityId: null,
    risk: "Delivery risk",
    impact,
    mitigation: "Mitigate it",
    severity: "at-risk" as const,
    stageNames: [],
  };
}

function makeDecision(overrides: Record<string, string>) {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    stableId: DECISION_STABLE_ID,
    productId: PROJECT_ID,
    activityId: null,
    text: "Choose a path",
    owner: "Test Lead",
    impact: "Delivery impact",
    deadline: null,
    resolvedAt: null,
    stageNames: [],
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<ReportSectionReadModel["items"][number]> = {},
): ReportSectionReadModel["items"][number] {
  return {
    id: ITEM_ID,
    stableId: STABLE_ITEM_ID,
    projectId: PROJECT_ID,
    activityId: null,
    type: "current",
    text: "Implement the report",
    tag: "delivery",
    workflowStatus: "in_progress",
    carriedOver: false,
    stageNames: ["Development"],
    priorityRank: 1,
    pausedReason: null,
    ...overrides,
  };
}

describe("sectionToDraftPayload", () => {
  it("keeps the weekly result and next commitment distinct in the save payload", () => {
    const payload = sectionToDraftPayload(
      makeSection({
        items: [makeItem({ nextStepText: "Test it next period" })],
      }),
    );
    expect(payload.items[0]).toMatchObject({
      text: "Implement the report",
      nextStepText: "Test it next period",
      stableId: STABLE_ITEM_ID,
    });
  });
  it("maps product, stage, and activity statuses", () => {
    const payload = sectionToDraftPayload(
      makeSection({
        projects: [
          {
            projectId: PROJECT_ID,
            projectName: "Portal",
            trafficLight: "yellow",
            ownedStages: [
              {
                stageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                stageName: "Development",
                sortOrder: 3,
                status: "red",
              },
            ],
          },
        ],
        activities: [
          {
            activityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            activityName: "Hiring",
            titleOverride: "Hiring pipeline",
            status: "green",
            note: "Two interviews",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
      }),
    );

    expect(payload.projectStatuses).toEqual([
      { projectId: PROJECT_ID, status: "yellow" },
    ]);
    expect(payload.stageStatuses).toEqual([
      {
        projectId: PROJECT_ID,
        stageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "red",
      },
    ]);
    expect(payload.activityStatuses).toEqual([
      {
        activityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "green",
        titleOverride: "Hiring pipeline",
        note: "Two interviews",
      },
    ]);
  });

  it("filters blank items and retains pausedReason only for paused items", () => {
    const payload = sectionToDraftPayload(
      makeSection({
        items: [
          makeItem({ text: " ".repeat(3) }),
          makeItem({
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            workflowStatus: "paused",
            pausedReason: "Waiting for security review",
          }),
          makeItem({
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            pausedReason: "Stale reason",
          }),
        ],
      }),
    );

    expect(payload.items).toHaveLength(2);
    expect(payload.items.map((item) => item.pausedReason)).toEqual([
      "Waiting for security review",
      null,
    ]);
  });

  it("excludes a risk whose impact is whitespace-only", () => {
    const payload = sectionToDraftPayload(
      makeSection({ risks: [makeRisk(" ".repeat(3))] }),
    );

    expect(payload.risks).toEqual([]);
  });

  it("includes a risk with all three required text fields", () => {
    const risk = makeRisk("Schedule slips");
    const payload = sectionToDraftPayload(makeSection({ risks: [risk] }));

    expect(payload.risks).toEqual([risk]);
    // Durable stableId round-trip is load-bearing (see the module doc
    // comment): a mapper that drops or regenerates it must fail here even
    // if a future refactor loosens the toEqual comparison above.
    expect(payload.risks[0]?.stableId).toBe(RISK_STABLE_ID);
  });

  it("includes a decision with all three required text fields, preserving stableId", () => {
    const decision = makeDecision({});
    const payload = sectionToDraftPayload(
      makeSection({ decisions: [decision] }),
    );

    expect(payload.decisions).toEqual([decision]);
    expect(payload.decisions[0]?.stableId).toBe(DECISION_STABLE_ID);
  });

  it.each([
    ["text", " ".repeat(3)],
    ["owner", ""],
    ["impact", "\t"],
  ])("continues excluding a decision missing %s", (field, value) => {
    const payload = sectionToDraftPayload(
      makeSection({ decisions: [makeDecision({ [field]: value })] }),
    );

    expect(payload.decisions).toEqual([]);
  });
});

describe("activityStatuses projection shared by draft save and submit", () => {
  const ACTIVITY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("emits identical keys and values in both payloads", () => {
    const section = makeSection({
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Hiring",
          titleOverride: "Hiring pipeline",
          status: "yellow",
          note: "Two interviews",
          linkedProducts: [],
          derivedStatus: null,
        },
      ],
    });

    const draft = sectionToDraftPayload(section);
    const submit = buildLeadSubmitPayload(draft, 3);

    expect(draft.activityStatuses).toEqual([
      {
        activityId: ACTIVITY_ID,
        status: "yellow",
        titleOverride: "Hiring pipeline",
        note: "Two interviews",
      },
    ]);
    expect(submit.activityStatuses).toEqual(draft.activityStatuses);
  });

  it("applies the green default only at submit and keeps a null override", () => {
    const section = makeSection({
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Hiring",
          status: null,
          linkedProducts: [],
          derivedStatus: null,
        },
      ],
    });

    const draft = sectionToDraftPayload(section);
    const submit = buildLeadSubmitPayload(draft, 3);

    expect(draft.activityStatuses?.[0]).toEqual({
      activityId: ACTIVITY_ID,
      status: null,
      titleOverride: null,
      note: null,
    });
    expect(submit.activityStatuses[0]).toEqual({
      activityId: ACTIVITY_ID,
      status: "green",
      titleOverride: null,
      note: null,
    });
  });
});

describe("countLocalOnlyRows", () => {
  it("counts a partially typed risk the payload cannot carry", () => {
    const section = makeSection({ risks: [makeRisk("")] });

    expect(sectionToDraftPayload(section).risks).toEqual([]);
    expect(countLocalOnlyRows(section)).toBe(1);
  });

  it("ignores fully blank rows and rows the payload already carries", () => {
    expect(
      countLocalOnlyRows(
        makeSection({
          risks: [{ ...makeRisk(""), risk: "", mitigation: "" }],
        }),
      ),
    ).toBe(0);
    expect(
      countLocalOnlyRows(makeSection({ risks: [makeRisk("Impact")] })),
    ).toBe(0);
  });

  it("counts a partially typed decision", () => {
    const section = makeSection({
      decisions: [makeDecision({ owner: "", impact: "" })],
    });

    expect(sectionToDraftPayload(section).decisions).toEqual([]);
    expect(countLocalOnlyRows(section)).toBe(1);
  });

  it("counts a next commitment typed on a row with no result text", () => {
    const section = makeSection({
      items: [makeItem({ text: "", nextStepText: "Ask the vendor" })],
    });

    expect(sectionToDraftPayload(section).items).toEqual([]);
    expect(countLocalOnlyRows(section)).toBe(1);
  });

  it("does not treat a complete row without a next commitment as local-only", () => {
    const section = makeSection({ items: [makeItem({ nextStepText: null })] });

    expect(sectionToDraftPayload(section).items).toHaveLength(1);
    expect(countLocalOnlyRows(section)).toBe(0);
  });
});
