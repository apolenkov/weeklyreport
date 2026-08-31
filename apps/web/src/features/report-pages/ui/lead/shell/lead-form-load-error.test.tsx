// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

function buildHarness(opts: { byPeriodQueryFn?: () => unknown } = {}) {
  const section = makeReportSectionFixture();
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: section.reportId,
        reportSectionId: section.reportSectionId,
        authorName: section.authorName,
        authorRole: section.authorRole,
      },
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      query:
        opts.byPeriodQueryFn ??
        (() => ({
          section,
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        })),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, queryClient, section };
}

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LeadForm primary-read recovery", () => {
  it("renders persistent guidance without stale editable controls after failure", async () => {
    const { Wrapper } = buildHarness({
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
  });

  it("disables Retry while fetching and restores the form after success", async () => {
    let attempt = 0;
    let resolveRetry!: (value: unknown) => void;
    const retryPromise = new Promise<unknown>((resolve) => {
      resolveRetry = resolve;
    });
    const { Wrapper } = buildHarness({
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
  });

  it("keeps Retry available when the next read fails", async () => {
    let attempt = 0;
    const { Wrapper } = buildHarness({
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
  });

  it("hides cached editable controls when a primary refetch fails", async () => {
    let shouldFail = false;
    const { Wrapper, queryClient } = buildHarness({
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
  });
});
