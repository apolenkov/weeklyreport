// @vitest-environment jsdom
//
// a11y regression coverage for apps/web/src/features/dashboard/ui/kpi-cards.tsx.
import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { KpiData } from "../model/dashboard";
import { KpiCards } from "./kpi-cards";

const baseData: KpiData = {
  submitted: 5,
  total: 8,
  pendingCount: 3,
  deadlineLabel: "Thu",
  deadlineTime: "5:00 PM",
  blockedCount: 2,
  atRiskCount: 1,
  decisionCount: 4,
};

describe("KpiCards — a11y regression", () => {
  it("exposes exactly three landmark regions with distinct names and section roots", () => {
    render(<KpiCards data={baseData} />);

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(3);
    regions.forEach((region) =>
      expect(region.tagName.toLowerCase()).toBe("section"),
    );
    const names = regions.map((r) => r.getAttribute("aria-label"));
    expect(names).toEqual([
      "Submissions: 5 of 8, 3 pending",
      "Deadline: Thu, 5:00 PM",
      "Risks: 2 blocked, 1 at risk, 4 decisions",
    ]);
  });

  it("uses singular noun forms when a count is 1", () => {
    render(
      <KpiCards
        data={{
          ...baseData,
          blockedCount: 1,
          atRiskCount: 1,
          decisionCount: 1,
        }}
      />,
    );

    const risksRegion = screen.getByRole("region", {
      name: "Risks: 1 blocked, 1 at risk, 1 decision",
    });
    expect(within(risksRegion).getByText("decision")).toBeVisible();
    expect(within(risksRegion).queryByText("decisions")).toBeNull();
  });

  it("reflects updated counts when data changes", () => {
    render(
      <KpiCards
        data={{ ...baseData, submitted: 8, total: 8, pendingCount: 0 }}
      />,
    );
    expect(
      screen.getByRole("region", {
        name: "Submissions: 8 of 8, 0 pending",
      }),
    ).toBeInTheDocument();
  });

  it("renders no last-week comparison, since the read model carries no prior-period data", () => {
    render(<KpiCards data={baseData} />);

    const section = screen.getByRole("region", {
      name: /^Submissions: 5 of 8, 3 pending$/,
    });
    expect(section.textContent).not.toMatch(/last week/i);
    expect(section).toHaveTextContent("3 pending");
  });

  it("exposes the Submissions region and conic ring without NaN when totals are zero", () => {
    const zeroData: KpiData = {
      ...baseData,
      submitted: 0,
      total: 0,
      pendingCount: 0,
    };
    const { container } = render(<KpiCards data={zeroData} />);

    const section = screen.getByRole("region", {
      name: /^Submissions: 0 of 0, 0 pending$/,
    });
    expect(section.getAttribute("aria-label")).not.toContain("NaN");

    const ring = container.querySelector<HTMLElement>("[title]");
    expect(ring).not.toBeNull();
    if (ring === null) throw new Error("conic ring not found");
    expect(ring.getAttribute("title")).toBe(
      "0 of 0 leads submitted this week (0%)",
    );
    expect(ring.style.background).toContain("0% 0%");
    expect(ring.style.background).not.toContain("NaN");
    expect(container.textContent).not.toContain("NaN");
  });
});
