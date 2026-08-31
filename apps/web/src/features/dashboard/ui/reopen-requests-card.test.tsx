// @vitest-environment jsdom
//
// The head-dashboard reopen queue. Renders pending requests, decides them
// inline via respondReopenRequest, and on a decision invalidates BOTH the
// list and the pending count.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const invalidateQueries = vi.fn().mockResolvedValue(undefined);
const mutate = vi.fn();

interface RespondResult {
  readonly staleAutoClosed: boolean;
  readonly decision: "approved" | "rejected";
}

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
  useMutation: (...args: unknown[]) => useMutationMock(...args) as unknown,
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
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
  vi.clearAllMocks();
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

function mockSuccessfulResponse(result: RespondResult): void {
  useMutationMock.mockImplementation(
    (options: { onSuccess: (value: RespondResult) => void }) => ({
      mutate: (input: unknown) => {
        mutate(input);
        options.onSuccess(result);
      },
      isPending: false,
    }),
  );
}

function expectResponseFormReset(): void {
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /respond/i }));
  expect(screen.getByRole("textbox")).toHaveValue("");
}

describe("ReopenRequestsCard", () => {
  it("renders nothing when there are no pending requests", () => {
    mockList([]);
    const { container } = render(<ReopenRequestsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a stable loading placeholder while loading", () => {
    mockList(undefined, { isPending: true });
    render(<ReopenRequestsCard />);
    expect(
      screen.getByRole("status", { name: /loading pending reopen requests/i }),
    ).toBeInTheDocument();
  });

  it("renders a retryable error instead of an empty queue", () => {
    const refetch = vi.fn().mockResolvedValue({});
    mockList(undefined, {
      isError: true,
      error: new Error("queue failed"),
      refetch,
    });
    render(<ReopenRequestsCard />);
    const issue = screen.getByTestId("reopen-requests-error");
    expect(issue).toHaveTextContent("queue failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(document.querySelector("#reopen-requests-card")).not.toBeNull();
  });

  it("renders pending requests with the requester and count", () => {
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);
    expect(screen.getByText("Alice Lead")).toBeInTheDocument();
    expect(screen.getByText(/1 pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgot the carry-over/)).toBeInTheDocument();
  });

  it("shows the stale-auto-close toast and resets response state", () => {
    mockSuccessfulResponse({
      staleAutoClosed: true,
      decision: "approved",
    });
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);

    fireEvent.click(screen.getByRole("button", { name: /respond/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(toast.info).toHaveBeenCalledWith(
      "This section was already reopened; the request was closed.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expectResponseFormReset();
  });

  it("shows the approved toast and resets response state", () => {
    mockSuccessfulResponse({
      staleAutoClosed: false,
      decision: "approved",
    });
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);

    fireEvent.click(screen.getByRole("button", { name: /respond/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Approved after review" },
    });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(mutate).toHaveBeenCalledWith({
      id: "req-1",
      decision: "approved",
      note: "Approved after review",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Request approved; section reopened.",
    );
    expectResponseFormReset();
  });

  it("submits the trimmed reject payload, toasts, and resets response state", () => {
    mockSuccessfulResponse({
      staleAutoClosed: false,
      decision: "rejected",
    });
    mockList([makeRequest()]);
    render(<ReopenRequestsCard />);

    fireEvent.click(screen.getByRole("button", { name: /respond/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Needs more detail  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    expect(mutate).toHaveBeenCalledWith({
      id: "req-1",
      decision: "rejected",
      note: "Needs more detail",
    });
    expect(toast.success).toHaveBeenCalledWith("Request rejected.");
    expectResponseFormReset();
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
