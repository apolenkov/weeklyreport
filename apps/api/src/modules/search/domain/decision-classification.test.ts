import { describe, expect, it } from "vitest";

import { classifyDecision } from "./decision-classification.js";
import type { DecisionCandidate } from "./report-retrieval.types.js";

const candidate = (
  overrides: Partial<DecisionCandidate> = {},
): DecisionCandidate => ({
  kind: "decision",
  identity: {
    occurrenceId: "occurrence",
    recordId: "decision",
    lineageId: null,
  },
  context: {
    reportId: "report",
    periodId: "period",
    periodLabel: "Week 31",
    periodStart: new Date("2026-08-03T00:00:00.000Z"),
    source: "live",
    sectionId: "section",
    authorId: "author",
    authorName: "Lead",
    subject: { kind: "product", id: "product", name: "Product" },
    stageIds: [],
    linkedProductIds: [],
  },
  text: "Decision",
  impact: "Impact",
  owner: "Owner",
  deadline: null,
  resolvedAt: null,
  ...overrides,
});

const now = new Date("2026-08-04T12:00:00.000Z");

describe("classifyDecision", () => {
  it.each([
    ["overdue", new Date("2026-08-03T00:00:00.000Z"), null],
    ["due_today", new Date("2026-08-04T00:00:00.000Z"), null],
    ["upcoming", new Date("2026-08-05T00:00:00.000Z"), null],
    [
      "resolved_on_time",
      new Date("2026-08-05T00:00:00.000Z"),
      new Date("2026-08-04T00:00:00.000Z"),
    ],
    [
      "resolved_late",
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T00:00:00.000Z"),
    ],
  ])("classifies %s", (timing, deadline, resolvedAt) => {
    expect(
      classifyDecision(candidate({ deadline, resolvedAt }), now, "UTC"),
    ).toEqual({
      state: resolvedAt === null ? "open" : "resolved",
      timing,
    });
  });

  it("keeps deadline-less decisions in one timing bucket", () => {
    expect(
      classifyDecision(
        candidate({ resolvedAt: new Date("2026-08-04T00:00:00.000Z") }),
        now,
        "UTC",
      ),
    ).toEqual({ state: "resolved", timing: "without_deadline" });
  });
});
