import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type {
  CrossAuthorContentRow,
  CrossAuthorRow,
} from "../model/lead-cross-author";
import {
  ACTIVITY_ID,
  CURRENT_ITEM_ID,
  DECISION_ID,
  makeDraftMergeSection,
  PROJECT_ID,
} from "./lead-form-draft-merge-test-fixtures";
import {
  buildLeadFormLoadedViewModel,
  type LeadFormLoadedInput,
} from "./lead-form-loaded-view-model";

const FOREIGN_AUTHOR_ID = "f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0";
const NEXT_ITEM_ID = "12121212-1212-4121-8121-121212121212";
const CURRENT_ITEM_RANK = 2;
const NEXT_ITEM_RANK = 5;

/** The fixture section plus a ranked, postponed next-week item. */
function makeSection(): ReportSectionReadModel {
  const section = makeDraftMergeSection();
  return {
    ...section,
    items: [
      ...section.items,
      {
        id: NEXT_ITEM_ID,
        stableId: "34343434-3434-4343-8343-343434343434",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Planned next item",
        tag: "general",
        workflowStatus: "postponed",
        carriedOver: false,
        stageIds: [],
        priorityRank: NEXT_ITEM_RANK,
        pausedReason: null,
      },
    ],
  };
}

function makeForeignContent(): CrossAuthorContentRow[] {
  return [
    {
      authorId: FOREIGN_AUTHOR_ID,
      authorName: "Foreign Lead",
      items: [
        {
          id: "fi-current",
          projectId: PROJECT_ID,
          type: "current",
          text: "Foreign current item",
          workflowStatus: "paused",
          stageNames: ["Development"],
        },
        {
          id: "fi-next",
          projectId: PROJECT_ID,
          type: "next",
          text: "Foreign next item",
          workflowStatus: "planned",
          stageNames: [],
        },
      ],
      risks: [
        {
          id: "fr-1",
          projectId: PROJECT_ID,
          risk: "Foreign risk",
          impact: "Foreign impact",
          mitigation: "Foreign mitigation",
          severity: "at-risk",
          stageNames: ["Testing"],
        },
      ],
      decisions: [
        {
          id: "fd-1",
          productId: PROJECT_ID,
          text: "Foreign decision",
          owner: "Foreign Owner",
          impact: "Foreign impact",
          deadline: null,
          stageNames: [],
        },
      ],
    },
  ];
}

function makeInput(
  overrides: Partial<LeadFormLoadedInput> = {},
): LeadFormLoadedInput {
  const section = makeSection();
  return {
    active: section,
    draftSection: section,
    serverReadOnly: false,
    canRequestReopen: false,
    publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    history: [],
    crossAuthors: [],
    foreignContent: undefined,
    isEveryone: false,
    visibilityHydrated: true,
    isForeignSlidesDeck: false,
    isSubmitted: false,
    selectedPeriodId: "",
    showArchivePeriods: false,
    ...overrides,
  };
}

/** Everyone selected, hydrated, own deck — the full-content merge context. */
function makeEveryoneInput(
  overrides: Partial<LeadFormLoadedInput> = {},
): LeadFormLoadedInput {
  return makeInput({
    isEveryone: true,
    foreignContent: makeForeignContent(),
    ...overrides,
  });
}

function makeHistoryEntry(
  reportId: string,
  periodStart: string,
  overrides: Partial<MyHistoryEntry> = {},
): MyHistoryEntry {
  return {
    sectionId: `section-${reportId}`,
    reportId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodStart),
    reportStatus: "draft",
    sectionStatus: "draft",
    submittedAt: null,
    publishedAt: null,
    ...overrides,
  };
}

const foreignRowIds = (rows: readonly { id: string }[]): string[] =>
  rows.filter((row) => row.id.startsWith("foreign:")).map((row) => row.id);

