// fix-published-empty-stage-risk-floor (task 3.4, PDF leg): the PDF top-line
// portfolio totals re-route lives in `toAssembledReport`, a function separate
// from the snapshot-module builder. It must count the floored `trafficLight`
// of the mapped sections (NOT raw `projectStatuses`), so an owned stage with no
// submitted status covered by a covers-all own risk reads red/yellow in the PDF
// top-line, agreeing with the PDF per-product cards inside the same document.
import { describe, expect, it } from "vitest";

import { toAssembledReport } from "./pdf-export.prisma-repository";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const OWNED_STAGE_ID = "6366e7ef-e694-454f-863a-7e112ebbc48f";
const RISK_ID = "e421b0e4-caac-4218-9f40-d062f523b86b";
const STAGE_NAME = "Development";

function reportRow(severity: "blocked" | "at-risk") {
  return {
    id: REPORT_ID,
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-07T00:00:00Z"),
    deadline: new Date("2026-06-08T00:00:00Z"),
    status: "published",
    publishedAt: new Date("2026-06-09T00:00:00Z"),
    publishedById: AUTHOR_ID,
    publishedBy: { name: "Head" },
    sections: [
      {
        id: SECTION_ID,
        reportId: REPORT_ID,
        authorId: AUTHOR_ID,
        status: "submitted",
        submittedAt: null,
        late: false,
        author: {
          name: "Alice Lead",
          role: "lead",
          id: AUTHOR_ID,
          stageAssignments: [
            {
              userId: AUTHOR_ID,
              stageId: OWNED_STAGE_ID,
              projectId: OWNED_PRODUCT,
              project: {
                id: OWNED_PRODUCT,
                name: "CRM Portal",
                archived: false,
              },
              stage: { id: OWNED_STAGE_ID, name: STAGE_NAME, sortOrder: 4 },
            },
          ],
        },
        // Stale green ProjectStatus, no StageStatus row (the owned stage has no
        // submitted status), one covers-all own risk.
        projectStatuses: [
          {
            projectId: OWNED_PRODUCT,
            status: "green",
            project: { id: OWNED_PRODUCT, name: "CRM Portal", archived: false },
          },
        ],
        stageStatuses: [],
        items: [],
        risks: [
          {
            id: RISK_ID,
            projectId: OWNED_PRODUCT,
            risk: "Vendor outage",
            impact: "High",
            mitigation: "Failover",
            severity,
            stageNames: [],
            project: { name: "CRM Portal" },
          },
        ],
        decisions: [],
      },
    ],
  };
}

describe("toAssembledReport — PDF portfolio totals floor (Shape B)", () => {
  it("counts the product red (not green) for a covers-all blocked own risk", () => {
    const report = toAssembledReport(
      reportRow("blocked") as unknown as Parameters<
        typeof toAssembledReport
      >[0],
    );

    expect(report.portfolioOverview.status).toBe("red");
    expect(report.portfolioOverview.totals).toMatchObject({ red: 1, green: 0 });
  });

  it("counts the product yellow for a covers-all at-risk own risk", () => {
    const report = toAssembledReport(
      reportRow("at-risk") as unknown as Parameters<
        typeof toAssembledReport
      >[0],
    );

    expect(report.portfolioOverview.status).toBe("yellow");
    expect(report.portfolioOverview.totals).toMatchObject({
      yellow: 1,
      green: 0,
    });
  });
});
