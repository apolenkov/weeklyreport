import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the trpc-context so we can drive the dlqCount query with a stub.
const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown) => useQueryMock(opts),
}));
vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      dlqCount: {
        queryOptions: () => ({ queryKey: ["admin", "dlqCount"] }),
      },
    },
  }),
}));

import { DlqBadge } from "./dlq-badge";

describe("DlqBadge — NOTIF-06 (Phase 29-05)", () => {
  it("renders nothing when count === 0", () => {
    useQueryMock.mockReturnValue({ data: { count: 0 } });
    const { container } = render(<DlqBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is loading (data === undefined)", () => {
    useQueryMock.mockReturnValue({ data: undefined });
    const { container } = render(<DlqBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "DLQ: N" badge when count > 0', () => {
    useQueryMock.mockReturnValue({ data: { count: 3 } });
    render(<DlqBadge />);
    expect(screen.getByText(/DLQ: 3/)).toBeInTheDocument();
  });

  it("large counts render verbatim", () => {
    useQueryMock.mockReturnValue({ data: { count: 142 } });
    render(<DlqBadge />);
    expect(screen.getByText(/DLQ: 142/)).toBeInTheDocument();
  });

  it("passes refetchInterval=30_000 to useQuery (polls the DLQ surface)", () => {
    useQueryMock.mockReturnValue({ data: { count: 0 } });
    render(<DlqBadge />);
    const callArg = useQueryMock.mock.calls[
      useQueryMock.mock.calls.length - 1
    ]?.[0] as {
      refetchInterval?: number;
    };
    expect(callArg?.refetchInterval).toBe(30_000);
  });
});
