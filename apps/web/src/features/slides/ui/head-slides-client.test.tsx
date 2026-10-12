// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ActivityLiveResponse } from "@weeklyreport/shared";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as clientErrors from "../../../shared/lib/errors/client-error-reporting";
import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";
import { HeadSlidesClient } from "./head-slides-client";

const logClientError = vi.fn();
const toastError = vi.fn(() => "test-toast");

beforeEach(() => {
  vi.spyOn(clientErrors, "logClientError").mockImplementation(logClientError);
  vi.spyOn(toast, "error").mockImplementation(toastError);
});

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_REPORT_ID = "10000000-0000-4000-8000-000000000002";

function report(populated = false) {
  return {
    status: "active" as const,
    ...makeWeeklyReportFixture({
      reportId: REPORT_ID,
      leadSections: populated
        ? [
            { reportSectionId: "section-a", authorName: "Owner A" },
            { reportSectionId: "section-b", authorName: "Owner B" },
          ]
        : [],
    }),
  };
}

function activity(reportId = REPORT_ID): ActivityLiveResponse {
  return {
    reportId,
    periodStart: new Date("2026-08-31"),
    periodEnd: new Date("2026-09-06"),
    periodStatus: "open",
    rows: [
      {
        reportId,
        reportSectionId: null,
        leadId: "lead-1",
        leadName: "Activity",
        email: null,
        status: "draft",
        itemCount: 0,
        riskCount: 0,
        decisionCount: 0,
        priorityCount: 0,
        lastEditAt: null,
        submittedAt: null,
      },
    ],
  };
}

function setup({
  weekly = () => report(),
  live = () => activity(),
  props = {},
  cachedActivity,
}: {
  readonly weekly?: ((input: unknown) => unknown) | undefined;
  readonly live?: (() => unknown) | undefined;
  readonly props?: ComponentProps<typeof HeadSlidesClient> | undefined;
  readonly cachedActivity?: ActivityLiveResponse | undefined;
} = {}) {
  const liveRequest = vi.fn(live);
  const { proxy } = createMockTRPC([
    { path: ["weeklyReport", "get"], queryByInput: weekly },
    { path: ["activity", "live"], query: liveRequest },
  ]);
  const client = makeQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  if (cachedActivity)
    client.setQueryData(proxy.activity.live.queryKey(), cachedActivity);
  const view = (nextProps = props) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        <HeadSlidesClient reportId={REPORT_ID} {...nextProps} />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  const rendered = render(view());
  return {
    client,
    proxy,
    liveRequest,
    rerender: (nextProps: ComponentProps<typeof HeadSlidesClient>) =>
      rendered.rerender(view(nextProps)),
  };
}

