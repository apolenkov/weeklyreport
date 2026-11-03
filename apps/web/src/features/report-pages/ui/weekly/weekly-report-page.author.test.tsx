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
// @vitest-environment jsdom
import "./weekly-report-page.author.test-support";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { WeeklyReportPage } from "./weekly-report-page";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage author highlighting — 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it.each([false, true])(
    "focuses only the mixed author's section in Review (reduced motion %s)",
    async (reducedMotion) => {
      const scroll = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scroll;
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockReturnValue({ matches: reducedMotion }),
      );
      const initial = makeWeeklyReportData("open");
      const data = makeWeeklyReportData("open", {
        leadSections: initial.leadSections.map((section) => ({
          ...section,
          canReview: true,
          activities: [
            {
              activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              activityName: "Duty",
              status: "yellow",
              note: "Activity note",
              linkedProducts: [],
            },
          ],
        })),
      });
      const { rerender } = renderWeeklyReportPage(data, { scope: "lead" });
      await screen.findByText("Activity note");
      scroll.mockClear();
      rerender(
        <WeeklyReportPage authorId={AUTHOR_ID_A} scope="lead" reviewIntent />,
      );
      const region = await screen.findByRole("region", { name: "Alice" });
      await waitFor(() => expect(region).toHaveFocus());
      expect(
        scroll.mock.instances.map((element) => (element as HTMLElement).id),
      ).toEqual([`report-lead-${AUTHOR_ID_A}`]);
      expect(scroll).toHaveBeenCalledWith({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      expect(
        screen.getAllByRole("button", { name: "Approve Alice" }),
      ).toHaveLength(1);
    },
  );
});
describe("WeeklyReportPage author highlighting — 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("addresses an unavailable Activity-only author without inventing a Product target", async () => {
    const data = makeWeeklyReportData("open", {
      portfolioOverview: [],
      leadSections: [
        {
          reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
          authorId: AUTHOR_ID_A,
          authorName: "Alice",
          status: "submitted",
          canReview: true,
          projects: [],
          activities: [],
          items: [],
          decisions: [],
          risks: [
            {
              id: "33333333-3333-4333-8333-aaaaaaaaaa01",
              activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              risk: "Saved Activity risk",
              impact: "Delay",
              mitigation: "Escalate",
              severity: "blocked",
              stageNames: [],
            },
          ],
        },
      ],
    });
    const { rerender } = renderWeeklyReportPage(data, { scope: "lead" });
    await screen.findByText("Activity details unavailable");
    rerender(
      <WeeklyReportPage authorId={AUTHOR_ID_A} scope="lead" reviewIntent />,
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Alice" })).toHaveFocus(),
    );
    expect(document.querySelector('[id^="report-product-"]')).toBeNull();
    expect(screen.getAllByTestId("activity-status-strip")).toHaveLength(1);
  });
});
describe("WeeklyReportPage author highlighting — 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
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
          projects: [
            {
              projectId: PRODUCT_ID_A,
              projectName: "Product Alpha",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "33333333-3333-4333-8333-aaaaaaaaaa01",
              projectId: PRODUCT_ID_A,
              type: "current",
              text: "Done task A",
              tag: "Dev",
              workflowStatus: "done",
              stageNames: ["Development"],
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
        },
        {
          reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
          reportId: REPORT_ID,
          authorId: AUTHOR_ID_A,
          authorName: "Alice",
          status: "submitted",
          submittedAt: new Date("2026-04-14T10:00:00Z"),
          projects: [
            {
              projectId: PRODUCT_ID_B,
              projectName: "Product Beta",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
              projectId: PRODUCT_ID_B,
              type: "current",
              text: "Done task B",
              tag: "Dev",
              workflowStatus: "in_progress",
              stageNames: ["Development"],
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
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
      // Beta is at risk, so it leads the severity-ordered list and takes the highlight.
      expect(betaAccordion).toHaveAttribute("aria-expanded", "true");
      expect(alphaAccordion).toHaveAttribute("aria-expanded", "false");
    });
  });
});
