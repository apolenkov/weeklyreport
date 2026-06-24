/**
 * @vitest-environment jsdom
 *
 * viewer-report-surface-parity (review P3): `/reports/latest` ships with no
 * coverage of its three runtime branches — the resolve→replace redirect, the
 * empty state, and the error state. This suite pins each: a resolved reportId
 * triggers `router.replace(/reports/<id>)` and keeps the resolving copy; a null
 * result shows the empty-state copy; an errored query shows the error copy.
 */

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
}));

vi.mock("../../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      latestPublished: {
        queryOptions: () => ({ queryKey: ["reports.latestPublished"] }),
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
});

describe("ReportsLatestPage — redirect / empty / error wiring", () => {
  it("redirects to the resolved report and shows the resolving copy", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { reportId: REPORT_ID },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(mockReplace).toHaveBeenCalledWith(`/reports/${REPORT_ID}`);
    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the latest report/i,
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
      screen.getByText(/no published report is available to you yet/i),
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
      screen.getByText(/could not load the latest report/i),
    ).toBeInTheDocument();
  });

  it("shows the resolving copy while the query is loading", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useQuery>);

    render(<ReportsLatestPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /opening the latest report/i,
    );
  });
});
