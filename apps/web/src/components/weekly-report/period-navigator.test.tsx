/**
 * Tests for the head-side <HeadPeriodNavigator/>.
 *
 * Phase 35-07 (UX-15): nav now emits path-segment URLs
 * (`/head/report/<reportId>`) via `router.push` so each addressed week is
 * bookmarkable and browser back walks the week history. Both current and
 * past periods route through the same addressed surface; the published
 * archive path (`/reports/[reportId]`) is still reachable from the
 * Reports page but no longer the in-page nav target.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";

const push = vi.fn();
const replace = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockPathname = "/head/report";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

import { HeadPeriodNavigator } from "./period-navigator";
import type { ReportPeriod } from "../dashboard/mock-data";

const PERIODS: ReportPeriod[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    weekLabel: "Week 17",
    dateRange: "Apr 21–27",
    isCurrent: true,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    weekLabel: "Week 16",
    dateRange: "Apr 14–20",
    isCurrent: false,
  },
];

describe("HeadPeriodNavigator", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    mockSearchParams = new URLSearchParams();
    mockPathname = "/head/report";
  });

  it("selecting a non-current period routes to /head/report/<reportId>", () => {
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    fireEvent.change(select, {
      target: { value: "22222222-2222-2222-2222-222222222222" },
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      "/head/report/22222222-2222-2222-2222-222222222222",
    );
  });

  it("selecting the current period also routes to the addressed URL", () => {
    mockPathname = "/head/report/22222222-2222-2222-2222-222222222222";
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    fireEvent.change(select, {
      target: { value: "11111111-1111-1111-1111-111111111111" },
    });
    expect(push).toHaveBeenCalledWith(
      "/head/report/11111111-1111-1111-1111-111111111111",
    );
  });

  it("initial render reflects the path-segment reportId", () => {
    mockPathname = "/head/report/22222222-2222-2222-2222-222222222222";
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    expect(select.value).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("falls back to ?period= search param when no path-segment id", () => {
    mockPathname = "/head/report";
    mockSearchParams = new URLSearchParams(
      "period=22222222-2222-2222-2222-222222222222",
    );
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    expect(select.value).toBe("22222222-2222-2222-2222-222222222222");
  });
});
