/**
 * @vitest-environment jsdom
 *
 * a11y regression coverage for apps/web/src/features/dashboard/ui/kpi-cards.tsx.
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
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
  describe("Submissions card root element", () => {
    it("renders as a <section> element (not a <div>)", () => {
      render(<KpiCards data={baseData} />);
      // section elements with aria-label are exposed as 'region' landmarks
      const regions = screen.getAllByRole("region");
      // first region is the Submissions card
      expect(expectDefined(regions[0]).tagName.toLowerCase()).toBe("section");
    });
  });

  describe("Submissions card aria-label", () => {
    it("has aria-label with submitted, total, and pendingCount", () => {
      render(<KpiCards data={baseData} />);
      const section = screen.getByRole("region", {
        name: "Submissions: 5 of 8, 3 pending",
      });
      expect(section).toBeInTheDocument();
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
  });

  describe("Deadline card root element", () => {
    it("renders as a <section> element (not a <div>)", () => {
      render(<KpiCards data={baseData} />);
      const regions = screen.getAllByRole("region");
      expect(expectDefined(regions[1]).tagName.toLowerCase()).toBe("section");
    });
  });

  describe("Deadline card aria-label", () => {
    it("has aria-label with deadlineLabel and deadlineTime", () => {
      render(<KpiCards data={baseData} />);
      const section = screen.getByRole("region", {
        name: "Deadline: Thu, 5:00 PM",
      });
      expect(section).toBeInTheDocument();
    });
  });

  describe("Risks & Blockers card root element", () => {
    it("renders as a <section> element (not a <div>)", () => {
      render(<KpiCards data={baseData} />);
      const regions = screen.getAllByRole("region");
      expect(expectDefined(regions[2]).tagName.toLowerCase()).toBe("section");
    });
  });

  describe("Risks & Blockers card aria-label", () => {
    it("has aria-label with blockedCount, atRiskCount, and decisionCount", () => {
      render(<KpiCards data={baseData} />);
      const section = screen.getByRole("region", {
        name: "Risks: 2 blocked, 1 at risk, 4 decisions",
      });
      expect(section).toBeInTheDocument();
    });
  });

  describe("All 3 KPI cards as distinct regions", () => {
    it("exposes exactly 3 landmark regions in the accessibility tree", () => {
      render(<KpiCards data={baseData} />);
      const regions = screen.getAllByRole("region");
      expect(regions).toHaveLength(3);
    });

    it("each region has a distinct, non-empty accessible name", () => {
      render(<KpiCards data={baseData} />);
      const regions = screen.getAllByRole("region");
      const names = regions.map((r) => r.getAttribute("aria-label"));
      names.forEach((name) => expect(name).toBeTruthy());
      const unique = new Set(names);
      expect(unique.size).toBe(3);
    });
  });

  describe("last-week comparison — not available yet", () => {
    it("renders a Coming Soon badge instead of a fabricated 0/0 comparison", () => {
      render(<KpiCards data={baseData} />);
      expect(screen.getByText("Last week")).toBeInTheDocument();
      expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    });

    it("never renders a literal last-week numeric comparison", () => {
      const { container } = render(<KpiCards data={baseData} />);
      expect(container.textContent).not.toMatch(/Last week \d+\/\d+/);
    });
  });

  describe("zero total — no NaN", () => {
    const zeroData: KpiData = {
      ...baseData,
      submitted: 0,
      total: 0,
      pendingCount: 0,
    };

    it("exposes the Submissions region without NaN", () => {
      render(<KpiCards data={zeroData} />);
      const section = screen.getByRole("region", {
        name: /^Submissions: 0 of 0, 0 pending$/,
      });
      expect(section).toBeInTheDocument();
      expect(section.getAttribute("aria-label")).not.toContain("NaN");
    });

    it("renders the conic ring title at 0% with a finite gradient and no NaN", () => {
      const { container } = render(<KpiCards data={zeroData} />);
      const ring = container.querySelector<HTMLElement>("[title]");
      expect(ring).not.toBeNull();
      if (ring === null) throw new Error("conic ring not found");
      expect(ring.getAttribute("title")).toBe(
        "0 of 0 leads submitted this week (0%)",
      );
      expect(ring.style.background).toContain("0% 0%");
      expect(ring.style.background).not.toContain("NaN");
    });

    it("renders no NaN anywhere in the card text", () => {
      const { container } = render(<KpiCards data={zeroData} />);
      expect(container.textContent).not.toContain("NaN");
    });
  });

  describe("layout snapshot", () => {
    it("KPI cards visual layout: section elements inherit grid container", () => {
      const { container } = render(<KpiCards data={baseData} />);
      const grid = container.firstElementChild as HTMLElement;
      expect(grid).not.toBeNull();
      expect(grid.tagName.toLowerCase()).toBe("div");
      expect(grid.className).toContain("grid");
      expect(grid.className).toContain("gap-3");
    });

    it("snapshot: full DOM snapshot of KpiCards (layout preservation)", () => {
      const { container } = render(<KpiCards data={baseData} />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
