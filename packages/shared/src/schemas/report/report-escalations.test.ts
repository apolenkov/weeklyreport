import { describe, expect, it } from "vitest";

import { reportSectionReadModelSchema } from "../report-sections/section.schema";
import { buildEscalationsFromReadSections } from "./report-escalations";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const FIRST_SECTION_ID = "10000000-0000-4000-8000-000000000002";
const SECOND_SECTION_ID = "10000000-0000-4000-8000-000000000003";
const FIRST_AUTHOR_ID = "10000000-0000-4000-8000-000000000004";
const SECOND_AUTHOR_ID = "10000000-0000-4000-8000-000000000005";
const FIRST_PRODUCT_ID = "10000000-0000-4000-8000-000000000006";
const SECOND_PRODUCT_ID = "10000000-0000-4000-8000-000000000007";

function section(input: {
  readonly reportSectionId: string;
  readonly authorId: string;
  readonly projectId: string;
  readonly trafficLight: "red" | "yellow";
  readonly risk: string;
  readonly severity: "blocked" | "at-risk";
}) {
  return reportSectionReadModelSchema.parse({
    reportSectionId: input.reportSectionId,
    reportId: REPORT_ID,
    authorId: input.authorId,
    authorName: "Same Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: null,
    projects: [
      {
        projectId: input.projectId,
        projectName: "Same Product",
        trafficLight: input.trafficLight,
      },
    ],
    items: [],
    risks: [
      {
        projectId: input.projectId,
        risk: input.risk,
        impact: "Delivery impact",
        mitigation: "Assigned mitigation",
        severity: input.severity,
        stageNames: ["Development"],
      },
    ],
    decisions: [],
  });
}

describe("buildEscalationsFromReadSections", () => {
  it("retains stable product and author identities when display names collide", () => {
    const escalations = buildEscalationsFromReadSections([
      section({
        reportSectionId: FIRST_SECTION_ID,
        authorId: FIRST_AUTHOR_ID,
        projectId: FIRST_PRODUCT_ID,
        trafficLight: "red",
        risk: "First blocker",
        severity: "blocked",
      }),
      section({
        reportSectionId: SECOND_SECTION_ID,
        authorId: SECOND_AUTHOR_ID,
        projectId: SECOND_PRODUCT_ID,
        trafficLight: "yellow",
        risk: "Second risk",
        severity: "at-risk",
      }),
    ]);

    expect(escalations).toEqual([
      expect.objectContaining({
        type: "blocked",
        productId: FIRST_PRODUCT_ID,
        authorId: FIRST_AUTHOR_ID,
        description: "First blocker",
      }),
      expect.objectContaining({
        type: "at_risk",
        productId: FIRST_PRODUCT_ID,
        authorId: FIRST_AUTHOR_ID,
      }),
      expect.objectContaining({
        type: "unresolved_risk",
        productId: SECOND_PRODUCT_ID,
        authorId: SECOND_AUTHOR_ID,
        description: "Second risk",
      }),
    ]);
  });
});
