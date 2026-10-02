// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import { ToolbarPeriodCluster } from "./lead-form-toolbar-controls";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

describe("ToolbarPeriodCluster", () => {
  it("keeps the archive switch on the period navigation row at narrow widths", () => {
    render(
      <ToolbarPeriodCluster
        viewModel={
          {
            visiblePeriods: [],
            hasArchivedPeriods: true,
          } as unknown as LeadFormLoadedViewModel
        }
        leadSubmittedAt={null}
        showArchivePeriods={false}
        onShowArchivePeriodsChange={vi.fn()}
      />,
    );

    const cluster = screen.getByTestId("toolbar-period-cluster");
    expect(cluster.className).toContain("flex-nowrap");
    expect(cluster.className).not.toContain("flex-wrap");
    expect(
      cluster.contains(
        screen.getByRole("group", { name: /Period navigation/ }),
      ),
    ).toBe(true);
    expect(
      cluster.contains(
        screen.getByRole("switch", {
          name: "Show closed (archived) report periods",
        }),
      ),
    ).toBe(true);
  });
});
