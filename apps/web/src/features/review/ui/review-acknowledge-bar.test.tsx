// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { ReviewAcknowledgementView } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();
const clientErrorReporting = vi.hoisted(() => ({
  logClientError: vi.fn(),
  formatClientErrorMessage: vi.fn(
    (prefix: string, _error: unknown): string => `${prefix}.`,
  ),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
vi.mock(
  "../../../shared/lib/errors/client-error-reporting",
  () => clientErrorReporting,
);

import { ReviewAcknowledgeBar } from "./review-acknowledge-bar";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "44444444-4444-4444-8444-444444444444";
const GROUP_LABEL = "Core Development";
const OTHER_GROUP_ID = "55555555-5555-4555-8555-555555555555";
const CURRENT_USER_ID = "22222222-2222-4222-8222-222222222222";

const CURRENT_USER_ACK: ReviewAcknowledgementView = {
  userId: CURRENT_USER_ID,
  userName: "Current User",
  reportId: REPORT_ID,
  groupId: GROUP_ID,
  seenAt: new Date("2026-07-22T12:00:00.000Z"),
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderBar(options: {
  readonly acks?: readonly ReviewAcknowledgementView[];
  readonly isHeadOrAdmin?: boolean;
  readonly acksError?: boolean;
}) {
  const initialAcks = options.acks ?? [];
  const getAcks = vi.fn(() => {
    if (options.acksError) {
      return Promise.reject(new Error("roster query failed"));
    }
    return Promise.resolve([...initialAcks]);
  });
  const { proxy, captured } = createMockTRPC([
    {
      path: ["review", "acknowledgements"],
      queryByInput: () => getAcks(),
    },
    { path: ["review", "acknowledge"], mutation: true },
  ]);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={makeQueryClient()}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  render(
    <ReviewAcknowledgeBar
      reportId={REPORT_ID}
      groups={[{ groupId: GROUP_ID, label: GROUP_LABEL }]}
      currentUserId={CURRENT_USER_ID}
      isHeadOrAdmin={options.isHeadOrAdmin ?? false}
    />,
    { wrapper: Wrapper },
  );

  return { captured, getAcks };
}

describe("ReviewAcknowledgeBar", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    clientErrorReporting.logClientError.mockClear();
    clientErrorReporting.formatClientErrorMessage.mockClear();
  });

  it("renders nothing when there are no reviewable groups", () => {
    const { container } = render(
      <ReviewAcknowledgeBar
        reportId={REPORT_ID}
        groups={[]}
        currentUserId={CURRENT_USER_ID}
        isHeadOrAdmin={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("disables the control once the current user is already on the roster", async () => {
    renderBar({ acks: [CURRENT_USER_ACK] });

    const button = await screen.findByRole("button", {
      name: `Acknowledged · ${GROUP_LABEL}`,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("on Acknowledge: mutates reportId+groupId, toasts success, and locks after refetch", async () => {
    const { captured, getAcks } = renderBar({ acks: [] });
    const mutationFn = expectDefined(captured["review.acknowledge"]).mutationFn;
    mutationFn.mockImplementation(() => {
      getAcks.mockReturnValue(Promise.resolve([CURRENT_USER_ACK]));
      return Promise.resolve(undefined);
    });

    const button = await screen.findByRole("button", {
      name: `Acknowledge · ${GROUP_LABEL}`,
    });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
      groupId: GROUP_ID,
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Acknowledged");
    });

    await waitFor(() => {
      const locked = screen.getByRole("button", {
        name: `Acknowledged · ${GROUP_LABEL}`,
      });
      expect(locked).toBeDisabled();
      expect(locked).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("head/admin sees the Seen-by roster when acknowledgements exist", async () => {
    renderBar({
      acks: [CURRENT_USER_ACK],
      isHeadOrAdmin: true,
    });

    expect(await screen.findByText("Seen by Current User")).toBeInTheDocument();
  });

  it("gives two group actions distinct visible and accessible names", async () => {
    const { proxy } = createMockTRPC([
      {
        path: ["review", "acknowledgements"],
        queryByInput: () => Promise.resolve([]),
      },
      { path: ["review", "acknowledge"], mutation: true },
    ]);
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <TRPCProxyContext.Provider value={proxy}>
          <ReviewAcknowledgeBar
            reportId={REPORT_ID}
            groups={[
              { groupId: GROUP_ID, label: GROUP_LABEL },
              { groupId: OTHER_GROUP_ID, label: "Finance Platforms" },
            ]}
            currentUserId={CURRENT_USER_ID}
            isHeadOrAdmin={false}
          />
        </TRPCProxyContext.Provider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("button", {
        name: `Acknowledge · ${GROUP_LABEL}`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Acknowledge · Finance Platforms",
      }),
    ).toBeVisible();
  });

  it("keeps the control inert and shows an error when the roster query fails", async () => {
    renderBar({ acksError: true });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load acknowledgements");
    const button = screen.getByRole("button", { name: /^Acknowledge/ });
    expect(button).toBeDisabled();
    expect(screen.queryByText(/^Seen by/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(clientErrorReporting.logClientError).toHaveBeenCalledWith(
        "review.acknowledgements.load_failed",
        expect.objectContaining({ message: "roster query failed" }),
        {
          component: "ReviewAcknowledgeBar",
          procedure: "review.acknowledgements",
          reportId: REPORT_ID,
          groupId: GROUP_ID,
        },
      );
    });
  });
});
