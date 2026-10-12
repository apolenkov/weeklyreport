import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import type {
  AdminReminderExecutionView,
  AdminReminderPolicyView,
  AdminReminderView,
} from "../../model/admin-types";
import { RemindersTab } from "./reminders-tab";

const toastSuccess: (...args: unknown[]) => void = vi.fn();
const toastError: (...args: unknown[]) => void = vi.fn();
const toastInfo: (...args: unknown[]) => void = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

const policyDeadline: AdminReminderPolicyView = {
  id: "b0000000-0000-4000-8000-000000000001",
  kind: "deadline",
  offsetMinutes: -1440,
  timezone: "Europe/Moscow",
  audience: "lead-with-draft",
  active: true,
  validFrom: new Date("2026-05-01T12:34:56.789Z"),
  validUntil: null,
};

const policyEscalation: AdminReminderPolicyView = {
  id: "b0000000-0000-4000-8000-000000000002",
  kind: "escalation",
  offsetMinutes: 120,
  timezone: "Europe/Moscow",
  audience: "head-of-late",
  active: false,
  validFrom: new Date("2026-05-01T09:12:34.567+03:00"),
  validUntil: new Date("2026-12-31T23:59:59.999Z"),
};

// Far-future fire time so the next-send line is deterministic whatever day the
// suite runs.
const futureRule: AdminReminderView = {
  policyId: policyDeadline.id,
  fireAt: new Date("2099-05-07T10:00:00.000Z"),
  active: true,
};

function renderTab(args?: {
  policies?: AdminReminderPolicyView[];
  derivedRulesByPolicyId?: Record<string, AdminReminderView[]>;
  executions?: AdminReminderExecutionView[];
  defaultTimezone?: string;
}) {
  const { proxy, captured } = createMockTRPC([
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
    // invalidateAdmin() touches these caches on a successful save/remove, so
    // they must be registered or the onSuccess handler throws before the toast.
    { path: ["admin", "getOrganization"] },
    { path: ["org", "getPublic"] },
    { path: ["auth", "me"] },
    { path: ["admin", "savePolicy"], mutation: true },
    { path: ["admin", "removePolicy"], mutation: true },
    { path: ["weeklyReport", "get"] },
  ]);

  expectDefined(captured["admin.savePolicy"]).mutationFn.mockResolvedValue(
    undefined,
  );
  expectDefined(captured["admin.removePolicy"]).mutationFn.mockResolvedValue({
    success: true,
  });

  const policies = args?.policies ?? [policyDeadline, policyEscalation];
  const derivedRulesByPolicyId = args?.derivedRulesByPolicyId ?? {
    [policyDeadline.id]: [futureRule],
    [policyEscalation.id]: [],
  };
  const executions = args?.executions ?? [];

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <RemindersTab
      policies={policies}
      derivedRulesByPolicyId={derivedRulesByPolicyId}
      executions={executions}
      defaultTimezone={args?.defaultTimezone ?? "Europe/Moscow"}
    />,
    { wrapper: Wrapper },
  );
  return { ...result, captured };
}

const executionBase: AdminReminderExecutionView = {
  id: "c0000000-0000-4000-8000-000000000001",
  ruleId: "c0000000-0000-4000-8000-000000000002",
  reportId: "c0000000-0000-4000-8000-000000000003",
  status: "failed",
  scheduledFor: new Date("2026-05-07T10:00:00.000Z"),
  sentAt: null,
  recipientEmail: "lead@example.com",
  errorMessage: "SMTP unavailable",
};

describe("RemindersTab — empty-state bell SVG a11y", () => {
  it("bell SVG in empty state has aria-hidden='true'", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const emptyState = screen.getByTestId("reminders-empty-state");
    const svg = emptyState.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("bell SVG in empty state is not exposed to assistive technology", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const emptyState = screen.getByTestId("reminders-empty-state");
    const svgsInEmptyState = emptyState.querySelectorAll("svg");
    svgsInEmptyState.forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
    const emptyStateScope = within(emptyState);
    expect(emptyStateScope.queryAllByRole("img")).toHaveLength(0);
    expect(emptyStateScope.queryAllByRole("graphics-symbol")).toHaveLength(0);
  });
});