describe("HeadSlidesClient with real query and deck boundaries", () => {
  it("does not request activity when the viewer disables it", async () => {
    const { liveRequest } = setup({ props: { enableActivity: false } });
    await screen.findByText("No slides available");
    expect(liveRequest).not.toHaveBeenCalled();
    expect(logClientError).not.toHaveBeenCalled();
  });

  it("does not expose cached activity rows to a host that disables activity", async () => {
    setup({ props: { enableActivity: false }, cachedActivity: activity() });
    await screen.findByText("No slides available");
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  it("loads matching activity into the head deck", async () => {
    const { liveRequest } = setup();
    await screen.findByTestId("head-slide-card-0");
    expect(liveRequest).toHaveBeenCalledOnce();
    expect(screen.getByTestId("head-slide-card-0")).toHaveTextContent(
      "Activity",
    );
  });

  it("does not expose a density control on head decks", async () => {
    setup({ weekly: () => report(true) });
    await screen.findByTestId("head-slide-card-0");
    expect(
      screen.queryByRole("group", { name: "Slide density" }),
    ).not.toBeInTheDocument();
  });

  it("keeps populated report slides visible during an unrelated activity read", async () => {
    const pending = Promise.withResolvers<ActivityLiveResponse>();
    const { client, proxy } = setup({
      weekly: () => report(true),
      live: () => pending.promise,
    });
    await screen.findByTestId("head-slide-card-0");
    const fetching = client.query(proxy.activity.live.queryOptions());
    await waitFor(() => expect(client.isFetching()).toBe(1));
    expect(screen.getByTestId("head-slide-card-0")).toHaveTextContent(
      "Owner A",
    );
    expect(screen.queryByTestId("slide-skeleton")).not.toBeInTheDocument();
    await act(async () => {
      pending.resolve(activity());
      await fetching;
    });
  });

  it("keeps populated report slides visible when an unrelated activity read fails", async () => {
    const { client, proxy } = setup({
      weekly: () => report(true),
      live: () => Promise.reject(new Error("Activity unavailable")),
    });
    await screen.findByTestId("head-slide-card-0");
    await act(async () => {
      await client
        .query(proxy.activity.live.queryOptions())
        .catch(() => undefined);
    });
    expect(screen.getByTestId("head-slide-card-0")).toHaveTextContent(
      "Owner A",
    );
    expect(screen.queryByText("Slides could not load")).not.toBeInTheDocument();
    expect(logClientError).not.toHaveBeenCalled();
  });

  it("shows the skeleton while an empty report waits for activity", async () => {
    const pending = Promise.withResolvers<ActivityLiveResponse>();
    const { liveRequest } = setup({ live: () => pending.promise });
    await waitFor(() => expect(liveRequest).toHaveBeenCalledOnce());
    expect(screen.getByTestId("slide-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("No slides available")).not.toBeInTheDocument();
    await act(async () => {
      pending.resolve(activity());
      await pending.promise;
    });
    await screen.findByTestId("head-slide-card-0");
  });

  it("shows the error state after an empty report activity read fails", async () => {
    setup({ live: () => Promise.reject(new Error("Activity unavailable")) });
    await screen.findByText("Slides could not load");
    expect(screen.queryByTestId("slide-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByTestId("head-slides-deck")).not.toBeInTheDocument();
  });

  it("replaces report A with a pending skeleton when requesting report B", async () => {
    const pending = Promise.withResolvers<ReturnType<typeof report>>();
    const { rerender } = setup({
      weekly: (input) =>
        (input as { reportId: string }).reportId === OTHER_REPORT_ID
          ? pending.promise
          : report(true),
    });
    await screen.findByTestId("head-slide-card-0");
    rerender({ reportId: OTHER_REPORT_ID });
    await screen.findByTestId("slide-skeleton");
    expect(screen.queryByText("Owner A")).not.toBeInTheDocument();
    await act(async () => {
      pending.resolve({ ...report(true), reportId: OTHER_REPORT_ID });
      await pending.promise;
    });
    await screen.findByTestId("head-slide-card-0");
  });

  it("excludes foreign cached activity during refetch and renders matching activity after it resolves", async () => {
    const pending = Promise.withResolvers<ActivityLiveResponse>();
    const foreign = activity(OTHER_REPORT_ID);
    const cached = {
      ...foreign,
      rows: foreign.rows.map((row) => ({
        ...row,
        leadName: "Foreign",
      })),
    };
    const { client, proxy, liveRequest } = setup({
      cachedActivity: cached,
      live: () => pending.promise,
    });
    await screen.findByText("No slides available");
    const fetching = client.refetchQueries(proxy.activity.live.pathFilter());
    await waitFor(() => expect(liveRequest).toHaveBeenCalledOnce());
    expect(client.isFetching(proxy.activity.live.pathFilter())).toBe(1);
    expect(screen.queryByText("Foreign")).not.toBeInTheDocument();
    await act(async () => {
      pending.resolve(activity());
      await fetching;
    });
    await screen.findByTestId("head-slide-card-0");
    expect(screen.getByTestId("head-slide-card-0")).toHaveTextContent(
      "Activity",
    );
  });

  it("keeps one valid selected card through a shrinking and growing report refetch", async () => {
    let weekly = report(true);
    const { client, proxy } = setup({ weekly: () => weekly });
    await screen.findByTestId("head-slide-card-1");
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByTestId("head-slide-card-1")).toHaveAttribute(
      "aria-current",
      "true",
    );
    weekly = { ...weekly, leadSections: weekly.leadSections.slice(0, 1) };
    await act(async () => {
      await client.refetchQueries(proxy.weeklyReport.get.pathFilter());
    });
    await waitFor(() =>
      expect(screen.getAllByTestId(/head-slide-card-/)).toHaveLength(1),
    );
    expect(screen.getByTestId("head-slide-card-0")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.queryByText("No slides available")).not.toBeInTheDocument();
    weekly = report(true);
    await act(async () => {
      await client.refetchQueries(proxy.weeklyReport.get.pathFilter());
    });
    await waitFor(() =>
      expect(screen.getAllByTestId(/head-slide-card-/)).toHaveLength(2),
    );
    const cards = screen.getAllByTestId(/head-slide-card-/);
    expect(
      cards.filter((card) => card.getAttribute("aria-current") === "true"),
    ).toHaveLength(1);
    expect(screen.queryByText("No slides available")).not.toBeInTheDocument();
  });
});

describe("HeadSlidesClient query error policy", () => {
  it("logs an active activity failure once, remains log-only, and logs again after recovery", async () => {
    const first = new Error("Activity unavailable");
    const second = new Error("Activity unavailable again");
    const deferred = Promise.withResolvers<ActivityLiveResponse>();
    let response: ActivityLiveResponse | Error | Promise<ActivityLiveResponse> =
      deferred.promise;
    const { client, proxy, rerender } = setup({
      live: () =>
        response instanceof Error ? Promise.reject(response) : response,
    });
    await waitFor(() =>
      expect(client.isFetching(proxy.activity.live.pathFilter())).toBe(1),
    );
    expect(screen.getByTestId("slide-skeleton")).toBeInTheDocument();
    expect(logClientError).not.toHaveBeenCalled();
    await act(async () => {
      deferred.reject(first);
      await deferred.promise.catch(() => undefined);
    });
    await screen.findByText("Slides could not load");
    expect(logClientError).toHaveBeenCalledExactlyOnceWith(
      "headSlides.activity.load_failed",
      first,
      {
        component: "HeadSlidesClient",
        procedure: "activity.live",
      },
    );
    rerender({ scope: "product" });
    expect(logClientError).toHaveBeenCalledOnce();
    expect(toastError).not.toHaveBeenCalled();
    response = activity();
    await act(async () => {
      await client.refetchQueries(proxy.activity.live.pathFilter());
    });
    await screen.findByTestId("head-slide-card-0");
    response = second;
    await act(async () => {
      await client.refetchQueries(proxy.activity.live.pathFilter());
    });
    await screen.findByText("Slides could not load");
    expect(logClientError).toHaveBeenCalledTimes(2);
    expect(logClientError).toHaveBeenLastCalledWith(
      "headSlides.activity.load_failed",
      second,
      {
        component: "HeadSlidesClient",
        procedure: "activity.live",
      },
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it("keeps weekly failures on the existing weekly event only", async () => {
    const error = new Error("Weekly unavailable");
    const { liveRequest } = setup({ weekly: () => Promise.reject(error) });
    await screen.findByText("Slides could not load");
    expect(logClientError).toHaveBeenCalledExactlyOnceWith(
      "headSlides.weeklyReport.load_failed",
      error,
      {
        component: "HeadSlidesClient",
        procedure: "weeklyReport.get",
      },
    );
    expect(liveRequest).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "viewer",
      props: { enableActivity: false },
      weekly: () => report(),
    },
    {
      label: "published",
      props: {},
      weekly: () => ({ ...report(), periodStatus: "published" as const }),
    },
    {
      label: "archived",
      props: {},
      weekly: () => ({ ...report(), archived: true }),
    },
    {
      label: "no period",
      props: {},
      weekly: () => ({ status: "no-period" as const }),
    },
  ])(
    "does not report cached activity failures on the inactive $label surface",
    async ({ props, weekly }) => {
      const { client, proxy } = setup({
        props,
        weekly,
        live: () => Promise.reject(new Error("Cached activity error")),
      });
      await waitFor(() => expect(client.isFetching()).toBe(0));
      await act(async () => {
        await client
          .query(proxy.activity.live.queryOptions())
          .catch(() => undefined);
      });
      expect(logClientError).not.toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
    },
  );
});
