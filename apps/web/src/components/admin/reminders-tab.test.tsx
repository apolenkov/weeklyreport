import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";

import type { MockPeriod, MockReminder, MockReminderPolicy } from "./mock-data";
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
  saveMutationFn: ReturnType<typeof vi.fn>;
  removeMutationFn: ReturnType<typeof vi.fn>;
};

const period: MockPeriod = {
  id: "a0000000-0000-4000-8000-000000000001",
  weekLabel: "Week 19",
  startDate: "2026-05-04",
  endDate: "2026-05-10",
  deadline: "2026-05-08T10:00:00.000Z",
  status: "open" as const,
};

const policyDeadline: MockReminderPolicy = {
  id: "b0000000-0000-4000-8000-000000000001",
  kind: "deadline",
  offsetMinutes: -1440,
  timezone: "Europe/Moscow",
  audience: "lead-with-draft",
  active: true,
  validFrom: new Date("2026-05-01T00:00:00.000Z"),
  validUntil: null,
};

const policyEscalation: MockReminderPolicy = {
  id: "b0000000-0000-4000-8000-000000000002",
  kind: "escalation",
  offsetMinutes: 120,
  timezone: "Europe/Moscow",
  audience: "head-of-late",
  active: false,
  validFrom: new Date("2026-05-01T00:00:00.000Z"),
  validUntil: new Date("2026-12-31T00:00:00.000Z"),
};

const derivedRule: MockReminder = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Deadline reminder",
  description: "auto",
  active: true,
  kind: "deadline",
  fireAt: new Date("2026-05-07T10:00:00.000Z"),
  timezone: "Europe/Moscow",
  version: 1,
  reportId: period.id,
  policyId: policyDeadline.id,
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
      savePolicy: {
        mutationOptions: (opts: Record<string, unknown>) =>
          makeMutationOptions(captured.saveMutationFn, opts),
      },
      removePolicy: {
        mutationOptions: (opts: Record<string, unknown>) =>
          makeMutationOptions(captured.removeMutationFn, opts),
      },
    },
    weeklyReport: {
      get: { pathFilter: () => ({ queryKey: ["weeklyReport", "get"] }) },
    },
  } as never;
}

function renderTab(args?: {
  policies?: MockReminderPolicy[];
  derivedRulesByPolicyId?: Record<string, MockReminder[]>;
  captured?: Captured;
  // UFB-048 (Phase 48-B): admin-panel pipes these through from AppSettings.
  defaultTimezone?: string;
  defaultAudience?: MockReminderPolicy["audience"];
}) {
  const captured: Captured = args?.captured ?? {
    saveMutationFn: vi.fn().mockResolvedValue(undefined),
    removeMutationFn: vi.fn().mockResolvedValue({ success: true }),
  };
  const policies = args?.policies ?? [policyDeadline, policyEscalation];
  const derivedRulesByPolicyId = args?.derivedRulesByPolicyId ?? {
    [policyDeadline.id]: [derivedRule],
    [policyEscalation.id]: [],
  };

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC(captured);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <RemindersTab
      policies={policies}
      derivedRulesByPolicyId={derivedRulesByPolicyId}
      periods={[period]}
      defaultTimezone={args?.defaultTimezone}
      defaultAudience={args?.defaultAudience}
    />,
    { wrapper: Wrapper },
  );
  return { ...result, captured };
}

