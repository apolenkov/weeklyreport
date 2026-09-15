import { describe, expect, it } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import { reportHiddenRowCount } from "./status-overview-additional-updates";

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

describe("overview row preview", () => {
  it("reports rows beyond the two-row preview", () => {
    const rows = [
      linkedRow("l1", { current: true, next: true }),
      linkedRow("l2", { current: true, next: true }),
      independentRow("i1"),
      independentRow("i2"),
    ];

    expect(reportHiddenRowCount(rows)).toBe(2);
  });

  it("keeps two independent rows visible", () => {
    const rows = [
      independentRow("i1"),
      independentRow("i2"),
      independentRow("i3"),
    ];

    expect(reportHiddenRowCount(rows)).toBe(1);
  });

  it("counts linked rows only once", () => {
    const rows = [
      linkedRow("l1", { current: true, next: true }),
      independentRow("i1"),
      independentRow("i2"),
    ];

    expect(reportHiddenRowCount(rows)).toBe(1);
  });
});
