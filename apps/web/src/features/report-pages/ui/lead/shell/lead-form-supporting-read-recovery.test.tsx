import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { logClientError } from "../../../../../shared/lib/errors/client-error-reporting";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadForm } from "./lead-form";
import { buildLeadLoadHarness } from "./lead-form-load-test-harness";
import { useLeadFormData } from "./use-lead-form-data";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
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

it("keeps report B's retry pending when report A's earlier retry settles", async () => {
  const reportA = "10000000-0000-4000-8000-000000000001";
  const reportB = "10000000-0000-4000-8000-000000000002";
  const retryA = Promise.withResolvers<unknown>();
  const retryB = Promise.withResolvers<unknown>();
  const attempts = new Map<string, number>();
  const { Wrapper } = buildLeadLoadHarness({
    byPeriodQueryFn: (rawInput) => {
      const { reportId } = z.object({ reportId: z.string() }).parse(rawInput);
      const count = (attempts.get(reportId) ?? 0) + 1;
      attempts.set(reportId, count);
      return count === 1
        ? Promise.reject(new Error("Required read unavailable"))
        : reportId === reportA
          ? retryA.promise
          : retryB.promise;
    },
  });
  const { result, rerender } = renderHook(
    ({ reportId }) => useLeadFormData({ reportId, isSlidesMode: false }),
    { initialProps: { reportId: reportA }, wrapper: Wrapper },
  );
  const retryCurrent = () => {
    const state = result.current.readState;
    if (state.status !== "error")
      throw new Error("Expected a failed required read");
    return state.retry();
  };
  await waitFor(() => expect(result.current.readState.status).toBe("error"));
  act(() => {
    void retryCurrent();
  });
  rerender({ reportId: reportB });
  await waitFor(() =>
    expect(result.current.readState).toMatchObject({
      status: "error",
      isRetrying: false,
    }),
  );
  act(() => {
    void retryCurrent();
  });
  await waitFor(() =>
    expect(result.current.readState).toMatchObject({
      status: "error",
      isRetrying: true,
    }),
  );
  await act(async () => {
    expect(attempts).toEqual(
      new Map([
        [reportA, 2],
        [reportB, 2],
      ]),
    );
    retryA.resolve({
      section: makeReportSectionFixture({ reportId: reportA }),
      readOnly: false,
      canRequestReopen: false,
      publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    });
    await retryA.promise;
  });
  expect(result.current.targetReportId).toBe(reportB);
  expect(result.current.readState).toMatchObject({
    status: "error",
    isRetrying: true,
  });
  await act(async () => {
    retryB.resolve({
      section: makeReportSectionFixture({ reportId: reportB }),
      readOnly: false,
      canRequestReopen: false,
      publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    });
    await retryB.promise;
  });
  await waitFor(() => expect(result.current.readState.status).toBe("ready"));
  expect(result.current.byPeriodData?.section.reportId).toBe(reportB);
  expect(attempts).toEqual(
    new Map([
      [reportA, 2],
      [reportB, 2],
    ]),
  );
});

describe.each(["edit", "slides", "overview"] as const)(
  "Lead %s required reads",
  (mode) => {
    it.each(["active", "history"] as const)(
      "recovers the failed %s query without refetching the other required reads",
      async (source) => {
        const retry = Promise.withResolvers<unknown>();
        let attempts = 0;
        const failThenWait = () =>
          ++attempts === 1
            ? Promise.reject(new Error(`${source} unavailable`))
            : retry.promise;
        const { Wrapper, activeQuery, historyQuery, sectionQuery } =
          buildLeadLoadHarness(
            source === "active"
              ? { activeQueryFn: failThenWait }
              : { historyQueryFn: failThenWait },
          );
        render(<LeadForm mode={mode} />, { wrapper: Wrapper });
        const retryLabel =
          mode === "overview" && source === "history"
            ? "Retry editing"
            : "Retry";
        const button = await screen.findByRole("button", { name: retryLabel });
        expect(
          screen.queryByTestId("lead-form-skeleton"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("No active reporting period is available."),
        ).not.toBeInTheDocument();
        if (mode === "overview" && source === "history") {
          expect(
            screen.getByTestId("lead-status-overview-page"),
          ).toBeInTheDocument();
          expect(
            screen.queryByRole("button", { name: "Submit" }),
          ).not.toBeInTheDocument();
        }
        expect(logClientError).toHaveBeenCalled();
        fireEvent.click(button);
        await waitFor(() => expect(button).toBeDisabled());
        expect(attempts).toBe(2);
        expect(activeQuery).toHaveBeenCalledTimes(source === "active" ? 2 : 1);
        expect(historyQuery).toHaveBeenCalledTimes(
          source === "history" ? 2 : 1,
        );
        expect(sectionQuery).toHaveBeenCalledTimes(source === "active" ? 0 : 1);
        await act(async () => {
          retry.resolve(
            source === "active"
              ? makeReportSectionFixture()
              : { items: [], nextCursor: null },
          );
          await retry.promise;
        });
        if (mode === "overview") {
          await waitFor(() =>
            expect(
              screen.getByRole("button", { name: "Submit" }),
            ).toBeInTheDocument(),
          );
        } else {
          await screen.findByTestId("lead-report-form");
        }
        expect(
          screen.queryByRole("button", { name: retryLabel }),
        ).not.toBeInTheDocument();
        expect(sectionQuery).toHaveBeenCalledTimes(1);
      },
    );

    it.each([false, true])(
      "shows a terminal no-active state with pinned report %s",
      async (pinned) => {
        const { Wrapper, queryClient, sectionQuery, section } =
          buildLeadLoadHarness({
            activeQueryFn: () => null,
          });
        render(
          <LeadForm
            mode={mode}
            {...(pinned ? { reportId: section.reportId } : {})}
          />,
          { wrapper: Wrapper },
        );
        expect(
          await screen.findByText(/^No active reporting period is available\./),
        ).toBeInTheDocument();
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));
        expect(
          screen.queryByTestId("lead-form-skeleton"),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(
          screen.queryByTestId("lead-report-form"),
        ).not.toBeInTheDocument();
        expect(sectionQuery).toHaveBeenCalledTimes(pinned ? 1 : 0);
        if (mode === "overview" && pinned)
          expect(
            screen.getByTestId("lead-status-overview-page"),
          ).toBeInTheDocument();
        expect(logClientError).not.toHaveBeenCalled();
      },
    );
  },
);
