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
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { weeklyReportReadModelSchema } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { WeeklyReportPage } from "./weekly-report-page";
import {
  AUTHOR_ID_B,
  AUTHOR_ID_C,
  PRODUCT_ID_C,
} from "./weekly-report-page.author.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage author highlighting — 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("targets the focused lead's own content rather than a co-owner's aggregate product", async () => {
    const data = weeklyReportReadModelSchema.parse(
      makeWeeklyReportData("open", {
        submissionCount: 2,
        totalLeads: 2,
        portfolioOverview: [
          {
            productId: PRODUCT_ID_A,
            productName: "Product Alpha",
            worstStatus: "red",
            stageCount: 1,
            leadNames: ["Alice", "Bob"],
            leadIds: [AUTHOR_ID_A, AUTHOR_ID_B],
          },
          {
            productId: PRODUCT_ID_B,
            productName: "Product Beta",
            worstStatus: "green",
            stageCount: 1,
            leadNames: ["Bob"],
            leadIds: [AUTHOR_ID_B],
          },
        ],
        leadSections: [
          {
            reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
            authorId: AUTHOR_ID_A,
            authorName: "Alice",
            status: "submitted",
            submittedAt: new Date("2026-04-14T09:00:00Z"),
            projects: [
              {
                projectId: PRODUCT_ID_A,
                projectName: "Product Alpha",
                trafficLight: "red",
              },
            ],
            items: [
              {
                id: "33333333-3333-4333-8333-aaaaaaaaaa01",
                projectId: PRODUCT_ID_A,
                type: "current",
                text: "Alice's Alpha work",
                tag: "Dev",
                workflowStatus: "in_progress",
                carriedOver: false,
              },
            ],
          },
          {
            reportSectionId: "22222222-2222-4222-8222-bbbbbbbbbbb1",
            authorId: AUTHOR_ID_B,
            authorName: "Bob",
            status: "submitted",
            submittedAt: new Date("2026-04-14T10:00:00Z"),
            projects: [
              {
                projectId: PRODUCT_ID_A,
                projectName: "Product Alpha",
                trafficLight: "green",
              },
              {
                projectId: PRODUCT_ID_B,
                projectName: "Product Beta",
                trafficLight: "green",
              },
            ],
            items: [
              {
                id: "33333333-3333-4333-8333-bbbbbbbbbbb1",
                projectId: PRODUCT_ID_B,
                type: "current",
                text: "Bob's Beta work",
                tag: "Dev",
                workflowStatus: "done",
                carriedOver: false,
              },
            ],
          },
        ],
      }),
    );
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderWeeklyReportPage(data, { authorId: AUTHOR_ID_B, scope: "lead" });

    const bobProductId = `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_B}`;
    await waitFor(() =>
      expect(document.getElementById(bobProductId)).not.toBeNull(),
    );
    const bobProduct = document.getElementById(bobProductId);
    if (!bobProduct) throw new Error("Bob's Beta panel is missing");
    expect(
      document.getElementById(
        `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_A}`,
      ),
    ).toBeNull();
    expect(bobProduct.querySelector("button[aria-expanded]")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await waitFor(() => {
      const receivers = scrollIntoView.mock.instances.map(
        (instance) => (instance as HTMLElement).id,
      );
      expect(receivers).toContain(bobProductId);
      expect(receivers).not.toContain(
        `report-lead-${AUTHOR_ID_A}-product-${PRODUCT_ID_A}`,
      );
      expect(receivers).not.toContain(
        `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_A}`,
      );
    });
    expect(document.getElementById(`report-lead-${AUTHOR_ID_B}`)).toHaveFocus();
  });
});
describe("WeeklyReportPage author highlighting — 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("drops a stale overview target when the author focus changes while mounted", async () => {
    const user = userEvent.setup();
    const sectionFor = (
      reportSectionId: string,
      authorId: string,
      authorName: string,
      productId: string,
      productName: string,
      itemId: string,
    ) => ({
      reportSectionId,
      reportId: REPORT_ID,
      authorId,
      authorName,
      status: "submitted" as const,
      submittedAt: new Date("2026-04-14T09:00:00Z"),
      projects: [
        {
          projectId: productId,
          projectName: productName,
          trafficLight: "green" as const,
        },
      ],
      items: [
        {
          id: itemId,
          projectId: productId,
          type: "current" as const,
          text: `${authorName} task`,
          tag: "Dev",
          workflowStatus: "done" as const,
          stageNames: ["Development"],
          carriedOver: false,
        },
      ],
      risks: [],
      decisions: [],
    });
    const data = makeWeeklyReportData("published", {
      portfolioOverview: [
        {
          productId: PRODUCT_ID_A,
          productName: "Product Alpha",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Alice"],
          leadIds: [AUTHOR_ID_A],
        },
        {
          productId: PRODUCT_ID_B,
          productName: "Product Beta",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Bob"],
          leadIds: [AUTHOR_ID_B],
        },
        {
          productId: PRODUCT_ID_C,
          productName: "Product Gamma",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Carol"],
          leadIds: [AUTHOR_ID_C],
        },
      ],
      leadSections: [
        sectionFor(
          "22222222-2222-4222-8222-aaaaaaaaaaa1",
          AUTHOR_ID_A,
          "Alice",
          PRODUCT_ID_A,
          "Product Alpha",
          "33333333-3333-4333-8333-aaaaaaaaaa01",
        ),
        sectionFor(
          "22222222-2222-4222-8222-bbbbbbbbbbb1",
          AUTHOR_ID_B,
          "Bob",
          PRODUCT_ID_B,
          "Product Beta",
          "33333333-3333-4333-8333-bbbbbbbbbb01",
        ),
        sectionFor(
          "22222222-2222-4222-8222-ccccccccccc1",
          AUTHOR_ID_C,
          "Carol",
          PRODUCT_ID_C,
          "Product Gamma",
          "33333333-3333-4333-8333-cccccccccc01",
        ),
      ],
    });

    const { rerender } = renderWeeklyReportPage(data, {
      authorId: AUTHOR_ID_A,
    });
    const toggleFor = (productId: string) => {
      const root = document.getElementById(`report-product-${productId}`);
      const toggle = root?.querySelector("button[aria-expanded]");
      if (!toggle) throw new Error(`No accordion toggle for ${productId}`);
      return toggle;
    };
    // Deep-link focus lands on Alice's product.
    await waitFor(() =>
      expect(toggleFor(PRODUCT_ID_A)).toHaveAttribute("aria-expanded", "true"),
    );
    // Real production navigator: the overview card lifts its target into the
    // page-level navigation state.
    await user.click(screen.getByTitle("Open Product Gamma details"));
    await waitFor(() =>
      expect(toggleFor(PRODUCT_ID_C)).toHaveAttribute("aria-expanded", "true"),
    );
    // The author focus transitions while the page stays mounted (authorId is
    // not part of the weeklyReport.get query key): the fresh deep-link focus
    // must win over the stale overview target.
    rerender(<WeeklyReportPage authorId={AUTHOR_ID_B} />);
    await waitFor(() =>
      expect(toggleFor(PRODUCT_ID_B)).toHaveAttribute("aria-expanded", "true"),
    );
  });
});
