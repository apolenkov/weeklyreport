/**
 * @vitest-environment jsdom
 *
 * Phase 48-C (UFB-038 / UFB-040): regression coverage for the dashboard
 * alert-bar. The "Configure reminders" link is admin-only; head/lead/viewer
 * sessions should never see it even when canSendReminder=false.
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({ queryKey: ["auth.me"] }),
      },
    },
    admin: {
      pendingReopenCount: {
        queryOptions: () => ({ queryKey: ["admin.pendingReopenCount"] }),
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

function mockRole(role: "admin" | "head" | "lead" | "viewer" | null) {
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
  useQueryMock.mockReset();
  useMutationMock.mockReset();
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

/**
 * VA-0a unit-rtl (high-pri) + VA-0b snapshot — verify-a11y catalog rows for
 * alert-bar.tsx:
 *
 *   Row 1 (unit-rtl/high): AlertIcon svg has aria-hidden="true"
 *   Row 2 (snapshot/high): svg with aria-hidden="true" present in rendered DOM
 *   Row 3 (snapshot/high): alert bar semantic structure — decorative SVG hidden,
 *     button type="button", pending-names spans all rendered
 */
describe("VA-0a: AlertIcon SVG aria-hidden", () => {
  it("AlertIcon svg has aria-hidden='true'", () => {
    mockRole("head");
    const { container } = render(<AlertBar {...baseProps} />);

    // The SVG is aria-hidden so RTL role queries skip it; locate via DOM.
    const svgEl = container.querySelector("svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl).toHaveAttribute("aria-hidden", "true");
  });
});

describe("VA-0b: AlertBar snapshots", () => {
  it("svg with aria-hidden='true' is present in rendered DOM (snapshot)", () => {
    mockRole("head");
    const { container } = render(<AlertBar {...baseProps} />);

    const svgEl = container.querySelector("svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl).toMatchSnapshot();
  });

  it("alert bar semantic structure — decorative SVG hidden, button type='button', pending spans rendered (snapshot)", () => {
    mockRole("head");
    const { container } = render(
      <AlertBar
        pendingLeads={["Alice", "Bob"]}
        reportId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        canSendReminder
      />,
    );

    // Snapshot the outermost rendered element so any structural regression
    // (SVG aria-hidden removed, button type missing, span rendering broken)
    // is caught immediately.
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("AlertBar — Phase 48-C role gating", () => {
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
    expect(button).toHaveAttribute(
      "title",
      "Active reminder policy required — ask your admin",
    );
  });

  it("E-04: surfaces dispatch failures as an error toast", () => {
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

// ---------------------------------------------------------------------------
// reopen-request-lifecycle (D3): pending-reopen indicator
// ---------------------------------------------------------------------------

describe("AlertBar — reopen indicator", () => {
  it("renders the indicator when reopen count > 0 even with zero missing leads", () => {
    useQueryMock.mockReturnValue({ data: { count: 2 } });

    render(<AlertBar {...baseProps} pendingLeads={[]} canSendReminder />);

    expect(screen.getByText(/2 reopen requests pending/i)).toBeInTheDocument();
    // No missing leads → no reminder affordance.
    expect(
      screen.queryByRole("button", { name: /send reminder/i }),
    ).not.toBeInTheDocument();
  });

  it("singularizes the count", () => {
    useQueryMock.mockReturnValue({ data: { count: 1 } });

    render(<AlertBar {...baseProps} pendingLeads={[]} canSendReminder />);

    expect(screen.getByText(/1 reopen request pending/i)).toBeInTheDocument();
  });

  it("renders nothing when both missing leads and reopen count are zero", () => {
    useQueryMock.mockReturnValue({ data: { count: 0 } });

    const { container } = render(
      <AlertBar {...baseProps} pendingLeads={[]} canSendReminder />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows missing leads AND the reopen indicator together", () => {
    useQueryMock.mockReturnValue({ data: { count: 3 } });

    render(
      <AlertBar {...baseProps} pendingLeads={["Alice"]} canSendReminder />,
    );

    expect(screen.getByText(/haven't submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/3 reopen requests pending/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reminder/i }),
    ).toBeInTheDocument();
  });
});
