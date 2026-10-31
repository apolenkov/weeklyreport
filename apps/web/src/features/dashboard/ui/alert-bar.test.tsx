// @vitest-environment jsdom
//
// Regression coverage for the dashboard alert-bar. The "Configure reminders"
// link is admin-only; non-admin sessions never see it when reminders are off.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReminderDispatchResult, Role } from "@weeklyreport/shared";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

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

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
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
    useQueryMock.mockReturnValue({ data: null, isPending: false });
    return;
  }
  useQueryMock.mockReturnValue({
    data: {
      userId: "00000000-0000-4000-8000-000000000001",
      name: "Test User",
      email: "test@weeklyreport.local",
      role,
    },
    isPending: false,
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
  ruleId: null,
};
const RULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function dispatchResult(result: ReminderDispatchResult): void {
  useMutationMock.mockImplementation(
    (options: { onSuccess: (value: ReminderDispatchResult) => void }) => ({
      mutate: () => options.onSuccess(result),
      isPending: false,
    }),
  );
}

function sendReminder(): void {
  render(<AlertBar {...baseProps} ruleId={RULE_ID} />);
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
        ruleId={RULE_ID}
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
  it("renders the Configure reminders link for admin when ruleId is absent", () => {
    mockRole("admin");

    render(<AlertBar {...baseProps} />);

    expect(
      screen.getByRole("link", { name: /configure reminders/i }),
    ).toBeVisible();
  });

  it("hides the Configure reminders link for head when ruleId is absent", () => {
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

  it("hides the Configure reminders link for admin when ruleId is present", () => {
    mockRole("admin");

    render(<AlertBar {...baseProps} ruleId={RULE_ID} />);

    expect(
      screen.queryByRole("link", { name: /configure reminders/i }),
    ).not.toBeInTheDocument();
  });

  it("uses the policy-aware tooltip on the disabled Send Reminder button", () => {
    mockRole("head");

    render(<AlertBar {...baseProps} />);

    const button = screen.getByRole("button", { name: /send reminder/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Active deadline reminder required.",
    );
  });

  it.each([
    {
      name: "reports a missing active rule",
      result: {
        queued: 0,
        alreadyRequested: 0,
        failed: 0,
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
        queued: 0,
        alreadyRequested: 0,
        failed: 0,
        skipped: 0,
      },
      toastKind: "info",
      message: "No pending leads to remind.",
    },
    {
      name: "reports that every reminder was already requested",
      result: {
        queued: 0,
        alreadyRequested: 2,
        failed: 0,
        skipped: 0,
      },
      toastKind: "info",
      message: "Reminders already requested for 2 leads this cycle.",
    },
    {
      name: "includes partial dispatch extras",
      result: {
        queued: 1,
        alreadyRequested: 2,
        failed: 0,
        skipped: 3,
      },
      toastKind: "success",
      message:
        "Reminder queued for 1 lead (2 already requested this cycle, 3 skipped).",
    },
    {
      name: "reports a successful dispatch",
      result: {
        queued: 2,
        alreadyRequested: 0,
        failed: 0,
        skipped: 0,
      },
      toastKind: "success",
      message: "Reminder queued for 2 leads.",
    },
    {
      name: "preserves successful recipients when another enqueue fails",
      result: { queued: 1, alreadyRequested: 2, failed: 1, skipped: 3 },
      toastKind: "error",
      message:
        "Reminders queued for 1 lead; failed for 1 (2 already requested this cycle, 3 skipped). Retry to request the failed reminders.",
    },
    {
      name: "reports an entirely failed batch without a success toast",
      result: { queued: 0, alreadyRequested: 0, failed: 2, skipped: 0 },
      toastKind: "error",
      message:
        "Reminders queued for 0 leads; failed for 2. Retry to request the failed reminders.",
    },
    {
      name: "reports skipped recipients without claiming success",
      result: { queued: 0, alreadyRequested: 0, failed: 0, skipped: 2 },
      toastKind: "info",
      message: "2 leads skipped; no reminders queued.",
    },
  ] satisfies readonly {
    readonly name: string;
    readonly result: ReminderDispatchResult;
    readonly toastKind: "info" | "success" | "error";
    readonly message: string;
  }[])("$name", ({ result, toastKind, message }) => {
    mockRole("head");
    dispatchResult(result);

    sendReminder();

    expect(toast[toastKind]).toHaveBeenCalledWith(message);
    if (toastKind !== "success") expect(toast.success).not.toHaveBeenCalled();
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

    render(<AlertBar {...baseProps} ruleId={RULE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /send reminder/i }));

    expect(mutate).toHaveBeenCalledWith({
      reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ruleId: RULE_ID,
    });
    expect(toast.error).toHaveBeenCalledWith("SMTP transport unavailable");
  });

  it("renders nothing when there are no pending leads", () => {
    mockRole("admin");

    const { container } = render(<AlertBar {...baseProps} pendingLeads={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("AlertBar — auth.me loading placeholder", () => {
  const PLACEHOLDER = "Checking reminder settings…";

  function mockPending(): void {
    useQueryMock.mockReturnValue({ data: undefined, isPending: true });
  }

  it("shows the reminder-settings placeholder for admin while auth.me is pending", () => {
    mockPending();

    render(<AlertBar {...baseProps} />);

    expect(screen.getByRole("status")).toHaveTextContent(PLACEHOLDER);
    expect(
      screen.queryByRole("link", { name: /configure reminders/i }),
    ).not.toBeInTheDocument();
  });

  it("replaces the placeholder with the link once admin is loaded", () => {
    mockRole("admin");

    render(<AlertBar {...baseProps} />);

    expect(
      screen.getByRole("link", { name: /configure reminders/i }),
    ).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it.each(["head", "lead"] as const)(
    "shows neither the link nor the placeholder for %s once loaded",
    (role) => {
      mockRole(role);

      render(<AlertBar {...baseProps} />);

      expect(
        screen.queryByRole("link", { name: /configure reminders/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    },
  );
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

  it("uses the singular verb when exactly one lead is pending", () => {
    mockRole(null);

    render(<AlertBar {...baseProps} pendingLeads={["Alice"]} />);

    expect(screen.getByText(/lead hasn't started/i)).toBeInTheDocument();
    expect(screen.queryByText(/haven't started/i)).not.toBeInTheDocument();
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
      <AlertBar {...baseProps} pendingLeads={[]} ruleId={RULE_ID} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a reopen-count line even with missing leads present", () => {
    mockRole(null);

    render(
      <AlertBar {...baseProps} pendingLeads={["Alice"]} ruleId={RULE_ID} />,
    );

    expect(screen.getByText(/hasn't started/i)).toBeInTheDocument();
    expect(screen.queryByText(/reopen request/i)).not.toBeInTheDocument();
  });
});

it.each(["Failed to fetch", "Load failed", '[{"code":"invalid_type"}]'])(
  "explains reminder dispatch failure %s using the action copy",
  (message) => {
    mockRole("head");
    useMutationMock.mockImplementation(
      (options: { onError: (error: Error) => void }) => ({
        mutate: () => options.onError(new Error(message)),
        isPending: false,
      }),
    );
    sendReminder();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "Failed to send reminder",
    );
  },
);