describe("cross-author loaded display gating", () => {
  it("merges foreign read-only rows when Everyone is hydrated on an own deck", () => {
    const vm = buildLeadFormLoadedViewModel(makeEveryoneInput());

    expect(foreignRowIds(vm.currentWeekItems)).toEqual([
      `foreign:${FOREIGN_AUTHOR_ID}:fi-current`,
    ]);
    expect(foreignRowIds(vm.nextWeekItems)).toEqual([
      `foreign:${FOREIGN_AUTHOR_ID}:fi-next`,
    ]);
    expect(foreignRowIds(vm.risks)).toEqual([
      `foreign:${FOREIGN_AUTHOR_ID}:fr-1`,
    ]);
    expect(foreignRowIds(vm.decisions)).toEqual([
      `foreign:${FOREIGN_AUTHOR_ID}:fd-1`,
    ]);
    // Own rows lead; the merged foreign rows are flagged read-only. The
    // `foreign` flag is load-bearing: the draft-merge handlers strip flagged
    // rows, so losing it would fold co-author records into the saved draft.
    expect(vm.currentWeekItems[0]?.id).toBe(CURRENT_ITEM_ID);
    expect(
      vm.currentWeekItems.filter((item) => item.foreign === true),
    ).toHaveLength(1);
    expect(
      vm.nextWeekItems.find(
        (item) => item.id === `foreign:${FOREIGN_AUTHOR_ID}:fi-next`,
      )?.foreign,
    ).toBe(true);
    expect(
      vm.risks.find((risk) => risk.id === `foreign:${FOREIGN_AUTHOR_ID}:fr-1`)
        ?.foreign,
    ).toBe(true);
    expect(
      vm.decisions.find(
        (decision) => decision.id === `foreign:${FOREIGN_AUTHOR_ID}:fd-1`,
      )?.foreign,
    ).toBe(true);
  });

  it.each([
    ["Mine selected", { isEveryone: false }],
    ["visibility not hydrated", { visibilityHydrated: false }],
    ["foreign slides deck", { isForeignSlidesDeck: true }],
  ])("excludes foreign full-content rows when %s", (_label, overrides) => {
    const vm = buildLeadFormLoadedViewModel(makeEveryoneInput(overrides));

    expect(foreignRowIds(vm.currentWeekItems)).toEqual([]);
    expect(foreignRowIds(vm.nextWeekItems)).toEqual([]);
    expect(foreignRowIds(vm.risks)).toEqual([]);
    expect(foreignRowIds(vm.decisions)).toEqual([]);
  });

  it("fills cross-author assignees onto locked stages only in Everyone", () => {
    const section = makeSection();
    const withDesign: ReportSectionReadModel = {
      ...section,
      projects: section.projects.map((project) => ({
        ...project,
        stageSet: [
          {
            stageId: "stage-development",
            stageName: "Development",
            sortOrder: 1,
          },
          { stageId: "stage-testing", stageName: "Testing", sortOrder: 2 },
          { stageId: "stage-design", stageName: "Design", sortOrder: 3 },
        ],
      })),
    };
    const crossAuthors: CrossAuthorRow[] = [
      {
        projectId: PROJECT_ID,
        authorId: FOREIGN_AUTHOR_ID,
        authorInitials: "FL",
        authorShortName: "Foreign L.",
        stageNames: ["Design"],
        stages: [{ stageName: "Design", status: "red" }],
      },
    ];
    const designStage = (everyone: boolean) =>
      buildLeadFormLoadedViewModel(
        makeInput({
          active: withDesign,
          draftSection: withDesign,
          crossAuthors,
          isEveryone: everyone,
        }),
      ).products[0]?.stages.find((stage) => stage.stageName === "Design");

    expect(designStage(true)?.assignee).toBe("Foreign L.");
    expect(designStage(false)?.assignee).toBeNull();
  });
});

