import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

it.each([true, false])(
  "offers Reopen only when archived is %s",
  async (archived) => {
    renderWeeklyReportPage({ ...makeWeeklyReportData("published"), archived });
    await screen.findByRole("button", {
      name: archived
        ? /restore this report from the archive/i
        : /move this report to the archive/i,
    });
    expect(
      screen.queryByRole("button", { name: "Reopen period" }) !== null,
    ).toBe(!archived);
    if (archived)
      expect(
        screen.getByRole("button", {
          name: /restore this report from the archive/i,
        }),
      ).toBeInTheDocument();
  },
);