describe("RemindersTab — delivery activity", () => {
  it("renders durable queued, sending, sent and failed outcomes", () => {
    renderTab({
      executions: [
        { ...executionBase, status: "queued", errorMessage: null },
        {
          ...executionBase,
          id: "c0000000-0000-4000-8000-000000000004",
          status: "sending",
          errorMessage: null,
        },
        {
          ...executionBase,
          id: "c0000000-0000-4000-8000-000000000005",
          status: "sent",
          sentAt: new Date("2026-05-07T10:01:00.000Z"),
          errorMessage: null,
        },
        { ...executionBase, id: "c0000000-0000-4000-8000-000000000006" },
      ],
    });

    const activity = screen.getByRole("region", {
      name: "Delivery activity",
    });
    expect(activity).toHaveTextContent("4 executions");
    expect(activity).toHaveTextContent("Queued");
    expect(activity).toHaveTextContent("Sending");
    expect(activity).toHaveTextContent("Sent");
    expect(activity).toHaveTextContent("Failed");
    expect(activity).toHaveTextContent("SMTP unavailable");
  });

  it("styles the table like the other admin tables: plain-case semibold headers, regular e-mail", () => {
    renderTab({ executions: [{ ...executionBase }] });

    const header = screen.getByRole("columnheader", { name: "Recipient" });
    expect(header).toHaveClass("font-semibold");
    expect(header.closest("thead")?.className).not.toContain("uppercase");
    const email = screen.getByRole("cell", {
      name: executionBase.recipientEmail,
    });
    expect(email).not.toHaveClass("font-medium");
  });
});