describe("own-only derivations", () => {
  it("keeps own write arrays identical with and without the foreign merge", () => {
    const everyone = buildLeadFormLoadedViewModel(makeEveryoneInput());
    const mine = buildLeadFormLoadedViewModel(makeInput());

    expect(everyone.ownCurrentWeekItems).toEqual(mine.ownCurrentWeekItems);
    expect(everyone.ownNextWeekItems).toEqual(mine.ownNextWeekItems);
    expect(everyone.ownRisks).toEqual(mine.ownRisks);
    expect(everyone.ownDecisions).toEqual(mine.ownDecisions);
    const ownRows = [
      ...everyone.ownCurrentWeekItems,
      ...everyone.ownNextWeekItems,
      ...everyone.ownRisks,
      ...everyone.ownDecisions,
    ];
    expect(ownRows.some((row) => row.id.startsWith("foreign:"))).toBe(false);
  });

  it("computes priority ranks from own items only", () => {
    const vm = buildLeadFormLoadedViewModel(makeEveryoneInput());

    expect(vm.ownPeriodRanks).toEqual([CURRENT_ITEM_RANK, NEXT_ITEM_RANK]);
  });
});

describe("published lineage and period affordances", () => {
  it("translates raw lineage stableIds into presentation row ids", () => {
    const section = makeSection();
    const vm = buildLeadFormLoadedViewModel(
      makeInput({
        publishedLineage: {
          itemStableIds: [section.items[0]?.stableId ?? ""],
          decisionStableIds: [section.decisions[0]?.stableId ?? ""],
        },
      }),
    );

    expect(vm.publishedLockedItemIds).toEqual(new Set([CURRENT_ITEM_ID]));
    expect(vm.publishedLockedDecisionIds).toEqual(new Set([DECISION_ID]));
    expect(vm.fillFromLocked).toBe(true);
  });

  it("locks fill-from on raw lineage even when no current row matches", () => {
    const vm = buildLeadFormLoadedViewModel(
      makeInput({
        publishedLineage: {
          itemStableIds: ["00000000-0000-4000-8000-000000000000"],
          decisionStableIds: [],
        },
      }),
    );

    expect(vm.publishedLockedItemIds.size).toBe(0);
    expect(vm.fillFromLocked).toBe(true);
  });

  it("locks fill-from on decision-only lineage", () => {
    const section = makeSection();
    const vm = buildLeadFormLoadedViewModel(
      makeInput({
        publishedLineage: {
          itemStableIds: [],
          decisionStableIds: [section.decisions[0]?.stableId ?? ""],
        },
      }),
    );

    expect(vm.publishedLockedItemIds.size).toBe(0);
    expect(vm.publishedLockedDecisionIds).toEqual(new Set([DECISION_ID]));
    expect(vm.fillFromLocked).toBe(true);
  });

  it("keeps fill-from unlocked with an empty lineage", () => {
    const vm = buildLeadFormLoadedViewModel(makeInput());

    expect(vm.publishedLockedItemIds.size).toBe(0);
    expect(vm.publishedLockedDecisionIds.size).toBe(0);
    expect(vm.fillFromLocked).toBe(false);
  });

  it("hides archived periods but keeps the selected archived period visible", () => {
    const history = [
      makeHistoryEntry("report-new", "2026-06-15"),
      makeHistoryEntry("report-mid", "2026-06-08"),
      makeHistoryEntry("report-old", "2026-06-01", { archived: true }),
    ];
    const build = (selectedPeriodId: string, showArchivePeriods: boolean) =>
      buildLeadFormLoadedViewModel(
        makeInput({ history, selectedPeriodId, showArchivePeriods }),
      );

    const hidden = build("report-new", false);
    expect(hidden.hasArchivedPeriods).toBe(true);
    expect(hidden.visiblePeriods.map((period) => period.id)).toEqual([
      "report-new",
      "report-mid",
    ]);

    const selectedArchived = build("report-old", false);
    expect(selectedArchived.visiblePeriods.map((period) => period.id)).toEqual([
      "report-new",
      "report-mid",
      "report-old",
    ]);

    const shown = build("report-new", true);
    expect(shown.visiblePeriods).toHaveLength(history.length);
  });

  it("shows the full list when every period is archived", () => {
    const history = [
      makeHistoryEntry("report-new", "2026-06-15", { archived: true }),
      makeHistoryEntry("report-old", "2026-06-01", { archived: true }),
    ];
    const vm = buildLeadFormLoadedViewModel(makeInput({ history }));

    expect(vm.hasArchivedPeriods).toBe(true);
    expect(vm.visiblePeriods).toHaveLength(history.length);
  });

  it("shows every period when none is archived", () => {
    const history = [
      makeHistoryEntry("report-new", "2026-06-15"),
      makeHistoryEntry("report-old", "2026-06-01"),
    ];
    const vm = buildLeadFormLoadedViewModel(makeInput({ history }));

    expect(vm.hasArchivedPeriods).toBe(false);
    expect(vm.visiblePeriods).toHaveLength(history.length);
  });

  it.each([
    ["server read-only", { serverReadOnly: true }],
    ["client submitted state", { isSubmitted: true }],
  ])("derives read-only from %s", (_label, overrides) => {
    expect(buildLeadFormLoadedViewModel(makeInput(overrides)).isReadOnly).toBe(
      true,
    );
  });

  it("derives read-only from a submitted draft section", () => {
    const submitted: ReportSectionReadModel = {
      ...makeSection(),
      status: "submitted",
    };
    const vm = buildLeadFormLoadedViewModel(
      makeInput({ draftSection: submitted }),
    );

    expect(vm.isReadOnly).toBe(true);
  });

  it("stays editable when nothing locks the section", () => {
    expect(buildLeadFormLoadedViewModel(makeInput()).isReadOnly).toBe(false);
  });
});

