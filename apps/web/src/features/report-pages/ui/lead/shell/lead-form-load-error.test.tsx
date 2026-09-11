// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logClientError } from "../../../../../shared/lib/errors/client-error-reporting";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadForm } from "./lead-form";
import { buildLeadLoadHarness } from "./lead-form-load-test-harness";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock(
  "../../../../../shared/lib/errors/client-error-reporting",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../../shared/lib/errors/client-error-reporting")
    >()),
    logClientError: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LeadForm primary-read recovery", () => {
  it("renders persistent guidance without stale editable controls after failure", async () => {
    const { Wrapper } = buildLeadLoadHarness({
      byPeriodQueryFn: () => Promise.reject(new Error("section unavailable")),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    const alert = await screen.findByRole("alert", {
      name: "Report form could not be loaded",
    });
    expect(
      within(alert).getByText(
        "A temporary problem prevented loading this report form. Try again to continue.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit report" })).toBeNull();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(logClientError).toHaveBeenCalledWith(
      "leadForm.byPeriod.load_failed",
      expect.objectContaining({ message: "section unavailable" }),
      {
        component: "LeadForm",
        procedure: "leadForm.byPeriod",
        reportId: "10000000-0000-4000-8000-000000000001",
        role: "lead",
      },
    );
  });

  it("disables Retry while fetching and restores the form after success", async () => {
    let attempt = 0;
    let resolveRetry!: (value: unknown) => void;
    const retryPromise = new Promise<unknown>((resolve) => {
      resolveRetry = resolve;
    });
    const { Wrapper } = buildLeadLoadHarness({
      byPeriodQueryFn: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new Error("section unavailable"))
          : retryPromise;
      },
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    const alert = await screen.findByRole("alert", {
      name: "Report form could not be loaded",
    });
    const retryButton = within(alert).getByRole("button", { name: "Retry" });
    act(() => retryButton.click());
    await waitFor(() => expect(retryButton).toBeDisabled());
    expect(attempt).toBe(2);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();

    resolveRetry({
      section: makeReportSectionFixture(),
      readOnly: false,
      canRequestReopen: false,
      publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    });
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(logClientError).toHaveBeenCalledTimes(1);
  });

  it("keeps Retry available when the next read fails", async () => {
    let attempt = 0;
    const { Wrapper } = buildLeadLoadHarness({
      byPeriodQueryFn: () => {
        attempt += 1;
        return Promise.reject(new Error("section unavailable"));
      },
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    const alert = await screen.findByRole("alert", {
      name: "Report form could not be loaded",
    });
    const retryButton = within(alert).getByRole("button", { name: "Retry" });
    act(() => retryButton.click());
    await waitFor(() => expect(attempt).toBe(2));
    expect(
      screen.getByRole("alert", { name: "Report form could not be loaded" }),
    ).toBeInTheDocument();
    expect(retryButton).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(logClientError).toHaveBeenCalledTimes(2);
  });

  it("hides cached editable controls when a primary refetch fails", async () => {
    let shouldFail = false;
    const { Wrapper, queryClient } = buildLeadLoadHarness({
      byPeriodQueryFn: () =>
        shouldFail
          ? Promise.reject(new Error("section unavailable"))
          : {
              section: makeReportSectionFixture(),
              readOnly: false,
              canRequestReopen: false,
              publishedLineage: { itemStableIds: [], decisionStableIds: [] },
            },
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();

    shouldFail = true;
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: [["leadForm", "byPeriod"]],
      });
    });
    await screen.findByRole("alert", {
      name: "Report form could not be loaded",
    });
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(logClientError).toHaveBeenCalledTimes(1);
  });
});