describe("RemindersTab (Phase 44-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders policies as readable reminder schedules", () => {
    renderTab();
    const row = screen.getByTestId(`policy-row-${policyDeadline.id}`);
    expect(row).toHaveTextContent("24 hours before deadline");
    expect(row).toHaveTextContent("Leads with drafts");
    expect(row).toHaveTextContent("Europe/Moscow");
    expect(row).toHaveTextContent("Valid since 2026-05-01 · no end date");
    expect(row).toHaveTextContent("1 scheduled period");
    expect(row).not.toHaveTextContent("T-24h");
    expect(row).not.toHaveTextContent("lead-with-draft");

    const row2 = screen.getByTestId(`policy-row-${policyEscalation.id}`);
    expect(row2).toHaveTextContent("2 hours after deadline");
    expect(row2).toHaveTextContent("Head of late leads");
    expect(row2).toHaveTextContent("→");
    expect(row2).not.toHaveTextContent("escalation");
    expect(row2).not.toHaveTextContent("head-of-late");
    expect(row2).not.toHaveTextContent("T+2h");
    expect(row2).toHaveTextContent("No scheduled periods yet");
    expect(screen.queryByText(/Coming Soon/i)).not.toBeInTheDocument();
  });

  it("shows the empty-state copy when policies is empty", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    // A8: empty state now shows "No reminder policies yet" heading + CTA button.
    expect(screen.getByTestId("reminders-empty-state")).toHaveTextContent(
      /No reminder policies yet/i,
    );
    expect(
      screen.getByRole("button", { name: /create first policy/i }),
    ).toBeInTheDocument();
  });

  it("opens the form on 'New Policy' and submits with the form payload", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(screen.getByTestId("new-policy-button"));
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    await user.click(screen.getByTestId("policy-save-button"));

    await waitFor(() => {
      expect(captured.saveMutationFn).toHaveBeenCalledTimes(1);
    });
    const arg = captured.saveMutationFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(arg.kind).toBe("deadline");
    expect(arg.offsetMinutes).toBe(-1440);
    expect(arg.timezone).toBe("Europe/Moscow");
    expect(arg.audience).toBe("lead-with-draft");
    expect(arg.active).toBe(true);
    expect(arg.validUntil).toBeNull();
    expect(arg.validFrom).toBeInstanceOf(Date);
    expect(typeof arg.id).toBe("string");
  });

  it("disables Save and shows hint when validUntil < validFrom", async () => {
    const user = userEvent.setup();
    renderTab({ policies: [], derivedRulesByPolicyId: {} });

    // empty-state spawned an open form (initial showForm = true)
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    // Uncheck "forever" → date input appears
    await user.click(
      screen.getByRole("checkbox", { name: /forever \(no end date\)/i }),
    );
    const validFrom = screen.getByLabelText(/Valid from/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(
      /^policy-valid-until$|^Valid until$/i,
    ) as HTMLInputElement;

    // Force validFrom = today, validUntil = day before validFrom.
    const fromIso = validFrom.value;
    const before = new Date(fromIso);
    before.setUTCDate(before.getUTCDate() - 1);
    const beforeIso = before.toISOString().slice(0, 10);

    await user.clear(validUntil);
    await user.type(validUntil, beforeIso);

    expect(screen.getByTestId("policy-validity-hint")).toBeInTheDocument();
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
  });

  it("expands a policy row and renders derived rules read-only", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId(`expand-${policyDeadline.id}`));
    const panel = screen.getByTestId(`derived-rules-${policyDeadline.id}`);
    expect(within(panel).getByText(/Week 19/)).toBeInTheDocument();
    expect(within(panel).getByText(/deadline/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Europe\/Moscow/i)).toBeInTheDocument();
  });

  it("shows derived-rules empty hint for a policy with no rules", async () => {
    const user = userEvent.setup();
    renderTab();
    expect(
      screen.queryByText(/No matching report periods yet/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId(`expand-${policyEscalation.id}`));
    const emptyHint = screen.getByTestId(
      `derived-rules-empty-${policyEscalation.id}`,
    );
    expect(emptyHint).toHaveTextContent(/No matching report periods yet/i);
    expect(screen.getByText("Generated schedule")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });

  it("opens the remove confirm dialog and warns about derived rule count", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(screen.getByTestId(`remove-${policyDeadline.id}`));
    expect(
      screen.getByText(/This will remove 1 derived rule/i),
    ).toBeInTheDocument();

    // confirm
    await user.click(screen.getByRole("button", { name: /confirm|delete/i }));
    await waitFor(() => {
      expect(captured.removeMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.removeMutationFn.mock.calls[0]?.[0]).toEqual({
      id: policyDeadline.id,
    });
  });

  it("populates the form when editing an existing policy", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId(`edit-${policyEscalation.id}`));
    const audienceSelect = screen.getByLabelText(
      /Audience/i,
    ) as HTMLSelectElement;
    expect(audienceSelect.value).toBe("head-of-late");
    const tzSelect = screen.getByLabelText(/Timezone/i) as HTMLSelectElement;
    expect(tzSelect.value).toBe("Europe/Moscow");
    // forever checkbox should be UNchecked because validUntil is set
    const foreverCheckbox = screen.getByRole("checkbox", {
      name: /forever \(no end date\)/i,
    }) as HTMLInputElement;
    expect(foreverCheckbox.checked).toBe(false);
  });

  // UFB-048 (Phase 48-B): the «New Policy» form prefills timezone and
  // audience from AppSettings instead of hardcoded constants. Without an
  // existing policy to pre-fill, the form opens automatically and we assert
  // the controls reflect the org defaults pumped through props.
  it("UFB-048: prefills timezone + audience from org defaults on a fresh form", async () => {
    renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
      defaultTimezone: "Asia/Yekaterinburg",
      defaultAudience: "head-of-late",
    });

    const tzSelect = screen.getByLabelText(/Timezone/i) as HTMLSelectElement;
    expect(tzSelect.value).toBe("Asia/Yekaterinburg");

    const audSelect = screen.getByLabelText(/Audience/i) as HTMLSelectElement;
    expect(audSelect.value).toBe("head-of-late");
  });
});