describe("unified activity and activity alarm derivations", () => {
  it.each([
    ["blocked", "red"],
    ["at-risk", "yellow"],
  ] as const)(
    "floors the activity card from a live own %s risk",
    (severity, floor) => {
      const section = makeSection();
      const withActivityRisk: ReportSectionReadModel = {
        ...section,
        risks: [
          ...section.risks,
          {
            id: "56565656-5656-4565-8565-565656565656",
            stableId: "78787878-7878-4787-8787-787878787878",
            projectId: null,
            activityId: ACTIVITY_ID,
            risk: "Activity risk",
            impact: "Impact",
            mitigation: "Mitigation",
            severity,
            stageIds: [],
          },
        ],
      };
      const vm = buildLeadFormLoadedViewModel(
        makeInput({ draftSection: withActivityRisk }),
      );

      expect(
        vm.activityCards.find((card) => card.activityId === ACTIVITY_ID)
          ?.alarmFloor,
      ).toBe(floor);
    },
  );

  it("keeps the alarm floor empty without a covering own risk", () => {
    const vm = buildLeadFormLoadedViewModel(makeInput());

    expect(
      vm.activityCards.find((card) => card.activityId === ACTIVITY_ID)
        ?.alarmFloor,
    ).toBeNull();
  });

  it("derives own entry buckets from raw workflow fields", () => {
    const vm = buildLeadFormLoadedViewModel(makeInput());
    const bucketById = new Map(
      vm.unifiedEntries.map((entry) => [entry.item.id, entry]),
    );

    expect(bucketById.get(CURRENT_ITEM_ID)?.bucket).toBe("paused");
    expect(bucketById.get(NEXT_ITEM_ID)?.bucket).toBe("deferred");
    expect(bucketById.get(NEXT_ITEM_ID)?.week).toBe("next");
  });

  it("derives foreign entry buckets from presentation status", () => {
    const vm = buildLeadFormLoadedViewModel(makeEveryoneInput());
    const bucketById = new Map(
      vm.unifiedEntries.map((entry) => [entry.item.id, entry]),
    );

    expect(
      bucketById.get(`foreign:${FOREIGN_AUTHOR_ID}:fi-current`)?.bucket,
    ).toBe("paused");
    expect(bucketById.get(`foreign:${FOREIGN_AUTHOR_ID}:fi-next`)?.bucket).toBe(
      "planned-next",
    );
  });
});
