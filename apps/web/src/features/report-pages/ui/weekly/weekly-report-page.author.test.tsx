import "@testing-library/jest-dom/vitest";

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const AUTHOR_ID_B = "11111111-1111-4111-8111-bbbbbbbbbbbb";

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
      expect(alphaAccordion).toHaveAttribute("aria-expanded", "true");
      expect(betaAccordion).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("namespaces a repeated product by lead and scrolls the author-linked instance", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const data = makeWeeklyReportData("published", {
      portfolioOverview: [
        {
          productId: PRODUCT_ID_A,
          productName: "Product Alpha",
          worstStatus: "yellow",
          stageCount: 2,
          leadNames: ["Alice", "Bob"],
          leadIds: [AUTHOR_ID_A, AUTHOR_ID_B],
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
              text: "Alice task",
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
          reportSectionId: "22222222-2222-4222-8222-bbbbbbbbbbb1",
          reportId: REPORT_ID,
          authorId: AUTHOR_ID_B,
          authorName: "Bob",
          status: "submitted",
          submittedAt: new Date("2026-04-14T10:00:00Z"),
          projects: [
            {
              projectId: PRODUCT_ID_A,
              projectName: "Product Alpha",
              trafficLight: "yellow",
            },
          ],
          items: [
            {
              id: "33333333-3333-4333-8333-bbbbbbbbbbb1",
              projectId: PRODUCT_ID_A,
              type: "current",
              text: "Bob task",
              tag: "QA",
              workflowStatus: "in_progress",
              stageNames: ["Testing"],
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
        },
      ],
    });

    renderWeeklyReportPage(data, {
      authorId: AUTHOR_ID_B,
      scope: "lead",
    });

    const aliceRootId = `report-lead-${AUTHOR_ID_A}-product-${PRODUCT_ID_A}`;
    const bobRootId = `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_A}`;
    const aliceRoot = await waitFor(() => {
      const element = document.getElementById(aliceRootId);
      if (!element) throw new Error("Alice product accordion was not rendered");
      return element;
    });
    const bobRoot = document.getElementById(bobRootId);
    if (!bobRoot) throw new Error("Bob product accordion was not rendered");

    const aliceToggle = within(aliceRoot).getByRole("button", {
      name: /Product Alpha.*Alice/i,
    });
    const bobToggle = within(bobRoot).getByRole("button", {
      name: /Product Alpha.*Bob/i,
    });
    const alicePanel = document.getElementById(`${aliceRootId}-panel`);
    const bobPanel = document.getElementById(`${bobRootId}-panel`);
    if (!alicePanel || !bobPanel) {
      throw new Error("Lead product accordion panels were not rendered");
    }

    const instanceIds = [
      aliceRoot.id,
      bobRoot.id,
      aliceToggle.id,
      bobToggle.id,
      alicePanel.id,
      bobPanel.id,
    ];
    expect(new Set(instanceIds).size).toBe(instanceIds.length);
    expect(aliceToggle).toHaveAttribute("aria-controls", alicePanel.id);
    expect(alicePanel).toHaveAttribute("aria-labelledby", aliceToggle.id);
    expect(bobToggle).toHaveAttribute("aria-controls", bobPanel.id);
    expect(bobPanel).toHaveAttribute("aria-labelledby", bobToggle.id);
    expect(alicePanel).toHaveAccessibleName(/Product Alpha.*Alice/i);
    expect(bobPanel).toHaveAccessibleName(/Product Alpha.*Bob/i);
    expect(aliceRoot).toHaveAttribute("data-feedback-anchor", aliceRootId);
    expect(bobRoot).toHaveAttribute("data-feedback-anchor", bobRootId);
    expect(
      document.getElementById(`report-product-${PRODUCT_ID_A}`),
    ).toBeNull();

    expect(aliceToggle).toHaveAttribute("aria-expanded", "false");
    expect(bobToggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => {
      const scrolledIds = scrollIntoView.mock.instances.map(
        (instance) => (instance as HTMLElement).id,
      );
      expect(scrolledIds).toContain(bobRootId);
      expect(scrolledIds).not.toContain(aliceRootId);
    });

    const user = userEvent.setup();
    aliceToggle.focus();
    await user.keyboard("{Enter}");
    expect(aliceToggle).toHaveAttribute("aria-expanded", "true");

    scrollIntoView.mockClear();
    screen.getByTitle("Jump to Alice's section").focus();
    await user.keyboard("{Enter}");
    const aliceLeadSection = document.getElementById(
      `report-lead-${AUTHOR_ID_A}`,
    );
    if (!aliceLeadSection)
      throw new Error("Alice lead section was not rendered");
    await waitFor(() => expect(aliceLeadSection).toHaveFocus());
    const navigationScrollIds = scrollIntoView.mock.instances.map(
      (instance) => (instance as HTMLElement).id,
    );
    expect(navigationScrollIds).toContain(aliceLeadSection.id);
    expect(navigationScrollIds).not.toContain(aliceRootId);
    expect(navigationScrollIds).not.toContain(bobRootId);
  });
});
