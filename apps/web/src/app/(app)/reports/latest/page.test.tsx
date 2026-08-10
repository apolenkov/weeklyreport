// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.mocked(useQuery).mockReturnValue({
      data: { reportId: REPORT_ID },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(mockReplace).toHaveBeenCalledWith(
      `/reports/${REPORT_ID}?source=status&recovery=0`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the status report/i,
    );
  });

  it("PROPAGATES an incoming recovery=1 onto the resolved URL (loop guard)", () => {
    searchParamsValue = new URLSearchParams({ recovery: "1" });
    vi.mocked(useQuery).mockReturnValue({
      data: { reportId: REPORT_ID },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(mockReplace).toHaveBeenCalledWith(
      `/reports/${REPORT_ID}?source=status&recovery=1`,
    );
  });

  it("shows the empty state and does not redirect when no report qualifies", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { reportId: null },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      screen.getByText(/there is no report to show yet/i),
    ).toBeInTheDocument();
  });

  it("shows the error copy when the query errors", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      screen.getByText(/could not load the status report/i),
    ).toBeInTheDocument();
  });

  it("offers a real retry that refetches on the error state", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    const retry = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the resolving copy while the query is loading", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the status report/i,
    );
  });
});
