/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts (as HTMLInputElement / HTMLSelectElement) are flagged redundant by ESLint's type-aware program, but the app tsconfig requires them for .value/.checked/.options access (TS2339); wave-6c-ii */
/**
 * Tests for the lead-side <PeriodNavigator/>.
 *
 * Phase 35-07 (UX-15): nav now emits path-segment URLs
 * (`/lead/report/<reportId>`) via `router.push` so each addressed period
 * has a shareable URL and the browser back button walks the period
 * history one week at a time. The legacy `?period=` query has been retired
 * (it no longer drives selection state on the bare route).
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockPathname = "/lead/report";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

import type { ReportPeriod } from "./mock-data";
import { PeriodNavigator } from "./period-navigator";

const PERIODS: ReportPeriod[] = [
  {
    id: "2026-W17",
    sourceSectionId: "sec-W17",
    weekLabel: "Week 17",
    dateRange: "Apr 21–27, 2026",
    isCurrent: true,
    isSubmitted: false,
  },
  {
    id: "2026-W16",
    sourceSectionId: "sec-W16",
    weekLabel: "Week 16",
    dateRange: "Apr 14–20, 2026",
    isCurrent: false,
    isSubmitted: true,
  },
  {
    id: "2026-W15",
    sourceSectionId: "sec-W15",
    weekLabel: "Week 15",
    dateRange: "Apr 7–13, 2026",
    isCurrent: false,
    isSubmitted: true,
  },
];

describe("PeriodNavigator (lead)", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    mockSearchParams = new URLSearchParams();
    mockPathname = "/lead/report";
  });

  // VA-0a: a11y regression tests — verify-a11y-recommended-flip catalog
  describe("a11y — decorative SVG aria-hidden", () => {
    it("ChevronLeft SVG in Previous button has aria-hidden='true'", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const prevButton = screen.getByRole("button", {
        name: "Previous period",
      });
      const svg = prevButton.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("ChevronRight SVG in Next button has aria-hidden='true'", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const nextButton = screen.getByRole("button", { name: "Next period" });
      const svg = nextButton.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("ChevronRight SVG in select decorator span has aria-hidden='true'", () => {
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      // The select decorator is a pointer-events-none span wrapping ChevronRight.
      const decoratorSpan = container.querySelector(".pointer-events-none svg");
      expect(decoratorSpan).toHaveAttribute("aria-hidden", "true");
    });

    it("all three SVGs rendered have aria-hidden='true' (no SVG exposes to a11y tree)", () => {
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs).toHaveLength(3);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("ChevronLeft decorative purpose: Previous button accessible name is not derived from SVG content", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      // getByRole resolves via aria-label; if SVG were in the a11y tree it
      // would contribute path content and pollute the name.
      expect(
        screen.getByRole("button", { name: "Previous period" }),
      ).toBeInTheDocument();
    });

    it("ChevronRight decorative purpose: Next button accessible name is not derived from SVG content", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      expect(
        screen.getByRole("button", { name: "Next period" }),
      ).toBeInTheDocument();
    });

    it("Previous button renders visible text 'Previous' alongside aria-hidden chevron", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      // The xl:hidden span still renders in jsdom; visible text is present.
      const prevButton = screen.getByRole("button", {
        name: "Previous period",
      });
      expect(prevButton).toHaveTextContent("Previous");
    });

    it("Next button renders visible text 'Next' alongside aria-hidden chevron", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const nextButton = screen.getByRole("button", { name: "Next period" });
      expect(nextButton).toHaveTextContent("Next");
    });
  });

  // VA-0b: snapshot — container group role
  describe("a11y — container group role snapshot", () => {
    it("container div has role='group' with the period navigation aria-label", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const group = screen.getByRole("group", {
        name: "Period navigation (swipe left/right or use arrows)",
      });
      expect(group).toBeInTheDocument();
      expect(group).toMatchSnapshot();
    });
  });

  it("selecting a non-current period pushes the addressed URL", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2026-W16" } });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/lead/report/2026-W16");
    expect(replace).not.toHaveBeenCalled();
  });

  it("selecting the current period also pushes the addressed URL", () => {
    mockPathname = "/lead/report/2026-W16";
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2026-W17" } });
    expect(push).toHaveBeenCalledWith("/lead/report/2026-W17");
  });

  it("initial render reflects the path-segment reportId", () => {
    mockPathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    expect(select.value).toBe("2026-W15");
  });

  it("ignores a stale ?period= query (retired) and defaults to the current period", () => {
    mockPathname = "/lead/report";
    mockSearchParams = new URLSearchParams("period=2026-W15");
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    // The legacy `?period=` fallback was removed; with no path-segment id the
    // dropdown defaults to PERIODS[0] (2026-W17, the current period).
    expect(select.value).toBe("2026-W17");
  });

  it("D-17: current period option carries (Current) suffix; no week/period numbering", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;

    expect(select.selectedOptions.item(0)?.textContent).toBe(
      "Apr 21–27, 2026 (Current)",
    );
    expect(select.selectedOptions.item(0)?.textContent).not.toContain("Period");
    expect(select.selectedOptions.item(0)?.textContent).not.toContain("Week");
  });

  it("D-17: past-period option text is the bare date range (no suffix)", () => {
    mockPathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;

    expect(select.selectedOptions.item(0)?.textContent).toBe("Apr 7–13, 2026");
  });

  it("does not render a standalone Current badge element", () => {
    // The (Current) suffix lives in the option text only; no inline badge.
    render(<PeriodNavigator periods={PERIODS} />);
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });
});
