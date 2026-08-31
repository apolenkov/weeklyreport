import { describe, expect, it } from "vitest";

import type {
  CandidateContext,
  SearchCandidate,
} from "./report-retrieval.types.js";
import { buildSemanticInput } from "./semantic-input.js";

const context = (
  overrides: Readonly<{
    authorName?: string;
    subjectName?: string;
    stageIds?: readonly string[];
    linkedProductIds?: readonly string[];
  }> = {},
): CandidateContext => ({
  reportId: "report-1",
  periodId: "period-1",
  periodLabel: "Week 31",
  periodStart: new Date("2026-08-03T00:00:00.000Z"),
  source: "live",
  sectionId: "section-1",
  authorId: "author-1",
  authorName: overrides.authorName ?? "Lead One",
  subject: {
    kind: "product",
    id: "product-1",
    name: overrides.subjectName ?? "CRM Portal",
  },
  stageIds: overrides.stageIds ?? ["Development"],
  linkedProductIds: overrides.linkedProductIds ?? ["product-1"],
});

const item = (
  text = "Ship the release",
  metadata: Parameters<typeof context>[0] = {},
): SearchCandidate => ({
  kind: "item",
  identity: {
    occurrenceId: "occurrence-1",
    recordId: "item-1",
    lineageId: null,
  },
  context: context(metadata),
  text,
  itemType: "current",
  workflowStatus: "in_progress",
  carriedOver: false,
  priorityRank: null,
});

const status = (
  kind: "product_status" | "stage_status" | "activity_status",
  note: string | null = null,
): SearchCandidate => {
  const identity = {
    occurrenceId: "occurrence-1",
    recordId: `${kind}-1`,
    lineageId: null,
  } as const;
  if (kind === "product_status") {
    return { kind, identity, context: context(), status: "on-track" };
  }
  if (kind === "stage_status") {
    return { kind, identity, context: context(), status: "on-track" };
  }
  return { kind, identity, context: context(), status: "on-track", note };
};

describe("semantic input", () => {
  it("canonicalizes eligible item text without report metadata", () => {
    const first = buildSemanticInput(
      item("  Ship   the\nrelease ", {
        authorName: "Lead One",
        subjectName: "CRM Portal",
        stageIds: ["Development"],
        linkedProductIds: ["product-1"],
      }),
      "report-assistant/v1",
    );
    const second = buildSemanticInput(
      item("Ship the release", {
        authorName: "Another Lead",
        subjectName: "Renamed Portal",
        stageIds: ["Quality"],
        linkedProductIds: ["product-2"],
      }),
      "report-assistant/v1",
    );

    expect(first).toMatchObject({
      inputVersion: "report-assistant/v1",
      kind: "item",
      text: "Ship the release",
    });
    expect(second).toEqual(first);
  });

  it("uses only the documented fields for each semantic kind", () => {
    const risk = buildSemanticInput(
      {
        ...item(),
        kind: "risk",
        identity: {
          occurrenceId: "occurrence-1",
          recordId: "risk-1",
          lineageId: null,
        },
        risk: "Release blocker",
        impact: "Customer delay",
        mitigation: "Roll back safely",
        severity: "blocked",
      },
      "v1",
    );
    const decision = buildSemanticInput(
      {
        ...item(),
        kind: "decision",
        identity: {
          occurrenceId: "occurrence-1",
          recordId: "decision-1",
          lineageId: null,
        },
        text: "Choose the release date",
        impact: "Coordinates support",
        owner: "A private owner",
        deadline: null,
        resolvedAt: null,
      },
      "v1",
    );
    const activity = buildSemanticInput(
      {
        ...item(),
        kind: "activity_status",
        identity: {
          occurrenceId: "occurrence-1",
          recordId: "activity-status-1",
          lineageId: null,
        },
        context: {
          ...context(),
          subject: { kind: "activity", id: "activity-1", name: "Jira Sync" },
        },
        status: "on-track",
        note: "Reviewed the queue",
      },
      "v1",
    );

    expect(risk).toMatchObject({
      kind: "risk",
      text: "Release blocker\nCustomer delay\nRoll back safely",
    });
    expect(decision).toMatchObject({
      kind: "decision",
      text: "Choose the release date\nCoordinates support",
    });
    expect(activity).toMatchObject({
      kind: "activity_status",
      text: "Jira Sync\nReviewed the queue",
    });
  });

  it("does not embed product, stage, or note-less status facts", () => {
    expect(buildSemanticInput(status("product_status"), "v1")).toBeNull();
    expect(buildSemanticInput(status("stage_status"), "v1")).toBeNull();
    expect(buildSemanticInput(status("activity_status"), "v1")).toBeNull();
    expect(
      buildSemanticInput(status("activity_status", " ".repeat(3)), "v1"),
    ).toBeNull();
  });

  it("changes the content address when version or semantic text changes", () => {
    const original = buildSemanticInput(item(), "v1");
    const changedVersion = buildSemanticInput(item(), "v2");
    const changedText = buildSemanticInput(item("Ship the hotfix"), "v1");

    expect(original?.contentHash).not.toBe(changedVersion?.contentHash);
    expect(original?.contentHash).not.toBe(changedText?.contentHash);
  });
});
