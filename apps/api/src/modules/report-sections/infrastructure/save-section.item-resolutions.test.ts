import type { ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toItemRows } from "./save-section.derive";
import { preserveResolvedItemJson } from "./save-section.item-resolutions";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const STABLE_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

type Item = ReportSectionReadModel["items"][number];
type PersistedItem = Parameters<typeof preserveResolvedItemJson>[1][number];

const FORGED_RESOLUTION = {
  kind: "wont_do" as const,
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reason: "Forged client metadata.",
  actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  actorName: "Forged",
  occurredAt: "2026-09-05T00:00:00.000Z",
  previousState: {
    type: "current" as const,
    workflowStatus: "in_progress" as const,
    pausedReason: null,
    nextStepText: null,
    text: null,
  },
} satisfies NonNullable<Item["resolution"]>;

const FORGED_EVENT = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  stableId: STABLE_ID,
  outcome: "wont_do" as const,
  reason: "Forged client metadata.",
  actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  actorName: "Forged",
  occurredAt: "2026-09-05T00:00:00.000Z",
  beforeState: FORGED_RESOLUTION.previousState,
  afterState: FORGED_RESOLUTION.previousState,
  reversesEventId: null,
} satisfies NonNullable<Item["outcomeHistory"]>[number];

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    stableId: STABLE_ID,
    projectId: PROJECT_ID,
    activityId: null,
    type: "current",
    text: "Describe the API delivery.",
    tag: "delivery",
    workflowStatus: "in_progress",
    carriedOver: false,
    priorityRank: 1,
    pausedReason: null,
    nextStepText: "Verify the metrics.",
    stageNames: ["Development"],
    comments: [],
    ...overrides,
  };
}

function persistedItem(overrides: Partial<PersistedItem> = {}): PersistedItem {
  return {
    stableId: STABLE_ID,
    projectId: PROJECT_ID,
    activityId: null,
    type: "current",
    text: "Describe the API delivery.",
    tag: "delivery",
    workflowStatus: "in_progress",
    carriedOver: false,
    priorityRank: 1,
    pausedReason: null,
    nextStepText: "Verify the metrics.",
    stageNames: ["Development"],
    resolution: { source: "authoritative" },
    ...overrides,
  };
}

function section(items: readonly Item[]): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: "55555555-5555-4555-8555-555555555555",
    authorId: "66666666-6666-4666-8666-666666666666",
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [],
    referencedProjects: [],
    items,
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

describe("preserveResolvedItemJson", () => {
  it("keeps only the authoritative resolution JSON for an unchanged item", () => {
    const canonicalResolution: Prisma.JsonValue = {
      source: "authoritative",
    };
    const incoming = item({
      resolution: FORGED_RESOLUTION,
      outcomeHistory: [FORGED_EVENT],
    });
    const preserved = preserveResolvedItemJson(
      [incoming],
      [persistedItem({ resolution: canonicalResolution })],
    );

    const rows = toItemRows(section([incoming]), SECTION_ID, preserved);

    expect(preserved.get(STABLE_ID)).toBe(canonicalResolution);
    expect(rows[0]).toMatchObject({ resolution: canonicalResolution });
  });

  it("recovers an existing cancelled carried item by clearing only its marker", () => {
    const canonicalResolution: Prisma.JsonValue = {
      source: "authoritative",
    };
    const preserved = preserveResolvedItemJson(
      [item({ carriedOver: false })],
      [
        persistedItem({
          carriedOver: true,
          resolution: canonicalResolution,
        }),
      ],
    );

    expect(preserved.get(STABLE_ID)).toBe(canonicalResolution);
  });

  it.each([
    ["stable lineage", { stableId: "77777777-7777-4777-8777-777777777777" }],
    ["product parent", { projectId: "88888888-8888-4888-8888-888888888888" }],
    ["activity parent", { activityId: "99999999-9999-4999-8999-999999999999" }],
    ["item type", { type: "next" as const }],
    ["text", { text: "Changed" }],
    ["tag", { tag: "changed" }],
    ["workflow status", { workflowStatus: "done" as const }],
    ["carry-over state", { carriedOver: true }],
    ["priority", { priorityRank: 2 }],
    ["pause reason", { pausedReason: "Changed" }],
    ["next step", { nextStepText: "Changed" }],
    ["stages", { stageNames: ["Testing"] }],
  ])("rejects a changed %s", (_field, changes: Partial<Item>) => {
    expect(() =>
      preserveResolvedItemJson([item(changes)], [persistedItem()]),
    ).toThrow(expect.objectContaining({ code: "ITEM_RESOLUTION_LOCKED" }));
  });

  it("rejects deletion of a cancelled item", () => {
    expect(() => preserveResolvedItemJson([], [persistedItem()])).toThrow(
      expect.objectContaining({ code: "ITEM_RESOLUTION_LOCKED" }),
    );
  });

  it("strips client-authored outcome metadata from every unprotected row", () => {
    const incoming = item({
      resolution: FORGED_RESOLUTION,
      outcomeHistory: [FORGED_EVENT],
    });

    const [row] = toItemRows(section([incoming]), SECTION_ID);

    expect(row).not.toHaveProperty("resolution");
    expect(row).not.toHaveProperty("outcomeHistory");
  });
});
