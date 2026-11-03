import { vi } from "vitest";

import {
  toastError,
  toastSuccess,
} from "./weekly-report-page.section-filter.test-support";
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]): void => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]): void => {
      toastError(...args);
    },
    info: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  buildEscalationsFromReadSections,
  buildPortfolioProductsFromSnapshotSections,
  weeklyReportReadModelSchema,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
} from "./__tests__/weekly-report-page-harness";
import {
  AUTHOR_ID_B,
  draftSection,
  submittedSection,
} from "./weekly-report-page.section-filter.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage — red-only draft co-owner delivery — 1", () => {
  it.each(["submitted-first", "draft-first"] as const)(
    "reveals draft own red panel without copying global attention, %s",
    async (order) => {
      const submitted = {
        ...submittedSection(),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Shared red product",
            trafficLight: "red" as const,
          },
        ],
      };
      const draft = {
        ...draftSection(),
        items: [],
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Shared red product",
            trafficLight: "red" as const,
          },
        ],
      };
      const data = makeWeeklyReportData("open", {
        leadSections:
          order === "submitted-first" ? [submitted, draft] : [draft, submitted],
        portfolioOverview: [],
      });
      const escalations = buildEscalationsFromReadSections(data.leadSections);
      expect(escalations.filter((row) => row.type === "at_risk")).toHaveLength(
        1,
      );
      renderWeeklyReportPage(
        weeklyReportReadModelSchema.parse({
          ...data,
          escalations,
          portfolioOverview: buildPortfolioProductsFromSnapshotSections(
            data.leadSections,
          ),
        }),
        { scope: "lead" },
      );
      await waitFor(() =>
        expect(
          screen.queryByTestId("weekly-report-skeleton"),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId("draft-hidden-signal")).toHaveTextContent(
        "1 section in draft",
      );
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: /show all/i }));
      const bob = document.getElementById(
        `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_A}`,
      );
      expect(bob).not.toBeNull();
      const alice = document.getElementById(
        `report-lead-${AUTHOR_ID_A}-product-${PRODUCT_ID_A}`,
      );
      expect(alice).not.toBeNull();
      if (!bob || !alice) throw new Error("Expected both own product panels");
      expect(
        within(bob).getByRole("button", { name: /shared red product/i }),
      ).toBeEnabled();
      await userEvent
        .setup()
        .click(
          within(bob).getByRole("button", { name: /shared red product/i }),
        );
      await userEvent
        .setup()
        .click(
          within(alice).getByRole("button", { name: /shared red product/i }),
        );
      expect(
        screen.getAllByText("Project Shared red product is flagged red."),
      ).toHaveLength(1);
      const representative = order === "submitted-first" ? alice : bob;
      const other = order === "submitted-first" ? bob : alice;
      expect(
        within(representative).getByText(
          "Project Shared red product is flagged red.",
        ),
      ).toBeInTheDocument();
      expect(
        within(other).queryByText("Project Shared red product is flagged red."),
      ).not.toBeInTheDocument();
    },
  );
});
