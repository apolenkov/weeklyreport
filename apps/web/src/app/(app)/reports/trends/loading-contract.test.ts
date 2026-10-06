import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import TrendsPage from "./page";

const comparisonQueryOptions = vi.hoisted(() => vi.fn());

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
        queryOptions: (input: unknown) => {
          comparisonQueryOptions(input);
          return {
            queryKey: ["comparison"],
            queryFn: () => new Promise(() => undefined),
          };
        },
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
      screen.getAllByRole("status", { name: "Loading data" }),
    ).toHaveLength(3);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lead submissions" }),
    ).toBeVisible();
    client.clear();
  });

  it("renders ready tables directly while a sibling query stays pending", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["history"], {
      periods: [
        { periodStart: "2026-08-17", periodEnd: "2026-08-23" },
        { periodStart: "2026-08-24", periodEnd: "2026-08-30" },
      ],
      rows: [
        {
          projectId: "alpha",
          projectName: "Alpha",
          statuses: ["green", "red"],
        },
      ],
    });
    client.setQueryData(["comparison"], {
      periodA: { periodStart: "2026-08-01", periodEnd: "2026-08-23" },
      periodB: { periodStart: "2026-08-20", periodEnd: "2026-08-30" },
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
    expect(comparisonQueryOptions).toHaveBeenLastCalledWith({
      periodA: "2026-08-23",
      periodB: "2026-08-30",
    });
    expect(
      screen.getByText(
        "Latest period Aug 20–30, 2026 compared with previous period Aug 1–23, 2026. Risk change is latest minus previous.",
      ),
    ).toBeVisible();
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
        name: "Period comparison data",
      }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("status", { name: "Loading data" }),
    ).toHaveLength(1);
    client.clear();
  });

  it("shows ready Lead submissions from the leadVelocity query while history stays pending", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(
      ["velocity"],
      [
        {
          periodStart: "2026-08-24",
          periodEnd: "2026-08-30",
          leads: [
            { leadId: "lead-a", leadName: "Alex", submittedSections: 3 },
            { leadId: "lead-b", leadName: "Blair", submittedSections: 0 },
          ],
        },
      ],
    );
    renderPage(client);
    const table = screen.getByRole("table", { name: "Lead submissions" });
    expect(
      within(table).getByRole("cell", { name: "Submitted" }),
    ).toBeVisible();
    expect(within(table).getByRole("cell", { name: "Missing" })).toBeVisible();
    const submissionsSection = expectDefined(table.closest("section"));
    expect(
      within(submissionsSection).getByRole("region", {
        name: "Lead submissions",
      }),
    ).toHaveAttribute("aria-labelledby", "trends-submissions-heading");
    expect(
      screen.getAllByRole("status", { name: "Loading data" }),
    ).toHaveLength(2);
    client.clear();
  });
});
