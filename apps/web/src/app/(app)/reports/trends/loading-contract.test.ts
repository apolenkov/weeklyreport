import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import TrendsPage from "./page";

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    analytics: {
      trafficLightHistory: {
        queryOptions: () => ({
          queryKey: ["history"],
          queryFn: () => new Promise(() => undefined),
        }),
      },
      leadVelocity: {
        queryOptions: () => ({
          queryKey: ["velocity"],
          queryFn: () => new Promise(() => undefined),
        }),
      },
      periodComparison: {
        queryOptions: () => ({
          queryKey: ["comparison"],
          queryFn: () => new Promise(() => undefined),
        }),
      },
    },
  }),
}));

function renderPage(client: QueryClient) {
  render(
    createElement(QueryClientProvider, { client }, createElement(TrendsPage)),
  );
}

describe("Trends query loading", () => {
  it("renders local skeletons for pending queries", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderPage(client);
    expect(
      screen.getAllByRole("status", { name: "Loading chart" }),
    ).toHaveLength(3);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    client.clear();
  });

  it("renders ready tables directly while a sibling query stays pending", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["history"], {
      periods: ["2026-08-23", "2026-08-30"],
      rows: [
        {
          projectId: "alpha",
          projectName: "Alpha",
          statuses: ["green", "red"],
        },
      ],
    });
    client.setQueryData(["comparison"], {
      rows: [
        {
          projectId: "alpha",
          projectName: "Alpha",
          statusA: "green",
          statusB: "red",
          riskCountA: 0,
          riskCountB: 1,
          riskDelta: 1,
        },
      ],
    });
    renderPage(client);
    expect(
      screen.getByRole("table", { name: "Traffic-light history data" }),
    ).toBeVisible();
    const historySection = screen
      .getByRole("heading", { name: "Traffic-light history" })
      .closest("section");
    expect(
      within(expectDefined(historySection)).getByRole("region", {
        name: "Traffic-light history",
      }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("table", {
        name: /Periods ending 2026-08-23 .* 2026-08-30/,
      }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("status", { name: "Loading chart" }),
    ).toHaveLength(1);
    client.clear();
  });
});
