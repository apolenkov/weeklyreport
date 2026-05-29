/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock react-query's useQuery so we can drive the tab content state
// without spinning up a real QueryClient.
const useQueryMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    ai: {
      periodSummary: {
        queryOptions: () => ({ queryKey: ["ai.periodSummary"] }),
      },
    },
  }),
}));

import { PeriodSummaryTabs } from "./period-summary-tabs";

const PERIOD_ID = "00000000-0000-4000-8000-000000000001";

function Children() {
  return <div data-testid="report-tab-body">report-body</div>;
}

describe("PeriodSummaryTabs (Phase 54 / UFB-055)", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("renders the Report tab body by default and exposes both tab triggers", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: false });

    render(
      <PeriodSummaryTabs periodId={PERIOD_ID}>
        <Children />
      </PeriodSummaryTabs>,
    );

    expect(screen.getByTestId("report-tab-body")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /report/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /ai summary/i }),
    ).toBeInTheDocument();
  });

  it("renders the mock summary with (заглушка) badge when AI Summary tab is selected", async () => {
    useQueryMock.mockReturnValue({
      data: {
        summary: "[mock-summary] 3 sections, period p",
        source: "mock",
        citationIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(
      <PeriodSummaryTabs periodId={PERIOD_ID}>
        <Children />
      </PeriodSummaryTabs>,
    );

    await userEvent.click(screen.getByRole("tab", { name: /ai summary/i }));

    expect(screen.getByTestId("ai-summary-text")).toHaveTextContent(
      /mock-summary/,
    );
    expect(screen.getByText(/\(заглушка\)/i)).toBeInTheDocument();
    expect(screen.getByText(/цитаты по 2 секциям/i)).toBeInTheDocument();
  });

  it("renders the empty-state copy when summary is blank", async () => {
    useQueryMock.mockReturnValue({
      data: {
        summary: "",
        source: "mock",
        citationIds: [],
      },
      isLoading: false,
      isError: false,
    });

    render(
      <PeriodSummaryTabs periodId={PERIOD_ID}>
        <Children />
      </PeriodSummaryTabs>,
    );

    await userEvent.click(screen.getByRole("tab", { name: /ai summary/i }));

    expect(screen.getByText(/нет опубликованных секций/i)).toBeInTheDocument();
    // Stub badge still rendered so users see the surface is mocked.
    expect(screen.getByText(/\(заглушка\)/i)).toBeInTheDocument();
  });

  it("renders the loading state while the query is in-flight", async () => {
    useQueryMock.mockReturnValue({ isLoading: true, data: undefined });

    render(
      <PeriodSummaryTabs periodId={PERIOD_ID}>
        <Children />
      </PeriodSummaryTabs>,
    );

    await userEvent.click(screen.getByRole("tab", { name: /ai summary/i }));

    expect(screen.getByText(/загружаем ai summary/i)).toBeInTheDocument();
  });

  it("renders the error state when the query errors out", async () => {
    useQueryMock.mockReturnValue({
      isError: true,
      isLoading: false,
      data: undefined,
    });

    render(
      <PeriodSummaryTabs periodId={PERIOD_ID}>
        <Children />
      </PeriodSummaryTabs>,
    );

    await userEvent.click(screen.getByRole("tab", { name: /ai summary/i }));

    expect(screen.getByText(/недоступен/i)).toBeInTheDocument();
  });

  it("does NOT render the (заглушка) badge when source is ai (future provider)", async () => {
    useQueryMock.mockReturnValue({
      data: {
        summary: "Real LLM prose",
        source: "ai",
        citationIds: [],
      },
      isLoading: false,
      isError: false,
    });

    render(
      <PeriodSummaryTabs periodId={PERIOD_ID}>
        <Children />
      </PeriodSummaryTabs>,
    );

    await userEvent.click(screen.getByRole("tab", { name: /ai summary/i }));

    expect(screen.queryByText(/\(заглушка\)/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-summary-text")).toHaveTextContent(
      /Real LLM prose/,
    );
  });
});
