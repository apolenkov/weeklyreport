import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { filterSectionToSharedProducts } from "../../report-sections/index.js";
import {
  CandidateProjectionAccessError,
  projectSectionCandidates,
} from "./candidate-projector.js";
import type {
  ReportOccurrence,
  SectionScope,
} from "./report-retrieval.types.js";

const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const ACTIVITY_ID = "66666666-6666-4666-8666-666666666666";
const STAGE_ID = "77777777-7777-4777-8777-777777777777";
const ITEM_ID = "88888888-8888-4888-8888-888888888888";
const ITEM_LINEAGE_ID = "99999999-9999-4999-8999-999999999999";
const RISK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECISION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const section = (): ReportSectionReadModel => ({
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Alice Lead",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: PRODUCT_ID,
      projectName: "CRM Portal",
      trafficLight: "red",
      stageSet: [],
      ownerGroupId: null,
      ownedStages: [
        {
          stageId: STAGE_ID,
          stageName: "Development",
          sortOrder: 0,
          status: "yellow",
        },
      ],
    },
  ],
  items: [
    {
      id: ITEM_ID,
      stableId: ITEM_LINEAGE_ID,
      projectId: PRODUCT_ID,
      type: "current",
      text: "Ship the release",
      tag: "release",
      workflowStatus: "in_progress",
      carriedOver: true,
      priorityRank: 2,
      stageNames: ["Development"],
    },
    {
      activityId: ACTIVITY_ID,
      type: "next",
      text: "Follow up with on-call",
      tag: "ops",
      workflowStatus: "planned",
      carriedOver: false,
      stageNames: [],
    },
  ],
  risks: [
    {
      id: RISK_ID,
      projectId: PRODUCT_ID,
      risk: "Release blocker",
      impact: "Customer delay",
      mitigation: "Roll back safely",
      severity: "blocked",
      stageNames: ["Development"],
    },
  ],
  decisions: [
    {
      id: DECISION_ID,
      productId: PRODUCT_ID,
      text: "Choose the rollback window",
      owner: "Alice",
      deadline: new Date("2026-08-05T00:00:00.000Z"),
      impact: "Release timing",
      resolvedAt: null,
      stageNames: ["Development"],
    },
  ],
  activities: [
    {
      activityId: ACTIVITY_ID,
      activityName: "On-call",
      status: "green",
      jiraAccounts: [],
      derivedStatus: "red",
      alarmFloor: null,
      note: "Escalate if the deploy slips",
      linkedProducts: [{ productId: PRODUCT_ID, productName: "CRM Portal" }],
    },
  ],
  referencedProjects: [],
  reviews: [],
});

const occurrence = (reportId = REPORT_ID): ReportOccurrence => ({
  reportId,
  periodId: "11111111-1111-4111-8111-111111111111",
  periodLabel: "Week 31",
  periodStart: new Date("2026-08-03T00:00:00.000Z"),
  source: "live",
  sections: [],
});

const scope = (value = section()): SectionScope => ({
  reportId: value.reportId,
  sectionId: value.reportSectionId,
  authorId: value.authorId,
  visibility: "own",
  section: value,
});

describe("projectSectionCandidates", () => {
  it("projects all six kinds with derived status, parent, and lineage context", () => {
    const candidates = projectSectionCandidates(occurrence(), scope());

    expect(candidates.map((candidate) => candidate.kind)).toEqual([
      "item",
      "item",
      "risk",
      "decision",
      "product_status",
      "stage_status",
      "activity_status",
    ]);
    expect(candidates[0]?.identity.lineageId).toBe(ITEM_LINEAGE_ID);
    expect(candidates[0]?.context.subject).toEqual({
      kind: "product",
      id: PRODUCT_ID,
      name: "CRM Portal",
    });
    expect(candidates[1]?.context.subject.kind).toBe("activity");
    expect(
      candidates.find((candidate) => candidate.kind === "product_status")
        ?.status,
    ).toBe("blocked");
    expect(
      candidates.find((candidate) => candidate.kind === "stage_status")?.status,
    ).toBe("at-risk");
    const activity = candidates.find(
      (candidate) => candidate.kind === "activity_status",
    );
    expect(activity?.status).toBe("blocked");
    expect(activity?.note).toBe("Escalate if the deploy slips");
  });

  it("keeps repeated carry-over occurrences distinct", () => {
    const first = projectSectionCandidates(occurrence(), scope());
    const secondSection = {
      ...section(),
      reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      reportSectionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };
    const second = projectSectionCandidates(
      occurrence(secondSection.reportId),
      scope(secondSection),
    );

    expect(first[0]?.identity.lineageId).toBe(second[0]?.identity.lineageId);
    expect(first[0]?.identity.occurrenceId).not.toBe(
      second[0]?.identity.occurrenceId,
    );
  });

  it("projects only the public shared-product lens for a foreign section", () => {
    const filtered = filterSectionToSharedProducts(
      section(),
      new Set([PRODUCT_ID]),
    );
    const candidates = projectSectionCandidates(occurrence(), {
      ...scope(filtered),
      visibility: "shared_products",
    });

    expect(
      candidates.some((candidate) => candidate.kind === "activity_status"),
    ).toBe(false);
    expect(
      candidates.some(
        (candidate) => candidate.context.subject.kind === "activity",
      ),
    ).toBe(false);
    expect(
      candidates.filter((candidate) => candidate.kind === "item"),
    ).toHaveLength(1);
  });

  it("rejects a foreign section that was not passed through the shared lens", () => {
    expect(() =>
      projectSectionCandidates(occurrence(), {
        ...scope(),
        visibility: "shared_products",
      }),
    ).toThrow(CandidateProjectionAccessError);
  });
});
