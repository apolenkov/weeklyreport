/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the dashboard alert-bar. The "Configure reminders"
 * link is admin-only; non-admin sessions never see it when reminders are off.
 */
import "@testing-library/jest-dom/vitest";

import type { Role } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

interface DispatchResult {
  readonly dispatched: number;
  readonly alreadySent: number;
  readonly skipped: number;
  readonly reason: "no-active-rule" | null;
}

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
  useMutation: (...args: unknown[]) => useMutationMock(...args) as unknown,
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({ queryKey: ["auth.me"] }),
      },
    },
    reminders: {
      dispatchPending: {
        mutationOptions: (opts: unknown) => opts,
      },
    },
  }),
}));

import { AlertBar } from "./alert-bar";

function mockRole(role: Role | null) {
  if (role === null) {
    useQueryMock.mockReturnValue({ data: null });
    return;
  }
  useQueryMock.mockReturnValue({
    data: {
      userId: "00000000-0000-4000-8000-000000000001",
      name: "Test User",
      email: "test@customreport.local",
      role,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
});

const baseProps = {
  pendingLeads: ["Alice", "Bob"],
  reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  canSendReminder: false,
};

function dispatchResult(result: DispatchResult): void {
  useMutationMock.mockImplementation(
    (options: { onSuccess: (value: DispatchResult) => void }) => ({
      mutate: () => options.onSuccess(result),
      isPending: false,
    }),
  );
}

function sendReminder(): void {
  render(<AlertBar {...baseProps} canSendReminder />);
  fireEvent.click(screen.getByRole("button", { name: /send reminder/i }));
}

describe("AlertBar SVG aria-hidden", () => {
  it("AlertIcon svg has aria-hidden='true'", () => {
    mockRole("head");
    const { container } = render(<AlertBar {...baseProps} />);

    // The SVG is aria-hidden so RTL role queries skip it; locate via DOM.
    const svgEl = container.querySelector("svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl).toHaveAttribute("aria-hidden", "true");
  });
});

describe("AlertBar semantic structure", () => {
  it("decorative SVG hidden, button type='button', aggregate count rendered", () => {
    mockRole("head");
    const { container } = render(
      <AlertBar
        pendingLeads={["Alice", "Bob"]}
        reportId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        canSendReminder
      />,
    );

    const svgEl = container.querySelector("svg");
    expect(svgEl).toHaveAttribute("aria-hidden", "true");

    const button = screen.getByRole("button", { name: /send reminder/i });
    expect(button).toHaveAttribute("type", "button");

    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("AlertBar — role gating", () => {
  it("renders the Configure reminders link for admin when canSendReminder=false", () => {
    mockRole("admin");

    render(<AlertBar {...baseProps} />);

    expect(
      screen.getByRole("link", { name: /configure reminders/i }),
    ).toBeVisible();
  });

  it("hides the Configure reminders link for head even when canSendReminder=false", () => {
    mockRole("head");

    render(<AlertBar {...baseProps} />);

    expect(
      screen.queryByRole("link", { name: /configure reminders/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the Configure reminders link for lead", () => {
    mockRole("lead");

    render(<AlertBar {...baseProps} />);

    expect(
      screen.queryByRole("link", { name: /configure reminders/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the Configure reminders link when an active policy is present (admin, canSendReminder=true)", () => {
    mockRole("admin");

    render(<AlertBar {...baseProps} canSendReminder />);

    expect(
      screen.queryByRole("link", { name: /configure reminders/i }),
    ).not.toBeInTheDocument();
  });

  it("uses the policy-aware tooltip on the disabled Send Reminder button", () => {
    mockRole("head");

    render(<AlertBar {...baseProps} />);

    const button = screen.getByRole("button", { name: /send reminder/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Active reminder policy required.");
  });

  it.each([
    {
      name: "reports a missing active rule",
      result: {
        dispatched: 0,
        alreadySent: 0,
        skipped: 0,
        reason: "no-active-rule",
      },
      toastKind: "info",
      message:
        "Reminder rule is not configured for this period. Configure it in Admin → Reminders.",
    },
    {
      name: "reports an empty pending queue",
      result: {
        dispatched: 0,
        alreadySent: 0,
        skipped: 0,
        reason: null,
      },
      toastKind: "info",
      message: "No pending leads to remind.",
    },
    {
      name: "reports that every reminder was already sent",
      result: {
        dispatched: 0,
        alreadySent: 2,
        skipped: 0,
        reason: null,
      },
      toastKind: "info",
      message: "All 2 pending leads already received this cycle's reminder.",
    },
    {
      name: "includes partial dispatch extras",
      result: {
        dispatched: 1,
        alreadySent: 2,
        skipped: 3,
        reason: null,
      },
      toastKind: "success",
      message:
        "Reminder sent to 1 lead (2 already sent this cycle, 3 opted out).",
    },
    {
      name: "reports a successful dispatch",
      result: {
        dispatched: 2,
        alreadySent: 0,
        skipped: 0,
        reason: null,
      },
      toastKind: "success",
      message: "Reminder sent to 2 leads.",
    },
  ] satisfies readonly {
    readonly name: string;
    readonly result: DispatchResult;
    readonly toastKind: "info" | "success";
    readonly message: string;
  }[])("$name", ({ result, toastKind, message }) => {
    mockRole("head");
    dispatchResult(result);

    sendReminder();

    expect(toast[toastKind]).toHaveBeenCalledWith(message);
  });

  it("surfaces dispatch failures as an error toast", () => {
    mockRole("head");
    const mutate = vi.fn();
    useMutationMock.mockImplementation(
      (opts: { onError: (err: Error) => void }) => ({
        mutate: (input: unknown) => {
          mutate(input);
          opts.onError(new Error("SMTP transport unavailable"));
        },
        isPending: false,
      }),
    );

    render(<AlertBar {...baseProps} canSendReminder />);
    fireEvent.click(screen.getByRole("button", { name: /send reminder/i }));

    expect(mutate).toHaveBeenCalledWith({
      reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(toast.error).toHaveBeenCalledWith("SMTP transport unavailable");
  });

  it("renders nothing when there are no pending leads", () => {
    mockRole("admin");

    const { container } = render(<AlertBar {...baseProps} pendingLeads={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("AlertBar — pending label accuracy", () => {
  it("renders an aggregate count without creating a second lead roster", () => {
    mockRole(null);

    render(<AlertBar {...baseProps} pendingLeads={["Alice", "Bob"]} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/leads haven't started/i)).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The alert bar carries lead-submission
// signals only — the Reopen Requests card is the single reopen surface.
// ---------------------------------------------------------------------------

describe("AlertBar — no reopen surface", () => {
  it("renders nothing when there are no missing leads, regardless of reopen state", () => {
    mockRole(null);

    const { container } = render(
      <AlertBar {...baseProps} pendingLeads={[]} canSendReminder />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a reopen-count line even with missing leads present", () => {
    mockRole(null);

    render(
      <AlertBar {...baseProps} pendingLeads={["Alice"]} canSendReminder />,
    );

    expect(screen.getByText(/haven't started/i)).toBeInTheDocument();
    expect(screen.queryByText(/reopen request/i)).not.toBeInTheDocument();
  });
});