describe("RemindersTab — plain-language cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders each reminder as plain timing + recipient + next-send, no jargon", () => {
    renderTab();

    const row = screen.getByTestId(`policy-row-${policyDeadline.id}`);
    expect(row).toHaveTextContent("24 hours before deadline");
    expect(row).toHaveTextContent("Notifies leads who still owe a report");
    expect(row).toHaveTextContent("Next send: May 7, 2099, then every period");
    expect(row).not.toHaveTextContent("T-24h");
    expect(row).not.toHaveTextContent("lead-with-draft");

    const row2 = screen.getByTestId(`policy-row-${policyEscalation.id}`);
    expect(row2).toHaveTextContent("2 hours after deadline");
    expect(row2).toHaveTextContent(
      "Sends the department head a digest of late leads",
    );
    // Inactive policy → no upcoming send.
    expect(row2).toHaveTextContent("No upcoming sends");
    expect(row2).not.toHaveTextContent("escalation");
    expect(row2).not.toHaveTextContent("head-of-late");
  });

  it("shows 'No upcoming sends' for an active policy whose rules already fired", () => {
    renderTab({
      policies: [policyDeadline],
      derivedRulesByPolicyId: {
        [policyDeadline.id]: [
          { ...futureRule, fireAt: new Date("2000-01-01T00:00:00.000Z") },
        ],
      },
    });
    const row = screen.getByTestId(`policy-row-${policyDeadline.id}`);
    expect(row).toHaveTextContent("No upcoming sends");
    expect(row).not.toHaveTextContent("Next send:");
  });

  it("drops an elapsed next send when the admin searches without remounting", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2099-05-07T09:59:00.000Z"));
      renderTab();
      const row = screen.getByTestId(`policy-row-${policyDeadline.id}`);
      expect(row).toHaveTextContent("Next send: May 7, 2099");

      vi.setSystemTime(new Date("2099-05-07T10:01:00.000Z"));
      fireEvent.change(screen.getByLabelText(/Search reminders/i), {
        target: { value: "deadline" },
      });

      expect(screen.getByTestId(`policy-row-${policyDeadline.id}`)).toBe(row);
      expect(row).toHaveTextContent("No upcoming sends");
      expect(row).not.toHaveTextContent("Next send:");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(
    ["toggle", "remove"].flatMap((operation) =>
      [
        { settledIndex: 0, outcome: "success" },
        { settledIndex: 1, outcome: "success" },
        { settledIndex: 0, outcome: "error" },
        { settledIndex: 1, outcome: "error" },
      ].map((scenario) => ({ ...scenario, operation })),
    ),
  )(
    "keeps overlapping $operation requests independent when request $settledIndex settles with $outcome",
    async ({ settledIndex, outcome, operation }) => {
      const requests = [
        Promise.withResolvers<unknown>(),
        Promise.withResolvers<unknown>(),
      ];
      const untouchedPolicy = {
        ...policyDeadline,
        id: "b0000000-0000-4000-8000-000000000003",
      };
      const { captured } = renderTab({
        policies: [policyDeadline, policyEscalation, untouchedPolicy],
      });
      const mutation = expectDefined(
        captured[
          operation === "toggle" ? "admin.savePolicy" : "admin.removePolicy"
        ],
      ).mutationFn;
      mutation
        .mockImplementationOnce(() => expectDefined(requests[0]).promise)
        .mockImplementationOnce(() => expectDefined(requests[1]).promise);
      const policies = [policyDeadline, policyEscalation];
      const pendingIndex = settledIndex === 0 ? 1 : 0;
      const startRequest = (policy: AdminReminderPolicyView) => {
        fireEvent.click(screen.getByTestId(`${operation}-${policy.id}`));
        if (operation === "remove") {
          fireEvent.click(
            within(screen.getByRole("alertdialog")).getByRole("button", {
              name: "Delete",
            }),
          );
        }
      };
      const assertRowBusy = (
        policy: AdminReminderPolicyView,
        busy: boolean,
      ) => {
        for (const action of ["toggle", "edit", "remove"]) {
          const control = screen.getByTestId(`${action}-${policy.id}`);
          if (busy) expect(control).toBeDisabled();
          else expect(control).toBeEnabled();
        }
      };

      try {
        startRequest(policyDeadline);
        await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
        startRequest(policyEscalation);
        await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));

        assertRowBusy(policyDeadline, true);
        assertRowBusy(policyEscalation, true);
        assertRowBusy(untouchedPolicy, false);

        await act(async () => {
          const request = expectDefined(requests[settledIndex]);
          if (outcome === "error") request.reject(new Error("Save failed"));
          else request.resolve(undefined);
          await Promise.allSettled([request.promise]);
        });
        await waitFor(
          () => assertRowBusy(expectDefined(policies[settledIndex]), false),
          { timeout: 1000 },
        );
        assertRowBusy(expectDefined(policies[pendingIndex]), true);
        assertRowBusy(untouchedPolicy, false);

        await act(async () => {
          expectDefined(requests[pendingIndex]).resolve(undefined);
          await expectDefined(requests[pendingIndex]).promise;
        });
        await waitFor(
          () => {
            assertRowBusy(policyDeadline, false);
            assertRowBusy(policyEscalation, false);
          },
          { timeout: 1000 },
        );
      } finally {
        await act(async () => {
          for (const request of requests) request.resolve(undefined);
          await Promise.allSettled(requests.map((request) => request.promise));
        });
      }
    },
  );

  it("toggles a reminder on/off via the existing save mutation", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(screen.getByTestId(`toggle-${policyDeadline.id}`));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(savePolicyEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      ...policyDeadline,
      active: false,
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Reminder updated"),
    );
  });

  it("toggles an INACTIVE reminder back on (proves the flip, not a constant)", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    // policyEscalation is active:false → toggling must write active=true.
    await user.click(screen.getByTestId(`toggle-${policyEscalation.id}`));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(savePolicyEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      ...policyEscalation,
      active: true,
    });
  });

  it("gates next-send on the active flag even when a future rule exists", () => {
    // Inactive policy WITH an upcoming rule must still read "No upcoming sends".
    renderTab({
      policies: [policyEscalation],
      derivedRulesByPolicyId: {
        [policyEscalation.id]: [
          { ...futureRule, policyId: policyEscalation.id },
        ],
      },
    });
    const row = screen.getByTestId(`policy-row-${policyEscalation.id}`);
    expect(row).toHaveTextContent("No upcoming sends");
    expect(row).not.toHaveTextContent("Next send:");
  });

  it("picks the earliest future rule for the next-send line", () => {
    renderTab({
      policies: [policyDeadline],
      derivedRulesByPolicyId: {
        [policyDeadline.id]: [
          {
            ...futureRule,
            fireAt: new Date("2099-05-07T10:00:00.000Z"),
          },
          {
            ...futureRule,
            fireAt: new Date("2098-03-02T10:00:00.000Z"),
          },
        ],
      },
    });
    const row = screen.getByTestId(`policy-row-${policyDeadline.id}`);
    expect(row).toHaveTextContent("Next send: Mar 2, 2098, then every period");
    expect(row).not.toHaveTextContent("2099");
  });
});

