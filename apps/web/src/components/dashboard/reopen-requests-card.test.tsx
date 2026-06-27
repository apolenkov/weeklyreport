/**
 * @vitest-environment jsdom
 *
 * reopen-request-lifecycle (D2): the head-dashboard reopen queue. Renders
 * pending requests, decides them inline via respondReopenRequest, and on a
 * decision invalidates BOTH the list and the pending count.
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
  useMutation: (...args: unknown[]) => useMutationMock(...args) as unknown,
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      listReopenRequests: {
        queryOptions: () => ({ queryKey: ["admin.listReopenRequests"] }),
        queryKey: () => ["admin.listReopenRequests"],
      },
      respondReopenRequest: {
        mutationOptions: (opts: unknown) => opts,
      },
      pendingReopenCount: {
        queryKey: () => ["admin.pendingReopenCount"],
      },
    },
  }),
}));

import { ReopenRequestsCard } from "./reopen-requests-card";

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    reportSectionId: "sec-1",
    reason: "Forgot the carry-over",
    status: "pending",
    reviewNote: null,
    reviewedAt: null,
    createdAt: "2026-04-06T12:00:00.000Z",
    requestedBy: { id: "u1", name: "Alice Lead", email: "alice@test.local" },
    reviewedBy: null,
    sectionStatus: "submitted",
    report: {
      id: "rep-1",
      weekLabel: "W15-2026",
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-10T00:00:00.000Z",
    },
    ...overrides,
  };
}

beforeEach(() => {
  useQueryMock.mockReset();
  useMutationMock.mockReset();
  invalidateQueries.mockReset();
  useMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

function mockList(
  data: unknown[] | undefined,
  flags: Record<string, unknown> = {},
) {
  useQueryMock.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    ...flags,
  });
}

describe("ReopenRequestsCard", () => {
  it("renders nothing when there are no pending requests", () => {
    mockList([]);
    const { container } = render(<ReopenRequestsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while loading", () => {
    mockList(undefined, { isPending: true });
    const { container } = render(<ReopenRequestsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders pending requests with the requester and count", () => {
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);
    expect(screen.getByText("Alice Lead")).toBeInTheDocument();
    expect(screen.getByText(/1 pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgot the carry-over/)).toBeInTheDocument();
  });

  it("approves a request inline with the right input", () => {
    const mutate = vi.fn();
    useMutationMock.mockReturnValue({ mutate, isPending: false });
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);

    fireEvent.click(screen.getByRole("button", { name: /respond/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(mutate).toHaveBeenCalledWith({
      id: "req-1",
      decision: "approved",
      note: undefined,
    });
  });

  it("invalidates the list and the pending count on settled", () => {
    let capturedOnSettled: (() => void) | undefined;
    useMutationMock.mockImplementation((opts: { onSettled?: () => void }) => {
      capturedOnSettled = opts.onSettled;
      return { mutate: vi.fn(), isPending: false };
    });
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);

    capturedOnSettled?.();

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin.listReopenRequests"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin.pendingReopenCount"],
    });
  });
});
