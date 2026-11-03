import {
  toastError,
  toastSuccess,
} from "./weekly-report-page.review-archive.test-support";
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]): void => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]): void => {
      toastError(...args);
    },
    info: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage — Archive / Restore wiring — 10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const ARCHIVE_BUTTON = /move this report to the archive/i;
  const RESTORE_BUTTON = /restore this report from the archive/i;
  it("offers Archive, not Restore, on a published report still out of the archive", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("published"));

    expect(
      await screen.findByRole("button", { name: ARCHIVE_BUTTON }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: RESTORE_BUTTON }),
    ).not.toBeInTheDocument();
  });
});
describe("WeeklyReportPage — Archive / Restore wiring — 11", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const ARCHIVE_BUTTON = /move this report to the archive/i;
  const RESTORE_BUTTON = /restore this report from the archive/i;
  it("offers neither control while the period is still open", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("open"));

    await screen.findByRole("button", { name: /publish & lock/i });
    expect(
      screen.queryByRole("button", { name: ARCHIVE_BUTTON }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: RESTORE_BUTTON }),
    ).not.toBeInTheDocument();
  });
});