describe("RemindersTab — add / edit form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only the open form when there are no reminders", async () => {
    const user = userEvent.setup();
    renderTab({ policies: [], derivedRulesByPolicyId: {} });

    expect(screen.getByTestId("policy-form")).toBeInTheDocument();
    expect(screen.getByTestId("new-policy-button")).toBeDisabled();
    expect(screen.queryByTestId("reminders-empty-state")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /create first reminder/i }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByTestId("policy-form")).toBeNull();
    expect(screen.getByTestId("reminders-empty-state")).toHaveTextContent(
      /No reminders yet/i,
    );
    expect(
      screen.getByRole("button", { name: /create first reminder/i }),
    ).toBeInTheDocument();
  });

  it("opens the form on 'New Reminder' and submits the deadline→leads preset", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    const newReminderButton = screen.getByTestId("new-policy-button");
    expect(newReminderButton).not.toBeDisabled();
    await user.click(newReminderButton);
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    await user.click(screen.getByTestId("policy-save-button"));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const arg = savePolicyEntry.mutationFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(arg.kind).toBe("deadline");
    expect(arg.audience).toBe("lead-with-draft");
    expect(arg.offsetMinutes).toBe(-1440);
    expect(arg.timezone).toBe("Europe/Moscow");
    expect(arg.active).toBe(true);
    expect(arg.validUntil).toBeNull();
    expect(arg.validFrom).toBeInstanceOf(Date);
    expect(typeof arg.id).toBe("string");
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Reminder created"),
    );
  });

  it("does not reset a modified auto-open draft from the disabled header action", async () => {
    const user = userEvent.setup();
    renderTab({ policies: [], derivedRulesByPolicyId: {} });

    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.clear(offsetInput);
    await user.type(offsetInput, "3");
    expect(offsetInput).toHaveValue(3);

    const newReminderButton = screen.getByTestId("new-policy-button");
    expect(newReminderButton).toBeDisabled();
    await user.click(newReminderButton);

    expect(screen.getByTestId("policy-form")).toBeInTheDocument();
    expect(offsetInput).toHaveValue(3);
  });

  it("locks the submitted reminder draft until its save succeeds", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    const pendingSave = Promise.withResolvers<unknown>();
    savePolicyEntry.mutationFn.mockReturnValue(pendingSave.promise);

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.click(screen.getByTestId("policy-save-button"));
    await waitFor(() =>
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledOnce(),
    );

    await waitFor(() => expect(offsetInput).toBeDisabled());
    expect(screen.getByLabelText(/Reminder type/i)).toBeDisabled();
    expect(screen.getByLabelText(/reminder offset unit/i)).toBeDisabled();
    expect(screen.getByLabelText(/before or after deadline/i)).toBeDisabled();
    expect(screen.getByLabelText(/Timezone/i)).toBeDisabled();
    expect(screen.getByLabelText(/Valid from/i)).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeDisabled();
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    expect(screen.getByTestId("new-policy-button")).toBeDisabled();

    await user.click(screen.getByTestId(`edit-${policyEscalation.id}`));
    expect(offsetInput).toHaveValue(24);

    pendingSave.resolve(undefined);
    await waitFor(() =>
      expect(screen.queryByTestId("policy-form")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId(`edit-${policyDeadline.id}`)).toHaveFocus();
  });

  it("re-enables the same reminder draft when its save fails", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({ policies: [policyDeadline] });
    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    const pendingSave = Promise.withResolvers<unknown>();
    savePolicyEntry.mutationFn.mockReturnValue(pendingSave.promise);

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.clear(offsetInput);
    await user.type(offsetInput, "3");
    await user.click(screen.getByTestId("policy-save-button"));
    await waitFor(() => expect(offsetInput).toBeDisabled());

    pendingSave.reject(new Error("save failed"));

    await waitFor(() => expect(offsetInput).not.toBeDisabled());
    expect(offsetInput).toHaveValue(3);
    expect(screen.getByTestId("policy-save-button")).not.toBeDisabled();
    expect(screen.getByTestId("new-policy-button")).not.toBeDisabled();
    expect(toastError).toHaveBeenCalledWith("save failed");
  });

  it("keeps the editor locked until its own save succeeds after a faster row toggle", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    const editorSave = Promise.withResolvers<unknown>();
    const toggleSave = Promise.withResolvers<unknown>();
    savePolicyEntry.mutationFn
      .mockReturnValueOnce(editorSave.promise)
      .mockReturnValueOnce(toggleSave.promise);

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.click(screen.getByTestId("policy-save-button"));
    await waitFor(() => expect(offsetInput).toBeDisabled());

    await user.click(screen.getByTestId(`toggle-${policyEscalation.id}`));
    await waitFor(() =>
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(2),
    );
    toggleSave.resolve(undefined);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenLastCalledWith("Reminder updated");
    expect(offsetInput).toBeDisabled();
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    expect(screen.getByTestId("new-policy-button")).toBeDisabled();
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    editorSave.resolve(undefined);

    await waitFor(() =>
      expect(screen.queryByTestId("policy-form")).not.toBeInTheDocument(),
    );
    expect(toastSuccess).toHaveBeenCalledTimes(2);
    expect(toastSuccess).toHaveBeenLastCalledWith("Reminder updated");
    expect(screen.getByTestId(`edit-${policyDeadline.id}`)).toHaveFocus();
  });

  it("retains the editor draft when its save fails after a faster row toggle", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();
    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    const editorSave = Promise.withResolvers<unknown>();
    const toggleSave = Promise.withResolvers<unknown>();
    savePolicyEntry.mutationFn
      .mockReturnValueOnce(editorSave.promise)
      .mockReturnValueOnce(toggleSave.promise);

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.clear(offsetInput);
    await user.type(offsetInput, "3");
    await user.click(screen.getByTestId("policy-save-button"));
    await waitFor(() => expect(offsetInput).toBeDisabled());

    await user.click(screen.getByTestId(`toggle-${policyEscalation.id}`));
    await waitFor(() =>
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(2),
    );
    toggleSave.resolve(undefined);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(offsetInput).toBeDisabled();
    expect(screen.getByTestId("new-policy-button")).toBeDisabled();

    editorSave.reject(new Error("editor save failed"));

    await waitFor(() => expect(offsetInput).toBeEnabled());
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();
    expect(offsetInput).toHaveValue(3);
    expect(screen.getByTestId("policy-save-button")).toBeEnabled();
    expect(screen.getByTestId("new-policy-button")).toBeEnabled();
    expect(toastError).toHaveBeenCalledWith("editor save failed");
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("seeds the preset selector from the policy on Edit", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId(`edit-${policyEscalation.id}`));
    const typeSelect =
      screen.getByLabelText<HTMLSelectElement>(/Reminder type/i);
    expect(typeSelect.value).toBe("escalation-head");
  });

  it("keeps an edited draft mounted when search hides its reminder", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    expect(
      screen.queryByTestId(`policy-row-${policyDeadline.id}`),
    ).not.toBeInTheDocument();
    const form = screen.getByTestId("policy-form");
    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.clear(offsetInput);

    await user.type(screen.getByLabelText(/Search reminders/i), "head");

    expect(screen.getByTestId("policy-form")).toBe(form);
    expect(screen.getByLabelText(/reminder offset amount/i)).toBe(offsetInput);
    expect(offsetInput.value).toBe("");
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
  });

  it("returns focus to the edit trigger after cancelling the inline editor", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.getByTestId(`edit-${policyDeadline.id}`)).toHaveFocus(),
    );
  });

  it("clearing the offset magnitude does not silently become 0", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({ policies: [policyDeadline] });

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));

    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.clear(offsetInput);

    // The raw empty value is kept and an inline error surfaces; Save stays
    // blocked until a deliberate magnitude is entered (no fabricated 0).
    expect(offsetInput.value).toBe("");
    expect(offsetInput).toHaveAttribute(
      "aria-describedby",
      "policy-offset-minutes-error",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a non-negative whole number",
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "policy-offset-minutes-error",
    );
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    expect(
      expectDefined(captured["admin.savePolicy"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("keeps Save blocked when the offset unit changes after the magnitude is cleared", async () => {
    const user = userEvent.setup();
    renderTab({ policies: [policyDeadline] });

    await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
    const offsetInput = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    await user.clear(offsetInput);
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();

    await user.selectOptions(
      screen.getByLabelText(/reminder offset unit/i),
      "days",
    );
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
  });

  it.each(["-1", "1.5"])(
    "explains the whole-number rule for offset %j",
    async (raw) => {
      const user = userEvent.setup();
      const { captured } = renderTab({ policies: [policyEscalation] });
      await user.click(screen.getByTestId(`edit-${policyEscalation.id}`));
      const amount = screen.getByLabelText<HTMLInputElement>(
        /reminder offset amount/i,
      );
      await user.clear(amount);
      if (raw) await user.type(amount, raw);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a non-negative whole number",
      );
      expect(screen.getByTestId("policy-save-button")).toBeDisabled();
      expect(
        expectDefined(captured["admin.savePolicy"]).mutationFn,
      ).not.toHaveBeenCalled();
      await user.clear(amount);
      await user.type(amount, "3");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByTestId("policy-save-button")).toBeEnabled();
    },
  );

  it("preserves invalid offset draft through normalized units and direction until valid retype", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({ policies: [policyEscalation] });
    await user.click(screen.getByTestId(`edit-${policyEscalation.id}`));
    const amount = screen.getByLabelText<HTMLInputElement>(
      /reminder offset amount/i,
    );
    expect(amount).toHaveValue(2);
    await user.clear(amount);
    for (const unit of ["days", "minutes", "hours"]) {
      await user.selectOptions(
        screen.getByLabelText(/reminder offset unit/i),
        unit,
      );
      await user.selectOptions(
        screen.getByLabelText(/before or after deadline/i),
        "before",
      );
      expect(amount.value).toBe("");
      expect(amount).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    }
    expect(
      expectDefined(captured["admin.savePolicy"]).mutationFn,
    ).not.toHaveBeenCalled();
    await user.type(amount, "4");
    expect(amount).toHaveValue(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("policy-save-button")).toBeEnabled();
    await user.click(screen.getByTestId("policy-save-button"));
    await waitFor(() =>
      expect(
        expectDefined(captured["admin.savePolicy"]).mutationFn,
      ).toHaveBeenCalledTimes(1),
    );
  });

  it.each(["Cancel", "Save changes"])(
    "restores search focus after %s when edited row is filtered out",
    async (action) => {
      const user = userEvent.setup();
      const { captured } = renderTab();
      await user.click(screen.getByTestId(`edit-${policyDeadline.id}`));
      const search = screen.getByLabelText(/Search reminders/i);
      await user.type(search, "head");
      await user.click(screen.getByRole("button", { name: action }));
      await waitFor(() =>
        expect(screen.queryByTestId("policy-form")).not.toBeInTheDocument(),
      );
      expect(
        screen.queryByTestId(`edit-${policyDeadline.id}`),
      ).not.toBeInTheDocument();
      expect(search).toHaveFocus();
      expect(
        expectDefined(captured["admin.savePolicy"]).mutationFn,
      ).toHaveBeenCalledTimes(action === "Cancel" ? 0 : 1);
    },
  );

  it("never persists the invalid deadline→head-of-late pair from a fresh form", async () => {
    const user = userEvent.setup();
    // Org default audience no longer reaches the pairing. A fresh reminder
    // always starts from a valid preset.
    const { captured } = renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
    });

    await user.click(screen.getByTestId("policy-save-button"));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const arg = savePolicyEntry.mutationFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(arg.kind).toBe("deadline");
    expect(arg.audience).toBe("lead-with-draft");
    expect(`${arg.kind as string}→${arg.audience as string}`).not.toBe(
      "deadline→head-of-late",
    );
  });

  it("prefills the Advanced timezone from org defaults on a fresh form", () => {
    renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
      defaultTimezone: "Asia/Yekaterinburg",
    });
    const tzSelect = screen.getByLabelText<HTMLSelectElement>(/Timezone/i);
    expect(tzSelect.value).toBe("Asia/Yekaterinburg");
  });

  it("keeps timezone + validity inside a default-collapsed Advanced section", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    const advanced = screen.getByTestId("reminder-advanced");
    expect(advanced).not.toHaveAttribute("open");
    // The controls still exist in the DOM (just collapsed).
    expect(within(advanced).getByLabelText(/Timezone/i)).toBeInTheDocument();
    expect(within(advanced).getByLabelText(/Valid from/i)).toBeInTheDocument();
  });

  it("disables Save with the reversed-range reason when validUntil < validFrom", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
    });

    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: /forever \(no end date\)/i }),
    );
    const validFrom = screen.getByLabelText<HTMLInputElement>(/Valid from/i);
    const validUntil = screen.getByLabelText<HTMLInputElement>(
      /^policy-valid-until$|^Valid until$/i,
    );

    const fromIso = validFrom.value;
    const before = new Date(fromIso);
    before.setUTCDate(before.getUTCDate() - 1);
    const beforeIso = before.toISOString().slice(0, 10);

    await user.clear(validUntil);
    await user.type(validUntil, beforeIso);

    expect(screen.getByTestId("policy-validity-hint")).toHaveTextContent(
      "End date must be on or after start date",
    );
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    expect(
      expectDefined(captured["admin.savePolicy"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("allows a same-day validity window (inclusive end)", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
    });

    await user.click(
      screen.getByRole("checkbox", { name: /forever \(no end date\)/i }),
    );
    const validFrom = screen.getByLabelText<HTMLInputElement>(/Valid from/i);
    const validUntil = screen.getByLabelText<HTMLInputElement>(
      /^policy-valid-until$|^Valid until$/i,
    );

    await user.clear(validUntil);
    await user.type(validUntil, validFrom.value);

    expect(screen.queryByTestId("policy-validity-hint")).toBeNull();
    await user.click(screen.getByTestId("policy-save-button"));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const arg = savePolicyEntry.mutationFn.mock.calls[0]?.[0] as {
      validFrom: Date;
      validUntil: Date | null;
    };
    expect(arg.validUntil).toEqual(arg.validFrom);
  });

  it("disables Save with the missing-start reason when Valid from is cleared", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
    });

    const validFrom = screen.getByLabelText<HTMLInputElement>(/Valid from/i);
    await user.clear(validFrom);

    expect(validFrom.value).toBe("");
    expect(screen.getByTestId("policy-validity-hint")).toHaveTextContent(
      "Start date is required",
    );
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    expect(
      expectDefined(captured["admin.savePolicy"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("disables Save with the missing-end reason when forever is unchecked", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      policies: [],
      derivedRulesByPolicyId: {},
    });

    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: /forever \(no end date\)/i }),
    );
    const validUntil = screen.getByLabelText<HTMLInputElement>(
      /^policy-valid-until$|^Valid until$/i,
    );

    // The end-date input stays empty — no fabricated today — so Save stays
    // blocked until the admin deliberately picks a date.
    expect(validUntil.value).toBe("");
    expect(screen.getByTestId("policy-validity-hint")).toHaveTextContent(
      "End date is required",
    );
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
    expect(
      expectDefined(captured["admin.savePolicy"]).mutationFn,
    ).not.toHaveBeenCalled();
  });
});

