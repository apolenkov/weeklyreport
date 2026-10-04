import { describe, expect, it } from "vitest";

import { matrix, pageCoverage, pivot } from "./coverage.ts";
import type { PageRecord, RoleResult, StepRecord } from "./types.ts";

function step(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    name: "Filters",
    tag: "button",
    action: "pressed",
    reason: null,
    urlChanged: false,
    stateChanged: false,
    restoredBy: "none",
    responseMs: null,
    shot: null,
    ...overrides,
  };
}

function page(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    url: "http://localhost:3000/reports/123",
    key: "/reports/:n",
    loadMs: 10,
    shot: "report.png",
    controlsFound: 2,
    axeViolations: 0,
    geometryIssues: 0,
    steps: [],
    ...overrides,
  };
}

function roleResult(
  role: string,
  width: number,
  pages: readonly PageRecord[],
): RoleResult {
  return {
    role,
    ms: 20,
    runs: [{ role, width, ms: 20, video: "", pages, findings: [] }],
  };
}

describe("crawl coverage reports", () => {
  it("accounts for every recorded control and explains skipped controls", () => {
    const steps = [
      step(),
      step({ action: "pressed", reason: "synthetic action authorized" }),
      step({ action: "skipped", reason: "disabled" }),
      step({ action: "skipped", reason: "disabled" }),
      step({ action: "skipped", reason: "dangerous: publish" }),
      step({ action: "skipped", reason: "__proto__" }),
      step({ action: "skipped", reason: null }),
      step({ action: "error", reason: "element detached" }),
    ];
    expect(pageCoverage(steps)).toEqual({
      found: 8,
      pressed: 2,
      skipped: 5,
      errors: 1,
      reasons: Object.fromEntries([
        ["disabled", 2],
        ["dangerous: publish", 1],
        ["__proto__", 1],
        ["unspecified", 1],
      ]),
    });
    expect(pageCoverage([])).toEqual({
      found: 0,
      pressed: 0,
      skipped: 0,
      errors: 0,
      reasons: {},
    });
  });

  it("keeps role, width, page, state and element identity attached to each outcome", () => {
    const results = [
      roleResult("lead", 1280, [
        page({
          state: "submitted",
          steps: [
            step({ elementId: "toolbar/filters", state: "filters-open" }),
            step({
              name: "Publish",
              elementId: "toolbar/publish",
              action: "skipped",
              reason: "dangerous: publish",
            }),
          ],
        }),
      ]),
      roleResult("viewer", 375, [
        page({
          key: "/periods",
          steps: [step({ action: "error", reason: "timeout" })],
        }),
        page({ key: "/empty", steps: [] }),
      ]),
    ];
    expect(matrix(results)).toEqual([
      {
        role: "lead",
        width: 1280,
        page: "/reports/:n",
        state: "filters-open",
        elementId: "toolbar/filters",
        name: "Filters",
        action: "pressed",
        reason: null,
      },
      {
        role: "lead",
        width: 1280,
        page: "/reports/:n",
        state: "submitted",
        elementId: "toolbar/publish",
        name: "Publish",
        action: "skipped",
        reason: "dangerous: publish",
      },
      {
        role: "viewer",
        width: 375,
        page: "/periods",
        state: "observed",
        elementId: "button:Filters",
        name: "Filters",
        action: "error",
        reason: "timeout",
      },
    ]);
    expect(matrix([])).toEqual([]);
  });

  it("pivots outcomes into one cell per element and state, the strongest result winning", () => {
    const results = [
      roleResult("lead", 1280, [
        page({
          steps: [
            step({ state: "draft" }),
            step({ state: "draft", action: "skipped", reason: "disabled" }),
            step({ state: "returned", action: "skipped", reason: "x" }),
            step({ name: "Submit", state: "draft", action: "error" }),
          ],
        }),
      ]),
    ];
    const { states, rows } = pivot(matrix(results));
    expect(states).toEqual(["draft", "returned"]);
    const cells = Object.fromEntries(
      rows.map((row) => [row.element, Object.fromEntries(row.cells)]),
    );
    expect(cells).toEqual({
      Filters: { draft: "P", returned: "S" },
      Submit: { draft: "E" },
    });
  });
});
