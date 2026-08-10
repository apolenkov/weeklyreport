import "@testing-library/jest-dom/vitest";

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

describe("WeeklyReportPage author highlighting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("highlights only one authored section when an author maps to multiple products", async () => {
    const data = makeWeeklyReportData("published", {
      portfolioOverview: [
        {
          productId: PRODUCT_ID_A,
          productName: "Product Alpha",
          worstStatus: "green",
          stageCount: 2,
          leadNames: ["Alice"],
          leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
        },
        {
          productId: PRODUCT_ID_B,
          productName: "Product Beta",
          worstStatus: "yellow",
          stageCount: 1,
          leadNames: ["Alice"],
          leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
        },
      ],
      leadSections: [
        {
          reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
          reportId: REPORT_ID,
          authorId: AUTHOR_ID_A,
          authorName: "Alice",
          status: "submitted",
          submittedAt: new Date("2026-04-14T09:00:00Z"),
          projects: [{ projectId: PRODUCT_ID_A, projectName: "Product Alpha" }],
          items: [
            {
              id: "33333333-3333-4333-8333-aaaaaaaaaa01",
              projectId: PRODUCT_ID_A,
              type: "current",
              text: "Done task A",
              tag: "Dev",
              workflowStatus: "done",
              carriedOver: false,
              completed: true,
            },
          ],
          risks: [],
          decisions: [],
          priorities: [],
        },
        {
          reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
          reportId: REPORT_ID,
          authorId: AUTHOR_ID_A,
          authorName: "Alice",
          status: "submitted",
          submittedAt: new Date("2026-04-14T10:00:00Z"),
          projects: [{ projectId: PRODUCT_ID_B, projectName: "Product Beta" }],
          items: [
            {
              id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
              projectId: PRODUCT_ID_B,
              type: "current",
              text: "Done task B",
              tag: "Dev",
              workflowStatus: "in_progress",
              carriedOver: false,
              completed: false,
            },
          ],
          risks: [],
          decisions: [],
          priorities: [],
        },
      ],
    });

    renderWeeklyReportPage(data, { authorId: AUTHOR_ID_A });

    await waitFor(() => {
      const alphaSection = document.getElementById(
        `report-product-${PRODUCT_ID_A}`,
      );
      const betaSection = document.getElementById(
        `report-product-${PRODUCT_ID_B}`,
      );
      expect(alphaSection).not.toBeNull();
      expect(betaSection).not.toBeNull();
      const alphaAccordion = alphaSection?.querySelector(
        "button[aria-expanded]",
      );
      const betaAccordion = betaSection?.querySelector("button[aria-expanded]");
      expect(alphaAccordion).toHaveAttribute("aria-expanded", "true");
      expect(betaAccordion).toHaveAttribute("aria-expanded", "false");
    });
  });
});