describe("RemindersTab — permanent delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("outlines Remove like the other destructive capsules (R89)", () => {
    renderTab();
    expect(screen.getByTestId(`remove-${policyDeadline.id}`)).not.toHaveClass(
      "border-transparent",
    );
  });

  it("warns that delete is permanent and calls removePolicy", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(screen.getByTestId(`remove-${policyDeadline.id}`));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Delete reminder\?/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/permanently deletes the reminder/i),
    ).toBeInTheDocument();
    // Preview uses the plain timing + recipient line, not the jargon headline.
    expect(
      within(dialog).getByText(/24 hours before deadline/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    const removePolicyEntry = expectDefined(captured["admin.removePolicy"]);
    await waitFor(() => {
      expect(removePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(removePolicyEntry.mutationFn.mock.calls[0]?.[0]).toEqual({
      id: policyDeadline.id,
    });
    expect(toastSuccess).toHaveBeenCalledWith("Reminder removed");
  });
});

describe("RemindersTab — copy says 'Reminder', never 'policy'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Reminder copy across shell, form and dialog — never 'policy'", async () => {
    const user = userEvent.setup();
    renderTab();

    expect(screen.getByText("Reminders")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /New Reminder/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Search reminders/i)).toBeInTheDocument();

    // Mount the copy-heavy surfaces too: the add form and the delete dialog.
    await user.click(screen.getByTestId("new-policy-button"));
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();
    await user.click(screen.getByTestId(`remove-${policyDeadline.id}`));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Visible text — no "polic" anywhere on screen (testids are not text).
    expect(document.body.textContent.toLowerCase()).not.toContain("polic");

    // User-facing attribute copy (aria-label / placeholder / title) is read by
    // assistive tech but excluded from textContent — sweep it too.
    const attrCopy = Array.from(document.body.querySelectorAll("*"))
      .flatMap((el) => [
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
        el.getAttribute("title"),
      ])
      .filter((v): v is string => v !== null)
      .join(" ")
      .toLowerCase();
    expect(attrCopy).not.toContain("polic");
  });

  it("uses 'reminder' copy in the empty state, never 'policy'", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const empty = screen.getByTestId("reminders-empty-state");
    expect(empty.textContent.toLowerCase()).not.toContain("polic");
  });
});
