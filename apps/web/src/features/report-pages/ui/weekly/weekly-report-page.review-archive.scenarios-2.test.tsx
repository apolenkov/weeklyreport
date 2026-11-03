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
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidatePeriodLifecycle } from "../../../../shared/lib/query/cache-keys";
import { expectDefined } from "../../../../test-utils/expect-defined.js";
import {
  makeWeeklyReportData,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import {
  toastError,
  toastSuccess,
} from "./weekly-report-page.review-archive.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage — Archive / Restore wiring — 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const ARCHIVE_BUTTON = /move this report to the archive/i;
  const RESTORE_BUTTON = /restore this report from the archive/i;
  it("swaps Archive for Restore once the report is archived", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });

    expect(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    ).toBeInTheDocument();
    // Archiving leaves periodStatus published, so the Archive button would
    // still match its old gate — offering it again could only fail.
    expect(
      screen.queryByRole("button", { name: ARCHIVE_BUTTON }),
    ).not.toBeInTheDocument();
  });
});
describe("WeeklyReportPage — Archive / Restore wiring — 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const RESTORE_BUTTON = /restore this report from the archive/i;
  it("clicking Restore fires archive.unarchiveReport with the report id", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockResolvedValue({ success: true });

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    const restoreMutation = expectDefined(captured["archive.unarchiveReport"]);
    await waitFor(() => {
      expect(restoreMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(restoreMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });
});
describe("WeeklyReportPage — Archive / Restore wiring — 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const RESTORE_BUTTON = /restore this report from the archive/i;
  it("restore busts the same caches archive does and confirms with a toast", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockResolvedValue({ success: true });

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    await waitFor(() => {
      expect(invalidatePeriodLifecycle).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Report restored");
    // Restore only moves the report between lists; it changes no section data.
  });
});
describe("WeeklyReportPage — Archive / Restore wiring — 4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const RESTORE_BUTTON = /restore this report from the archive/i;
  it("surfaces a failed restore as an error toast", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockRejectedValue(new TRPCClientError("Report not found"));

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Report not found");
    });
    expect(invalidatePeriodLifecycle).not.toHaveBeenCalled();
  });
});
describe("WeeklyReportPage — Archive / Restore wiring — 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const ARCHIVE_BUTTON = /move this report to the archive/i;
  it("locks Reopen while an archive write is in flight", async () => {
    const { captured } = renderWeeklyReportPage(
      makeWeeklyReportData("published"),
    );
    // A never-settling mutation keeps the page in the lifecycle-pending state.
    expectDefined(captured["archive.archiveReport"]).mutationFn.mockReturnValue(
      new Promise<never>(() => undefined),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: ARCHIVE_BUTTON }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /reopen period/i }),
      ).toBeDisabled();
    });
    // The archive control itself keeps its progress state under the same guard.
    expect(screen.getByRole("button", { name: ARCHIVE_BUTTON })).toBeDisabled();
  });
});
