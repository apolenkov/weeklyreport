import { describe, expect, it } from "vitest";

import {
  AUTHOR_ID,
  baseRow,
  FIXED_TIMESTAMP,
  fullItem,
  mapRow,
  OWNED_PROJECT,
  SECTION_ID,
} from "./__tests__/report-sections-prisma-harness";

const eventId = "12345678-1234-4234-8234-123456789abc";
const state = {
  type: "current",
  workflowStatus: "in_progress",
  pausedReason: null,
  nextStepText: null,
};
const resolution = {
  kind: "wont_do",
  eventId,
  reason: "The customer withdrew the request",
  actorId: AUTHOR_ID,
  actorName: "Lead 1",
  occurredAt: FIXED_TIMESTAMP.toISOString(),
  previousState: state,
};

function outcomeRow() {
  const item = fullItem({
    projectId: OWNED_PROJECT,
    project: { name: "Owned Project" },
    stageNames: ["Development"],
  });
  return baseRow({
    items: [{ ...item, resolution }],
    itemOutcomeEvents: [
      {
        id: eventId,
        reportSectionId: SECTION_ID,
        stableId: item.stableId,
        requestHash: "a".repeat(64),
        outcome: "wont_do",
        reason: resolution.reason,
        actorId: AUTHOR_ID,
        actorName: "Lead 1",
        occurredAt: FIXED_TIMESTAMP,
        sourceReportId: null,
        beforeState: state,
        afterState: state,
        reversesEventId: null,
      },
    ],
  });
}

describe("server-owned item outcome read model", () => {
  it("retains cancellation and audit without leaking the command receipt", () => {
    const section = mapRow(outcomeRow());
    expect(section.items[0]?.resolution).toEqual(resolution);
    expect(section.items[0]?.outcomeHistory).toEqual([
      {
        id: eventId,
        stableId: section.items[0]?.stableId,
        outcome: "wont_do",
        reason: resolution.reason,
        actorId: AUTHOR_ID,
        actorName: "Lead 1",
        occurredAt: FIXED_TIMESTAMP.toISOString(),
        beforeState: state,
        afterState: state,
        reversesEventId: null,
      },
    ]);
  });

  it("reanchors history by stable identity after the physical item is recreated", () => {
    const row = outcomeRow();
    row.items = row.items.map((item) => ({ ...item, id: eventId }));
    expect(mapRow(row).items[0]?.outcomeHistory).toHaveLength(1);
  });

  it("does not attach another lineage's history", () => {
    const row = outcomeRow();
    row.itemOutcomeEvents = row.itemOutcomeEvents.map((event) => ({
      ...event,
      stableId: eventId,
    }));
    expect(mapRow(row).items[0]?.outcomeHistory).toEqual([]);
  });

  it("fails closed on malformed stored cancellation metadata", () => {
    const row = outcomeRow();
    row.items = row.items.map((item) => ({
      ...item,
      resolution: { ...resolution, reason: "" },
    }));
    expect(() => mapRow(row)).toThrow();
  });
});
