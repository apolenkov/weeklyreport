import { ReportStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { archiveHistoryRowIds, historyRowId } from "./seed-simple.history.js";
import { LEADS } from "./seed-simple.leads.js";
import { EXTRA_REPORTS } from "./seed-simple.period.js";

describe("seed-simple history row identity", () => {
  it("derives the same id from the same tail on every call", () => {
    expect(historyRowId(0x6_00)).toBe("c0000000-0000-4000-8000-000000000600");
    expect(historyRowId(0x6_00)).toBe(historyRowId(0x6_00));
  });

  it("keeps ids unique across the published and archive ranges", () => {
    const ids = new Set(
      [
        0x6_00,
        0x6_10,
        0x6_20, // published block (lead 0)
        0x7_00,
        0x7_10,
        0x7_20, // archive period 0, lead 0
        0x7_41,
        0x7_51,
        0x7_61, // archive period 1, lead 1
      ].map(historyRowId),
    );
    expect(ids.size).toBe(9);
  });

  it("keeps every generated archive row id unique across all shapes", () => {
    const archivedPeriods = EXTRA_REPORTS.filter(
      ({ status }) => status === ReportStatus.published,
    );
    const ids = archivedPeriods.flatMap((_, periodIdx) =>
      LEADS.flatMap((_, leadIdx) => {
        const { currentItemId, nextItemId, statusId } = archiveHistoryRowIds(
          periodIdx,
          leadIdx,
        );
        return [currentItemId, nextItemId, statusId];
      }),
    );

    expect(ids).toHaveLength(archivedPeriods.length * LEADS.length * 3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces a well-formed uuid-shaped id", () => {
    const id = historyRowId(0x7_00);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
