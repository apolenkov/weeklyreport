import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import {
  classifyReseed,
  reconcileSavedIdentities,
  reconcileServerRecordMetadata,
} from "./lead-form-draft-reconcile";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

type SectionOverrides = Partial<
  Pick<ReportSectionReadModel, "items" | "risks" | "decisions">
>;

function baseSection(overrides: SectionOverrides = {}): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    projects: [
      { projectId: PROJECT_ID, projectName: "Project", trafficLight: "green" },
    ],
    ...overrides,
  });
}

function makeSection(
  text: string,
  id: string,
  stableId: string | undefined,
): ReportSectionReadModel {
  return baseSection({
    items: [
      {
        id,
        stableId,
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text,
        tag: "general",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [],
      },
    ],
  });
}

function makeDecision(
  overrides: Partial<ReportSectionReadModel["decisions"][number]> &
    Pick<ReportSectionReadModel["decisions"][number], "id" | "text"> & {
      deadline: Date | null;
    },
): ReportSectionReadModel["decisions"][number] {
  return {
    stableId: undefined,
    productId: PROJECT_ID,
    activityId: null,
    owner: "Alice",
    impact: "impact",
    resolvedAt: null,
    stageNames: [],
    ...overrides,
  };
}

function makeRisk(
  overrides: Partial<ReportSectionReadModel["risks"][number]> &
    Pick<ReportSectionReadModel["risks"][number], "id" | "risk">,
): ReportSectionReadModel["risks"][number] {
  return {
    stableId: undefined,
    projectId: PROJECT_ID,
    activityId: null,
    impact: "impact",
    mitigation: "mitigation",
    severity: "at-risk",
    stageNames: [],
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<ReportSectionReadModel["items"][number]> &
    Pick<ReportSectionReadModel["items"][number], "id" | "text">,
): ReportSectionReadModel["items"][number] {
  return {
    stableId: undefined,
    projectId: PROJECT_ID,
    activityId: null,
    type: "current",
    tag: "general",
    workflowStatus: "in_progress",
    carriedOver: false,
    stageNames: [],
    ...overrides,
  };
}

describe("classifyReseed", () => {
  it("maps each server payload to its reseed trigger", () => {
    expect(classifyReseed("k", "k", false, false)).toBe("unchanged");
    expect(classifyReseed("new", "old", false, true)).toBe("save-echo");
    expect(classifyReseed("new", "old", true, false)).toBe("external-dirty");
    expect(classifyReseed("new", "old", false, false)).toBe("external-clean");
    // A save-echo classification wins over the dirty/clean branch.
    expect(classifyReseed("new", "old", true, true)).toBe("save-echo");
  });
});

describe("reconcileSavedIdentities", () => {
  it("adopts the server id + stableId while preserving newer local content", () => {
    const tempId = "77777777-7777-4777-8777-777777777777";
    const realId = "88888888-8888-4888-8888-888888888888";
    const realStable = "99999999-9999-4999-8999-999999999999";
    // Local draft carries newer text under a temporary id; the persisted
    // payload we sent matched the server snapshot's content under the temp id.
    const current = makeSection("newer local text", tempId, undefined);
    const saved = makeSection("saved snapshot", realId, realStable);
    const persisted = sectionToDraftPayload(
      makeSection("saved snapshot", tempId, undefined),
    );

    const result = reconcileSavedIdentities(current, saved, persisted);

    expect(result.items[0]).toMatchObject({
      id: realId,
      stableId: realStable,
      text: "newer local text",
    });
  });

  it("resolves a stableId-carrying persisted record directly, bypassing the content-key path", () => {
    const tempId = "77777777-7777-4777-8777-777777777773";
    const existingStableId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const realId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    // Texts deliberately differ, so a content-key match cannot find the
    // saved record — the resolved identity can only come from the
    // stableId branch.
    const current = baseSection({
      decisions: [
        makeDecision({ id: tempId, text: "local edit", deadline: null }),
      ],
    });
    const persisted = sectionToDraftPayload(
      baseSection({
        decisions: [
          makeDecision({
            id: tempId,
            stableId: existingStableId,
            text: "persisted text",
            deadline: null,
          }),
        ],
      }),
    );
    const saved = baseSection({
      decisions: [
        makeDecision({
          id: realId,
          stableId: existingStableId,
          text: "server-normalized text",
          deadline: null,
        }),
      ],
    });

    const result = reconcileSavedIdentities(current, saved, persisted);

    expect(result.decisions[0]).toMatchObject({
      id: realId,
      stableId: existingStableId,
      text: "local edit",
    });
  });

  it("does not swap identities between two decisions that differ only by deadline", () => {
    const tempA = "77777777-7777-4777-8777-777777777774";
    const tempB = "77777777-7777-4777-8777-777777777775";
    const realA = "88888888-8888-4888-8888-888888888883";
    const realB = "88888888-8888-4888-8888-888888888884";
    const stableA = "99999999-9999-4999-8999-999999999993";
    const stableB = "99999999-9999-4999-8999-999999999994";
    const deadlineA = new Date("2026-01-01T00:00:00.000Z");
    const deadlineB = new Date("2026-02-01T00:00:00.000Z");

    const current = baseSection({
      decisions: [
        makeDecision({ id: tempA, text: "Ship v2", deadline: deadlineA }),
        makeDecision({ id: tempB, text: "Ship v2", deadline: deadlineB }),
      ],
    });
    const persisted = sectionToDraftPayload(current);
    // The server returns the two saved decisions in REVERSED order relative
    // to what was sent — a legitimate DB read order the client must not
    // assume matches the request order.
    const saved = baseSection({
      decisions: [
        makeDecision({
          id: realB,
          stableId: stableB,
          text: "Ship v2",
          deadline: deadlineB,
        }),
        makeDecision({
          id: realA,
          stableId: stableA,
          text: "Ship v2",
          deadline: deadlineA,
        }),
      ],
    });

    const result = reconcileSavedIdentities(current, saved, persisted);

    const resolvedA = result.decisions.find(
      (d) => d.deadline?.getTime() === deadlineA.getTime(),
    );
    const resolvedB = result.decisions.find(
      (d) => d.deadline?.getTime() === deadlineB.getTime(),
    );
    expect(resolvedA).toMatchObject({ id: realA, stableId: stableA });
    expect(resolvedB).toMatchObject({ id: realB, stableId: stableB });
  });

  it("resolves duplicate-content records to distinct saved records by occurrence order", () => {
    const tempA = "77777777-7777-4777-8777-777777777776";
    const tempB = "77777777-7777-4777-8777-777777777777";
    const realA = "88888888-8888-4888-8888-888888888885";
    const realB = "88888888-8888-4888-8888-888888888886";

    const current = baseSection({
      items: [
        makeItem({ id: tempA, text: "duplicate text" }),
        makeItem({ id: tempB, text: "duplicate text" }),
      ],
    });
    const persisted = sectionToDraftPayload(current);
    const saved = baseSection({
      items: [
        makeItem({ id: realA, text: "duplicate text" }),
        makeItem({ id: realB, text: "duplicate text" }),
      ],
    });

    const result = reconcileSavedIdentities(current, saved, persisted);

    expect(result.items[0]?.id).toBe(realA);
    expect(result.items[1]?.id).toBe(realB);
  });

  it("adopts the server id + stableId for risks and decisions, preserving newer local content", () => {
    const tempRiskId = "77777777-7777-4777-8777-777777777778";
    const realRiskId = "88888888-8888-4888-8888-888888888887";
    const realRiskStable = "99999999-9999-4999-8999-999999999995";
    const tempDecisionId = "77777777-7777-4777-8777-777777777779";
    const realDecisionId = "88888888-8888-4888-8888-888888888888";
    const realDecisionStable = "99999999-9999-4999-8999-999999999996";

    const current = baseSection({
      risks: [makeRisk({ id: tempRiskId, risk: "newer local risk text" })],
      decisions: [
        makeDecision({
          id: tempDecisionId,
          text: "newer local decision text",
          deadline: null,
        }),
      ],
    });
    const persisted = sectionToDraftPayload(
      baseSection({
        risks: [makeRisk({ id: tempRiskId, risk: "saved risk snapshot" })],
        decisions: [
          makeDecision({
            id: tempDecisionId,
            text: "saved decision snapshot",
            deadline: null,
          }),
        ],
      }),
    );
    const saved = baseSection({
      risks: [
        makeRisk({
          id: realRiskId,
          stableId: realRiskStable,
          risk: "saved risk snapshot",
        }),
      ],
      decisions: [
        makeDecision({
          id: realDecisionId,
          stableId: realDecisionStable,
          text: "saved decision snapshot",
          deadline: null,
        }),
      ],
    });

    const result = reconcileSavedIdentities(current, saved, persisted);

    expect(result.risks[0]).toMatchObject({
      id: realRiskId,
      stableId: realRiskStable,
      risk: "newer local risk text",
    });
    expect(result.decisions[0]).toMatchObject({
      id: realDecisionId,
      stableId: realDecisionStable,
      text: "newer local decision text",
    });
  });
});

// Reviewer feedback arrives on records without moving the section version, so the
// draft keeps rendering stale comments unless this merge runs on every delivery.
describe("reconcileServerRecordMetadata", () => {
  const COMMENT = {
    id: "99999999-9999-4999-8999-999999999999",
    reviewerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    reviewerName: "Head",
    text: "Please add the impact",
    createdAt: new Date("2026-09-17T00:00:00.000Z"),
  };

  it("merges reviewer comments for items, risks and decisions", () => {
    const current = baseSection({
      items: [makeItem({ id: "i1", text: "Item" })],
      risks: [makeRisk({ id: "r1", risk: "Risk" })],
      decisions: [makeDecision({ id: "d1", text: "Decision", deadline: null })],
    });
    const server = baseSection({
      items: [makeItem({ id: "i1", text: "Item", comments: [COMMENT] })],
      risks: [makeRisk({ id: "r1", risk: "Risk", comments: [COMMENT] })],
      decisions: [
        makeDecision({
          id: "d1",
          text: "Decision",
          deadline: null,
          comments: [COMMENT],
        }),
      ],
    });

    const merged = reconcileServerRecordMetadata(current, server);

    expect(merged?.items[0]?.comments).toHaveLength(1);
    expect(merged?.risks[0]?.comments).toHaveLength(1);
    expect(merged?.decisions[0]?.comments).toHaveLength(1);
  });

  it("keeps draft comments when the server projection omits the field", () => {
    const current = baseSection({
      items: [makeItem({ id: "i1", text: "Item", comments: [COMMENT] })],
    });
    const server = baseSection({
      items: [makeItem({ id: "i1", text: "Item" })],
    });

    expect(reconcileServerRecordMetadata(current, server)).toBe(current);
  });

  it("returns the current object when nothing differs", () => {
    const section = baseSection({
      items: [makeItem({ id: "i1", text: "Item" })],
    });

    expect(reconcileServerRecordMetadata(section, section)).toBe(section);
  });
});
