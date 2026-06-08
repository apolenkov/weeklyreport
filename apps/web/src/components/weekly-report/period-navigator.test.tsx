/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts (as HTMLInputElement / HTMLSelectElement) are flagged redundant by ESLint's type-aware program, but the app tsconfig requires them for .value/.checked/.options access (TS2339); wave-6c-ii */
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
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockPathname = "/head/report";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

import type { ReportPeriod } from "../dashboard/mock-data";
import { HeadPeriodNavigator } from "./period-navigator";

const PERIODS: ReportPeriod[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    weekLabel: "Week 17",
    dateRange: "Apr 21–27, 2026",
    isCurrent: true,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    weekLabel: "Week 16",
    dateRange: "Apr 14–20, 2026",
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

  it("ignores a stale ?period= query (retired) and defaults to the current period", () => {
    mockPathname = "/head/report";
    mockSearchParams = new URLSearchParams(
      "period=22222222-2222-2222-2222-222222222222",
    );
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;
    // The legacy `?period=` fallback was removed; with no path-segment id the
    // dropdown defaults to PERIODS[0] (the current period), not the param.
    expect(select.value).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("D-17: renders the period label without embedding current state in the option text", () => {
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText(
      "Select reporting period",
    ) as HTMLSelectElement;

    expect(select.selectedOptions.item(0)?.textContent).toBe(
      "Week 17, Apr 21–27, 2026",
    );
    expect(select.selectedOptions.item(0)?.textContent).not.toContain(
      "(current)",
    );
    expect(screen.getByText("Current")).toBeVisible();
  });
});
