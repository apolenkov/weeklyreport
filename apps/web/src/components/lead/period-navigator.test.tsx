/**
 * Tests for the lead-side <PeriodNavigator/>.
 *
 * Phase 35-07 (UX-15): nav emits path-segment URLs
 * (`/lead/report/<reportId>`) via `router.push` so each addressed period
 * has a shareable URL and the browser back button walks the period
 * history one week at a time. The legacy `?period=` query was retired.
 *
 * fix-lead-stripe-and-archived-badges (D3): the native <select> is now a
 * custom keyboard-accessible listbox (combobox trigger + portaled panel)
 * so archived options can carry a neutral "Archived" badge.
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
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
    archived: true,
  },
];

function getTrigger() {
  return screen.getByRole("combobox", { name: "Select reporting period" });
}

describe("PeriodNavigator (lead)", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    mockSearchParams = new URLSearchParams();
    mockPathname = "/lead/report";
  });

  // VA-0a: a11y regression tests — decorative SVGs stay hidden.
  describe("a11y — decorative SVG aria-hidden", () => {
    it("ChevronLeft SVG in Previous button has aria-hidden='true'", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const prevButton = screen.getByRole("button", {
        name: "Previous period",
      });
      expect(prevButton.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it("ChevronRight SVG in Next button has aria-hidden='true'", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const nextButton = screen.getByRole("button", { name: "Next period" });
      expect(nextButton.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it("ChevronRight SVG in trigger decorator span has aria-hidden='true'", () => {
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      const decoratorSpan = container.querySelector(".pointer-events-none svg");
      expect(decoratorSpan).toHaveAttribute("aria-hidden", "true");
    });

    it("all three navigator SVGs have aria-hidden='true' (closed listbox)", () => {
      // prev-button + next-button + trigger-chevron decorator = 3. The listbox
      // panel is portaled to document.body, so it is outside `container`.
      const { container } = render(<PeriodNavigator periods={PERIODS} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs).toHaveLength(3);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  // VA-0b: container group role.
  it("container div has role='group' with the period navigation aria-label", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    expect(
      screen.getByRole("group", {
        name: "Period navigation (swipe left/right or use arrows)",
      }),
    ).toBeInTheDocument();
  });

  // ---- Custom listbox contract (D3) ----
  describe("custom listbox", () => {
    it("trigger exposes the combobox a11y contract and starts closed", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("opens the listbox on trigger click and renders an option per period", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getAllByRole("option")).toHaveLength(PERIODS.length);
    });

    it("opens on ArrowDown from the keyboard", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.keyDown(getTrigger(), { key: "ArrowDown" });
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("the current period is marked aria-selected", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      const selected = screen.getByRole("option", {
        name: /Apr 21–27, 2026 \(Current\)/,
      });
      expect(selected).toHaveAttribute("aria-selected", "true");
    });

    it("archived options carry the neutral Archived badge (no text prefix)", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      const archivedOption = screen.getByRole("option", {
        name: /Apr 7–13, 2026/,
      });
      expect(within(archivedOption).getByText("Archived")).toBeInTheDocument();
      // The legacy "[Archived]" bracketed prefix must be gone.
      expect(archivedOption.textContent).not.toContain("[Archived]");
    });

    it("selecting an option via click pushes the addressed URL and closes", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      fireEvent.click(getTrigger());
      fireEvent.mouseDown(
        screen.getByRole("option", { name: /Apr 14–20, 2026/ }),
      );
      expect(push).toHaveBeenCalledWith("/lead/report/2026-W16");
      expect(replace).not.toHaveBeenCalled();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("ArrowDown then Enter selects the next option", () => {
      // Open anchored on the current period (index 0); ArrowDown → index 1.
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(trigger, { key: "Enter" });
      expect(push).toHaveBeenCalledWith("/lead/report/2026-W16");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("Escape closes the listbox without navigating", () => {
      render(<PeriodNavigator periods={PERIODS} />);
      const trigger = getTrigger();
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });
  });

  // ---- Selection state reflected on the trigger ----
  it("trigger shows the (Current) suffix for the current period; no week/period numbering", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const trigger = getTrigger();
    expect(trigger).toHaveTextContent("Apr 21–27, 2026 (Current)");
    expect(trigger.textContent).not.toContain("Period");
    expect(trigger.textContent).not.toContain("Week");
  });

  it("trigger shows the bare date range for a past period (no suffix)", () => {
    mockPathname = "/lead/report/2026-W16";
    render(<PeriodNavigator periods={PERIODS} />);
    expect(getTrigger()).toHaveTextContent("Apr 14–20, 2026");
  });

  it("trigger shows the Archived badge when the selected period is archived", () => {
    mockPathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    const trigger = getTrigger();
    expect(within(trigger).getByText("Archived")).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Apr 7–13, 2026");
  });

  it("initial render reflects the path-segment reportId", () => {
    mockPathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    expect(getTrigger()).toHaveTextContent("Apr 7–13, 2026");
  });

  it("ignores a stale ?period= query (retired) and defaults to the current period", () => {
    mockPathname = "/lead/report";
    mockSearchParams = new URLSearchParams("period=2026-W15");
    render(<PeriodNavigator periods={PERIODS} />);
    // No path-segment id → defaults to PERIODS[0] (2026-W17, the current week).
    expect(getTrigger()).toHaveTextContent("Apr 21–27, 2026 (Current)");
  });
});
