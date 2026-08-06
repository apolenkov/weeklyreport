import { describe, expect, it } from "vitest";

import { driverTimelineIssues } from "./driver-results-timeline.ts";

const assignedCells = [
  { catalogRoute: "/lead/report", resolvedRoute: "/lead/report" },
  { catalogRoute: "/lead/history", resolvedRoute: "/lead/history" },
];

const route = (path: string, enteredAt: string, leftAt: string) => ({
  route: path,
  enteredAt,
  leftAt,
});

const issuesFor = (
  routes: readonly ReturnType<typeof route>[],
): readonly string[] =>
  driverTimelineIssues({
    timeline: {
      startedAt: "2026-08-04T00:00:00.000Z",
      endedAt: "2026-08-04T00:01:00.000Z",
      routes,
    },
    assignedCells,
  });

describe("driver timeline route sequencing", () => {
  it("rejects overlapping route visits", () => {
    expect(
      issuesFor([
        route(
          "/lead/report",
          "2026-08-04T00:00:01.000Z",
          "2026-08-04T00:00:30.000Z",
        ),
        route(
          "/lead/history",
          "2026-08-04T00:00:20.000Z",
          "2026-08-04T00:00:40.000Z",
        ),
      ]),
    ).toContain("driver timeline routes 0 and 1 overlap");
  });

  it("allows adjacent non-overlapping visits", () => {
    expect(
      issuesFor([
        route(
          "/lead/report",
          "2026-08-04T00:00:01.000Z",
          "2026-08-04T00:00:30.000Z",
        ),
        route(
          "/lead/history",
          "2026-08-04T00:00:30.000Z",
          "2026-08-04T00:00:40.000Z",
        ),
      ]),
    ).toEqual([]);
  });
});
