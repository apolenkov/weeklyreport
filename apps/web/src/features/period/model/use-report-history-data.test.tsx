import {
  compiledHistoryResultSchema,
  myHistoryEntrySchema,
  type Role,
} from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import superjson from "superjson";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import ReportsPage from "../../../app/(app)/reports/page";
import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

function historyEntry(index: number) {
  const suffix = String(index).padStart(12, "0");
  return myHistoryEntrySchema.parse({
    sectionId: `00000000-0000-4001-8000-${suffix}`,
    reportId: `00000000-0000-4002-8000-${suffix}`,
    periodStart: new Date("2026-05-11T00:00:00.000Z"),
    periodEnd: new Date("2026-05-17T23:59:59.999Z"),
    reportStatus: "draft",
    sectionStatus: "submitted",
    archived: false,
    submittedAt: new Date("2026-05-15T09:00:00.000Z"),
    publishedAt: null,
    itemCount: 1,
    riskCount: 0,
    decisionCount: 0,
    priorityCount: 0,
    productCount: 1,
    trafficLights: { green: 1, yellow: 0, red: 0 },
  });
}

function compiledResult() {
  const entry = historyEntry(1);
  return compiledHistoryResultSchema.parse({
    entries: [
      {
        reportId: entry.reportId,
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
        publishedAt: new Date("2026-05-18T09:00:00.000Z"),
        archived: false,
        reopened: false,
        publishedByName: "Head",
        trafficLights: entry.trafficLights,
        itemCount: 1,
        riskCount: 0,
        decisionCount: 0,
        priorityCount: 0,
        productCount: 1,
        sectionCount: 1,
      },
    ],
    archiveCount: 0,
  });
}

function response(data: unknown): Response {
  return new Response(
    JSON.stringify([{ result: { data: superjson.serialize(data) } }]),
    {
      headers: { "content-type": "application/json" },
      status: 200,
    },
  );
}

interface HistoryRequest {
  readonly procedure: string;
  readonly input: unknown;
}
const batchInput = z.record(z.string(), z.object({ json: z.unknown() }));

function renderHistory(
  role: Role,
  reply: (request: HistoryRequest, requestNumber: number) => Promise<Response>,
) {
  const requests: HistoryRequest[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const href =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(href, "http://localhost");
    const request = {
      procedure: decodeURIComponent(url.pathname).replace("/trpc/", ""),
      input: batchInput.parse(
        JSON.parse(url.searchParams.get("input") ?? "{}"),
      )["0"]?.json,
    };
    requests.push(request);
    return reply(request, requests.length);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  const proxy = makeTRPCProxy(client);
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "History reader",
              email: "reader@example.test",
              role,
            },
            organization: null,
            isAuthenticated: true,
            isLoading: false,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }
  return { ...render(<ReportsPage />, { wrapper: Wrapper }), requests, client };
}

describe("ReportsPage history recovery", () => {
  it.each(["lead", "head", "viewer"] as const)(
    "recovers a failed initial %s history without claiming an empty result",
    async (role) => {
      const result =
        role === "lead"
          ? { items: [historyEntry(1)], nextCursor: null }
          : compiledResult();
      const { requests } = renderHistory(role, (_request, count) =>
        count === 1
          ? Promise.reject(new Error("History backend unavailable"))
          : Promise.resolve(response(result)),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "History could not be loaded.",
      );
      expect(
        screen.queryByTestId("history-empty-state"),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
      await waitFor(() =>
        expect(screen.getByTestId("history-panel-list")).toBeInTheDocument(),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const procedure =
        role === "lead" ? "reports.myHistory" : "reports.compiledHistory";
      expect(requests.map((request) => request.procedure)).toEqual([
        procedure,
        procedure,
      ]);
      expect(requests[1]?.input).toEqual(
        role === "lead"
          ? { limit: 50, direction: "forward" }
          : { includeArchive: false },
      );
    },
  );

  it("keeps loaded rows after a failed next page and retries only on request", async () => {
    const nextPage = Promise.withResolvers<Response>();
    let allowRetry = false;
    const { requests, rerender } = renderHistory("lead", (_request, count) => {
      if (count === 1)
        return Promise.resolve(
          response({
            items: [historyEntry(1), historyEntry(2)],
            nextCursor: "older",
          }),
        );
      if (count === 2) return nextPage.promise;
      return allowRetry
        ? Promise.resolve(
            response({ items: [historyEntry(3)], nextCursor: null }),
          )
        : new Promise<Response>(() => undefined);
    });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]?.input).toEqual({
      limit: 50,
      cursor: "older",
      direction: "forward",
    });
    rerender(<ReportsPage />);
    expect(requests).toHaveLength(2);
    await act(async () => {
      nextPage.reject(new Error("Older history unavailable"));
      await nextPage.promise.catch(() => undefined);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "loaded reports only",
    );
    expect(
      within(screen.getByTestId("history-panel-list")).getAllByRole("link"),
    ).toHaveLength(2);
    rerender(<ReportsPage />);
    expect(requests).toHaveLength(2);
    allowRetry = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId("history-panel-list")).getAllByRole("link"),
      ).toHaveLength(3),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(requests).toHaveLength(3);
    expect(requests[2]?.input).toEqual({
      limit: 50,
      cursor: "older",
      direction: "forward",
    });
  });

  it("renders a successful empty response as empty history", async () => {
    const { requests } = renderHistory("lead", () =>
      Promise.resolve(response({ items: [], nextCursor: null })),
    );
    expect(await screen.findByTestId("history-empty-state")).toHaveTextContent(
      "No current history yet.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });

  it.each(["lead", "head", "viewer"] as const)(
    "retains loaded %s history after a refetch failure",
    async (role) => {
      const result =
        role === "lead"
          ? { items: [historyEntry(1)], nextCursor: null }
          : compiledResult();
      const { requests, client } = renderHistory(role, (_request, count) =>
        count === 2
          ? Promise.reject(new Error("History refresh unavailable"))
          : Promise.resolve(response(result)),
      );
      await screen.findByTestId("history-panel-list");
      await act(async () => {
        await client.invalidateQueries();
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "loaded reports only",
      );
      expect(
        within(screen.getByTestId("history-panel-list")).getAllByRole("link"),
      ).toHaveLength(1);
      expect(requests).toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
      expect(requests).toHaveLength(3);
      expect(requests[2]).toEqual(requests[0]);
    },
  );

  it.each(["head", "viewer"] as const)(
    "retains %s rows when switching archive scope fails and retries the selected scope",
    async (role) => {
      const archiveRequest = Promise.withResolvers<Response>();
      const { requests, rerender } = renderHistory(role, (_request, count) =>
        count === 2
          ? archiveRequest.promise
          : Promise.resolve(response(compiledResult())),
      );
      await screen.findByTestId("history-panel-list");
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Show archived reports" }),
      );
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(
        within(screen.getByTestId("history-panel-list")).getAllByRole("link"),
      ).toHaveLength(1);
      await act(async () => {
        archiveRequest.reject(new Error("Archive unavailable"));
        await archiveRequest.promise.catch(() => undefined);
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "loaded reports only",
      );
      expect(
        within(screen.getByTestId("history-panel-list")).getAllByRole("link"),
      ).toHaveLength(1);
      rerender(<ReportsPage />);
      expect(requests).toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
      expect(requests).toHaveLength(3);
      expect(requests[1]?.input).toEqual({ includeArchive: true });
      expect(requests[2]).toEqual(requests[1]);
    },
  );
});
