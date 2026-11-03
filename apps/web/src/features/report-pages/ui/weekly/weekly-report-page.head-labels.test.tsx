import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HEAD_DEPARTMENT_LABEL } from "../head/head-report-chrome";
import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

describe("Head report lifecycle context parity", () => {
  it.each([
    ["open", false, "Live"],
    ["published", false, "Published"],
    ["published", true, "Archived"],
  ] as const)(
    "keeps neutral detail for %s, archived %s",
    async (status, archived, label) => {
      renderWeeklyReportPage(makeWeeklyReportData(status, { archived }), {
        headerContextLabel: HEAD_DEPARTMENT_LABEL,
      });
      expect(
        await screen.findByText(`${label} · 4/6 Submitted`),
      ).toBeInTheDocument();
      expect(screen.getByText("Portfolio report")).toBeInTheDocument();
      expect(
        screen.queryByText("Live portfolio review"),
      ).not.toBeInTheDocument();
    },
  );

  it("does not change portfolio context when entering Review", async () => {
    const initial = makeWeeklyReportData("open");
    renderWeeklyReportPage(
      {
        ...initial,
        leadSections: initial.leadSections.map((section) => ({
          ...section,
          canReview: true,
        })),
      },
      { headerContextLabel: HEAD_DEPARTMENT_LABEL },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );
    expect(screen.getByText("Portfolio report")).toBeInTheDocument();
    expect(screen.getByText("Live · 4/6 Submitted")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Approve / })).toHaveLength(
      1,
    );
  });
});
