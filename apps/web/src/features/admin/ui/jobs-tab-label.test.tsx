import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown): unknown => useQueryMock(opts) as unknown,
}));
vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      dlqCount: {
        queryOptions: () => ({ queryKey: ["admin", "dlqCount"] }),
      },
      pendingReopenCount: {
        queryOptions: (_input: unknown, opts: Record<string, unknown>) => ({
          queryKey: ["admin", "pendingReopenCount"],
          ...opts,
        }),
      },
    },
  }),
}));

import { ReopenTabLabel } from "../../review";
import { JobsTabLabel } from "./jobs-tab-label";

describe("admin tab alert labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no visible badge while reopen count is loading", () => {
    useQueryMock.mockReturnValue({ data: undefined });

    render(<ReopenTabLabel />);

    expect(screen.getByText("reopen")).toBeInTheDocument();
    expect(screen.queryByTestId("reopen-tab-count")).not.toBeInTheDocument();
  });

  it("renders no visible badge when reopen count is zero", () => {
    useQueryMock.mockReturnValue({ data: { count: 0 } });

    render(<ReopenTabLabel />);

    expect(screen.getByText("reopen")).toBeInTheDocument();
    expect(screen.queryByTestId("reopen-tab-count")).not.toBeInTheDocument();
  });

  it("renders pending reopen count as an overlay badge", () => {
    useQueryMock.mockReturnValue({ data: { count: 3 } });

    render(<ReopenTabLabel />);

    const count = screen.getByTestId("reopen-tab-count");
    expect(count).toHaveTextContent("3");
    expect(count).toHaveClass("absolute", "-right-3", "-top-2");
    expect(count).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("3 pending reopen requests")).toHaveClass(
      "sr-only",
    );
  });

  it("renders DLQ count on the Jobs tab and keeps polling", () => {
    useQueryMock.mockReturnValue({ data: { count: 2 } });

    render(<JobsTabLabel />);

    const count = screen.getByTestId("jobs-tab-count");
    expect(screen.getByText("jobs")).toBeInTheDocument();
    expect(count).toHaveTextContent("2");
    expect(count).toHaveClass("absolute", "-right-3", "-top-2");
    expect(count).toHaveClass(
      "bg-[var(--color-destructive)]",
      "text-[var(--color-destructive-foreground)]",
    );
    expect(screen.getByText("2 failed jobs in DLQ")).toHaveClass("sr-only");

    const callArg = useQueryMock.mock.calls.at(-1)?.[0] as {
      refetchInterval?: number;
    };
    expect(callArg.refetchInterval).toBe(30_000);
  });

  it("caps large tab counts without growing the tab", () => {
    useQueryMock.mockReturnValue({ data: { count: 142 } });

    render(<JobsTabLabel />);

    const count = screen.getByTestId("jobs-tab-count");
    expect(count).toHaveTextContent("99+");
    expect(count).toHaveClass("absolute");
    expect(screen.getByText("142 failed jobs in DLQ")).toHaveClass("sr-only");
  });
});
