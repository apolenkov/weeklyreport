import "@testing-library/jest-dom/vitest";

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
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

import { invalidatePeriodLifecycle } from "../../../../shared/lib/query/cache-keys";
import { expectDefined } from "../../../../test-utils/expect-defined.js";
import {
  makeWeeklyReportData,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

const confirmDialog = async (name: RegExp): Promise<void> => {
  const dialog = await screen.findByRole("alertdialog", { name });
  const buttons = dialog.querySelectorAll("button");
  await userEvent.click(expectDefined(buttons[buttons.length - 1]));
};

describe("WeeklyReportPage publish and reopen mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("fires publish with reportId from view.period", async () => {
    const { captured } = renderWeeklyReportPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await screen.findByRole("button", { name: /publish & lock/i });
    await userEvent.click(
      screen.getByRole("button", { name: /publish & lock/i }),
    );
    await confirmDialog(/publish & lock report/i);

    const publishMutation = expectDefined(captured["period.publish"]);
    await waitFor(() => {
      expect(publishMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(publishMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("disables publish and hides Toggle All for an empty weekly report", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });
    const publishButton = await screen.findByRole("button", {
      name: /nothing to publish/i,
    });

    expect(publishButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /toggle all/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(publishButton);
    expect(
      screen.queryByRole("dialog", { name: /confirm publish/i }),
    ).not.toBeInTheDocument();
    expect(
      expectDefined(captured["period.publish"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("invalidates caches and shows a success toast after publish", async () => {
    const { captured } = renderWeeklyReportPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /publish & lock/i }),
    );
    await confirmDialog(/publish & lock report/i);

    await waitFor(() => {
      expect(invalidatePeriodLifecycle).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("shows a toast on publish error without invalidating", async () => {
    const { captured } = renderWeeklyReportPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockRejectedValue(
      new Error("Forbidden"),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /publish & lock/i }),
    );
    await confirmDialog(/publish & lock report/i);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Forbidden");
    });
    expect(invalidatePeriodLifecycle).not.toHaveBeenCalled();
  });

  it("maps publish transport errors to the failed action", async () => {
    const { captured } = renderWeeklyReportPage(makeWeeklyReportData("open"));
    expectDefined(captured["period.publish"]).mutationFn.mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /publish & lock/i }),
    );
    await confirmDialog(/publish & lock report/i);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to publish period");
    });
  });

  it("fires reopen with reportId when the period is published", async () => {
    const { captured } = renderWeeklyReportPage(
      makeWeeklyReportData("published"),
    );
    expectDefined(captured["period.reopen"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /reopen period/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^reopen$/i }),
    );

    const reopenMutation = expectDefined(captured["period.reopen"]);
    await waitFor(() => {
      expect(reopenMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(reopenMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("invalidates report projections after reopen success", async () => {
    const { captured } = renderWeeklyReportPage(
      makeWeeklyReportData("published"),
    );
    expectDefined(captured["period.reopen"]).mutationFn.mockResolvedValue(
      undefined,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /reopen period/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^reopen$/i }),
    );

    await waitFor(() => {
      expect(invalidatePeriodLifecycle).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalled();
    });
  });
});
