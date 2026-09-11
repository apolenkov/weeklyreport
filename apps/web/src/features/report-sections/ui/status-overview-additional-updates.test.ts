import { describe, expect, it } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import {
  previewBudget,
  reportHiddenRowCount,
} from "./status-overview-additional-updates";

function linkedRow(
  key: string,
  cells: { current?: boolean; next?: boolean } = {},
): StatusOverviewLineageRow {
  return {
    key,
    previous: null,
    current: cells.current ? ({} as StatusOverviewItem) : null,
    next: cells.next ? ({} as StatusOverviewItem) : null,
    previousParent: null,
  };
}

function independentRow(key: string): StatusOverviewLineageRow {
  return {
    key,
    previous: null,
    current: {} as StatusOverviewItem,
    next: null,
    previousParent: null,
  };
}

describe("per-column preview budget", () => {
  it("reserves the shared two-preview budget for linked cells before additional items", () => {
    const rows = [
      linkedRow("l1", { current: true, next: true }),
      linkedRow("l2", { current: true, next: true }),
      independentRow("i1"),
      independentRow("i2"),
    ];

    expect(previewBudget(rows)).toEqual({
      current: 0,
      next: 0,
      hiddenLinked: 0,
    });
    expect(reportHiddenRowCount(rows)).toBe(2);
  });

  it("keeps two previews when a column holds only independent items", () => {
    const rows = [
      independentRow("i1"),
      independentRow("i2"),
      independentRow("i3"),
    ];

    expect(previewBudget(rows).current).toBe(2);
    expect(reportHiddenRowCount(rows)).toBe(1);
  });

  it("leaves one additional preview when a single linked cell occupies the column", () => {
    const rows = [
      linkedRow("l1", { current: true, next: true }),
      independentRow("i1"),
      independentRow("i2"),
    ];

    expect(previewBudget(rows).current).toBe(1);
    expect(reportHiddenRowCount(rows)).toBe(1);
  });
});
