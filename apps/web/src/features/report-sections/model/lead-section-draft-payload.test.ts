import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { sectionToDraftPayload } from "./lead-section-draft-payload";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: "22222222-2222-4222-8222-222222222222",
    reportId: "33333333-3333-4333-8333-333333333333",
    authorId: "44444444-4444-4444-8444-444444444444",
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
    ...overrides,
  } as ReportSectionReadModel;
}

function makeRisk(impact: string) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projectId: PROJECT_ID,
    activityId: null,
    risk: "Delivery risk",
    impact,
    mitigation: "Mitigate it",
    severity: "at-risk" as const,
    stageIds: [],
  };
}

function makeDecision(overrides: Record<string, string>) {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    productId: PROJECT_ID,
    activityId: null,
    text: "Choose a path",
    owner: "Test Lead",
    impact: "Delivery impact",
    deadline: null,
    resolvedAt: null,
    stageIds: [],
    ...overrides,
  };
}

describe("sectionToDraftPayload", () => {
  it("excludes a risk whose impact is whitespace-only", () => {
    const payload = sectionToDraftPayload(
      makeSection({ risks: [makeRisk(" ".repeat(3))] }),
    );

    expect(payload.risks).toEqual([]);
  });

  it("includes a risk with all three required text fields", () => {
    const risk = makeRisk("Schedule slips");
    const payload = sectionToDraftPayload(makeSection({ risks: [risk] }));

    expect(payload.risks).toEqual([risk]);
  });

  it.each([
    ["text", " ".repeat(3)],
    ["owner", ""],
    ["impact", "\t"],
  ])("continues excluding a decision missing %s", (field, value) => {
    const payload = sectionToDraftPayload(
      makeSection({ decisions: [makeDecision({ [field]: value })] }),
    );

    expect(payload.decisions).toEqual([]);
  });
});
