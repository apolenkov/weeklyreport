// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../../test-utils/query-state";

const mockReplace = vi.fn();
let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      latestForViewer: {
        queryOptions: () => ({ queryKey: ["reports.latestForViewer"] }),
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

import ReportsLatestPage from "./page";

const REPORT_ID = "report-abc-123";

afterEach(() => {
  mockReplace.mockReset();
  vi.mocked(useQuery).mockReset();
  searchParamsValue = new URLSearchParams();
});

describe("ReportsLatestPage — redirect / empty / error wiring", () => {
  it("redirects to the resolved report with source=status&recovery=0 and shows resolving copy", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({ data: { reportId: REPORT_ID } }),
    );

    render(<ReportsLatestPage />);

    expect(mockReplace).toHaveBeenCalledWith(
      `/reports/${REPORT_ID}?source=status&recovery=0`,
      { scroll: false },
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the status report/i,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("PROPAGATES an incoming recovery=1 onto the resolved URL (loop guard)", () => {
    searchParamsValue = new URLSearchParams({ recovery: "1" });
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({ data: { reportId: REPORT_ID } }),
    );

    render(<ReportsLatestPage />);

    expect(mockReplace).toHaveBeenCalledWith(
      `/reports/${REPORT_ID}?source=status&recovery=1`,
      { scroll: false },
    );
  });

  it("ignores a repeated recovery marker when resolving the destination", () => {
    searchParamsValue = new URLSearchParams("recovery=1&recovery=0");
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({ data: { reportId: REPORT_ID } }),
    );
    render(<ReportsLatestPage />);
    expect(mockReplace).toHaveBeenCalledWith(
      `/reports/${REPORT_ID}?source=status&recovery=0`,
      { scroll: false },
    );
  });

  it("shows the empty state and does not redirect when no report qualifies", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({ data: { reportId: null } }),
    );

    render(<ReportsLatestPage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      screen.getByText(/there is no report to show yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No status report yet" }),
    ).toBeInTheDocument();
  });

  it("shows the error copy when the query errors", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({ data: undefined, error: new Error("unavailable") }),
    );

    render(<ReportsLatestPage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      screen.getByText(/could not load the status report/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Status report unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("offers a real retry that refetches on the error state", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({
        data: undefined,
        error: new Error("unavailable"),
        refetch,
      }),
    );

    render(<ReportsLatestPage />);

    const retry = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the resolving copy while the query is loading", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({ data: undefined, isLoading: true }),
    );

    render(<ReportsLatestPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the status report/i,
    );
  });
});
