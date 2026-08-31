import { describe, expect, it } from "vitest";

import {
  type SelectableReportSource,
  selectPeriodSources,
} from "./period-source-selection";

const now = new Date("2026-08-04T00:00:00.000Z");
const source = (
  overrides: Partial<SelectableReportSource>,
): SelectableReportSource => ({
  reportId: "report",
  periodId: "period",
  periodLabel: "W01",
  periodStart: new Date("2026-01-01T00:00:00.000Z"),
  periodStatus: "published",
  source: "snapshot",
  ...overrides,
});
const intent = (periods: {
  includeCurrent: boolean;
  published: {
    mode: "none" | "latest" | "all" | "named";
    count: number | null;
    references: string[];
  };
}) => ({ periods });

describe("selectPeriodSources", () => {
  const sources = [
    source({
      reportId: "live",
      periodId: "live",
      periodLabel: "Current",
      periodStart: new Date("2026-08-01"),
      periodStatus: "open",
      source: "live",
    }),
    source({
      reportId: "future",
      periodId: "future",
      periodLabel: "Future",
      periodStart: new Date("2026-08-11"),
      periodStatus: "open",
      source: "live",
    }),
    source({
      reportId: "p3",
      periodId: "p3",
      periodLabel: "W03",
      periodStart: new Date("2026-07-20"),
    }),
    source({
      reportId: "p2",
      periodId: "p2",
      periodLabel: "W02",
      periodStart: new Date("2026-07-13"),
    }),
    source({
      reportId: "p1",
      periodId: "p1",
      periodLabel: "W01",
      periodStart: new Date("2026-07-06"),
    }),
    source({
      reportId: "p0",
      periodId: "p0",
      periodLabel: "W00",
      periodStart: new Date("2026-06-29"),
    }),
  ];

  it("selects current plus three latest published snapshots by default", () => {
    expect(
      selectPeriodSources(
        sources,
        intent({
          includeCurrent: true,
          published: { mode: "latest", count: 3, references: [] },
        }),
        now,
      ).map((entry) => entry.reportId),
    ).toEqual(["live", "p3", "p2", "p1"]);
  });

  it("selects named published periods and no live report", () => {
    expect(
      selectPeriodSources(
        sources,
        intent({
          includeCurrent: false,
          published: { mode: "named", count: null, references: ["W01", "W03"] },
        }),
        now,
      ).map((entry) => entry.reportId),
    ).toEqual(["p3", "p1"]);
  });

  it("honors a published-only latest count", () => {
    expect(
      selectPeriodSources(
        sources,
        intent({
          includeCurrent: false,
          published: { mode: "latest", count: 2, references: [] },
        }),
        now,
      ).map((entry) => entry.reportId),
    ).toEqual(["p3", "p2"]);
  });

  it("uses the newest editable open or reopened live source", () => {
    const reopened = source({
      reportId: "reopened",
      periodStart: new Date("2026-08-03"),
      periodStatus: "reopened",
      source: "live",
    });
    expect(
      selectPeriodSources(
        [...sources, reopened],
        intent({
          includeCurrent: true,
          published: { mode: "none", count: null, references: [] },
        }),
        now,
      ).map((entry) => entry.reportId),
    ).toEqual(["reopened"]);
  });

  it("never selects two sources for one report", () => {
    const duplicate = source({
      reportId: "live",
      periodStatus: "published",
      source: "snapshot",
    });
    expect(
      selectPeriodSources(
        [...sources, duplicate],
        intent({
          includeCurrent: true,
          published: { mode: "all", count: null, references: [] },
        }),
        now,
      ).filter((entry) => entry.reportId === "live"),
    ).toHaveLength(1);
  });
});
