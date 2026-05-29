/**
 * Tests for the lead-side <PeriodNavigator/>.
 *
 * Phase 35-07 (UX-15): nav now emits path-segment URLs
 * (`/lead/report/<reportId>`) via `router.push` so each addressed period
 * has a shareable URL and the browser back button walks the period
 * history one week at a time. The legacy `?period=` query continues to
 * read selection state when the page is rendered under the bare route.
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

  it("falls back to ?period= search param when no path-segment id", () => {
    mockPathname = "/lead/report";
    mockSearchParams = new URLSearchParams("period=2026-W15");
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    expect(select.value).toBe("2026-W15");
  });

  it("D-17: current period option carries (Current) suffix; no week/period numbering", () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;

    expect(select.selectedOptions[0]?.textContent).toBe(
      "Apr 21–27, 2026 (Current)",
    );
    expect(select.selectedOptions[0]?.textContent).not.toContain("Period");
    expect(select.selectedOptions[0]?.textContent).not.toContain("Week");
  });

  it("D-17: past-period option text is the bare date range (no suffix)", () => {
    mockPathname = "/lead/report/2026-W15";
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;

    expect(select.selectedOptions[0]?.textContent).toBe("Apr 7–13, 2026");
  });

  it("does not render a standalone Current badge element", () => {
    // The (Current) suffix lives in the option text only; no inline badge.
    render(<PeriodNavigator periods={PERIODS} />);
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });
});
