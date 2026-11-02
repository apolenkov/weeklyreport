import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import type { StatusOverviewProjectionSource } from "./status-overview";
import { buildStatusOverviewColumns } from "./status-overview-items";

const PROJECT = "20000000-0000-4000-8000-000000000001";

function item(id: string, stableId: string | null, text: string) {
  return {
    id,
    stableId,
    projectId: PROJECT,
    type: "current" as const,
    text,
    workflowStatus: "in_progress" as const,
  };
}

function input(
  items: ReturnType<typeof item>[],
): StatusOverviewProjectionSource {
  return {
    currentSection: makeReportSectionFixture({
      projects: [
        { projectId: PROJECT, projectName: "Portal", trafficLight: "green" },
      ],
      items,
    }),
    previousPlan: { availability: "unavailable", reason: "No previous period" },
    periods: {
      previouslyPlanned: null,
      currentWeek: "Current",
      nextWeek: "Next",
    },
    currentItemsEditable: true,
  };
}

describe("overview item order", () => {
  // A just-created item is appended to the local draft; the server returns
  // items in durable stableId order, so the row must not jump on refetch.
  it("orders a unit's items by durable identity, unsaved items last", () => {
    const columns = buildStatusOverviewColumns(
      "product",
      PROJECT,
      input([
        item(
          "20000000-0000-4000-8000-0000000000a1",
          "c0000000-0000-4000-8000-000000000003",
          "Third",
        ),
        item(
          "20000000-0000-4000-8000-0000000000a2",
          "a0000000-0000-4000-8000-000000000001",
          "First",
        ),
        item("20000000-0000-4000-8000-0000000000a3", null, "Unsaved"),
        item(
          "20000000-0000-4000-8000-0000000000a4",
          "b0000000-0000-4000-8000-000000000002",
          "Second",
        ),
      ]),
      null,
    );
    expect(columns.currentWeek.items.map((entry) => entry.text)).toEqual([
      "First",
      "Second",
      "Third",
      "Unsaved",
    ]);
  });
});
