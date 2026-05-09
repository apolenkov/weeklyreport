import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TRPCProxyContext } from "../../lib/trpc-context";

import type { MockReminder } from "./mock-data";
import { RemindersTab } from "./reminders-tab";

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

type Captured = {
  dispatchMutationFn: ReturnType<typeof vi.fn>;
  saveMutationFn: ReturnType<typeof vi.fn>;
  deleteMutationFn: ReturnType<typeof vi.fn>;
};

const period = {
  id: "a0000000-0000-4000-8000-000000000001",
  weekLabel: "Week 19",
  startDate: "2026-05-04",
  endDate: "2026-05-10",
  deadline: "2026-05-08T10:00:00.000Z",
  status: "open" as const,
};

const activeReminder: MockReminder = {
  id: "a0000000-0000-4000-8000-000000000111",
  name: "Deadline reminder",
  description: "Send pending lead reminders",
  active: true,
  kind: "deadline" as const,
  fireAt: new Date("2026-05-08T10:00:00.000Z"),
  timezone: "Europe/Moscow",
  version: 1,
  reportId: period.id,
};

function makeMutationOptions(
  mutationFn: ReturnType<typeof vi.fn>,
  opts: Record<string, unknown>,
) {
  return {
    mutationFn,
    onSuccess: opts["onSuccess"],
    onError: opts["onError"],
    onSettled: opts["onSettled"],
  };
}

function makeMockTRPC(captured: Captured) {
  return {
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ["admin", "snapshot"] }) },
      getSettings: { pathFilter: () => ({ queryKey: ["admin", "settings"] }) },
      saveReminderRule: {
        mutationOptions: (opts: Record<string, unknown>) =>
          makeMutationOptions(captured.saveMutationFn, opts),
      },
      deleteReminderRule: {
        mutationOptions: (opts: Record<string, unknown>) =>
          makeMutationOptions(captured.deleteMutationFn, opts),
      },
    },
    weeklyReport: {
      get: { pathFilter: () => ({ queryKey: ["weeklyReport", "get"] }) },
    },
    reminders: {
      dispatchPending: {
        mutationOptions: (opts: Record<string, unknown>) =>
          makeMutationOptions(captured.dispatchMutationFn, opts),
      },
    },
  } as never;
}

function renderTab(
  reminders = [activeReminder],
  captured: Captured = {
    dispatchMutationFn: vi.fn().mockResolvedValue({
      dispatched: 2,
      alreadySent: 1,
      skipped: 1,
    }),
    saveMutationFn: vi.fn(),
    deleteMutationFn: vi.fn(),
  },
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC(captured);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>{children}</TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(<RemindersTab reminders={reminders} periods={[period]} />, {
    wrapper: Wrapper,
  });
}

describe("RemindersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches the selected active rule through reminders.dispatchPending", async () => {
    const captured: Captured = {
      dispatchMutationFn: vi.fn().mockResolvedValue({
        dispatched: 2,
        alreadySent: 1,
        skipped: 1,
      }),
      saveMutationFn: vi.fn(),
      deleteMutationFn: vi.fn(),
    };

    renderTab([activeReminder], captured);

    await userEvent.click(
      screen.getByRole("button", { name: /send deadline reminder now/i }),
    );

    await waitFor(() => {
      expect(captured.dispatchMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.dispatchMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: period.id,
      ruleId: activeReminder.id,
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      "Reminder sent to 2 leads (1 already sent this cycle, 1 opted out).",
    );
  });

  it("does not expose Send Now for paused or unbound rules", () => {
    renderTab([
      { ...activeReminder, id: "a0000000-0000-4000-8000-000000000112", active: false },
      { ...activeReminder, id: "a0000000-0000-4000-8000-000000000113", reportId: null },
    ]);

    const sendButtons = screen.getAllByRole("button", {
      name: /send deadline reminder now/i,
    });
    expect(sendButtons[0]).toBeDisabled();
    expect(sendButtons[1]).toBeDisabled();
  });
});
