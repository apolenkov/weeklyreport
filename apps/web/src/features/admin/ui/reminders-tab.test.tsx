/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts (as HTMLInputElement / HTMLSelectElement) are flagged redundant by ESLint's type-aware program, but the app tsconfig requires them for .value/.checked/.options access (TS2339) */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type {
  MockPeriod,
  MockReminder,
  MockReminderPolicy,
} from "../model/admin-types";
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

// A legacy pairing the two presets do not cover (`follow_up` is never offered),
// so the form must surface it read-only as "Custom" and preserve it on save.
const policyCustom: MockReminderPolicy = {
  id: "b0000000-0000-4000-8000-000000000003",
  kind: "follow_up",
  offsetMinutes: -2880, // 2 days before
  timezone: "Europe/Moscow",
  audience: "lead-with-draft",
  active: true,
  validFrom: new Date("2026-05-01T00:00:00.000Z"),
  validUntil: null,
};

// Far-future fire time so the next-send line is deterministic whatever day the
// suite runs.
const futureRule: MockReminder = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Deadline reminder",
  description: "auto",
  active: true,
  kind: "deadline",
  fireAt: new Date("2099-05-07T10:00:00.000Z"),
  timezone: "Europe/Moscow",
  version: 1,
  reportId: period.id,
  policyId: policyDeadline.id,
};

function renderTab(args?: {
  policies?: MockReminderPolicy[];
  derivedRulesByPolicyId?: Record<string, MockReminder[]>;
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
      defaultTimezone={args?.defaultTimezone ?? "Europe/Moscow"}
    />,
    { wrapper: Wrapper },
  );
  return { ...result, captured };
}

describe("RemindersTab — empty-state bell SVG a11y", () => {
  it("bell SVG in empty state has aria-hidden='true'", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    const emptyState = screen.getByTestId("reminders-empty-state");
    const svg = emptyState.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("bell SVG in empty state is not exposed to assistive technology", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
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

  it("toggles a reminder on/off via the existing save mutation", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(screen.getByTestId(`toggle-${policyDeadline.id}`));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const arg = savePolicyEntry.mutationFn.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    expect(arg?.id).toBe(policyDeadline.id);
    // policyDeadline is active → toggle writes active=false.
    expect(arg?.active).toBe(false);
    expect(arg?.kind).toBe("deadline");
    expect(arg?.audience).toBe("lead-with-draft");
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
    const arg = savePolicyEntry.mutationFn.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    expect(arg?.id).toBe(policyEscalation.id);
    expect(arg?.active).toBe(true);
    expect(arg?.kind).toBe("escalation");
    expect(arg?.audience).toBe("head-of-late");
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
            id: "rule-late",
            fireAt: new Date("2099-05-07T10:00:00.000Z"),
          },
          {
            ...futureRule,
            id: "rule-early",
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

  it("shows empty-state copy and an open form when there are no reminders", () => {
    renderTab({ policies: [], derivedRulesByPolicyId: {} });
    expect(screen.getByTestId("reminders-empty-state")).toHaveTextContent(
      /No reminders yet/i,
    );
    expect(
      screen.getByRole("button", { name: /create first reminder/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("policy-form")).toBeInTheDocument();
  });

  it("opens the form on 'New Reminder' and submits the deadline→leads preset", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await user.click(screen.getByTestId("new-policy-button"));
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

  it("seeds the preset selector from the policy on Edit", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId(`edit-${policyEscalation.id}`));
    const typeSelect = screen.getByLabelText(
      /Reminder type/i,
    ) as HTMLSelectElement;
    expect(typeSelect.value).toBe("escalation-head");
  });

  it("renders a legacy pairing as read-only 'Custom' and preserves kind/audience on save", async () => {
    const user = userEvent.setup();
    const { captured } = renderTab({
      policies: [policyCustom],
      derivedRulesByPolicyId: { [policyCustom.id]: [] },
    });

    await user.click(screen.getByTestId(`edit-${policyCustom.id}`));
    expect(screen.getByTestId("policy-type-custom")).toHaveTextContent(
      "Custom",
    );

    // Edit only the timing: flip 48h before → 48h after the deadline.
    await user.selectOptions(
      screen.getByLabelText(/before or after deadline/i),
      "after",
    );

    await user.click(screen.getByTestId("policy-save-button"));

    const savePolicyEntry = expectDefined(captured["admin.savePolicy"]);
    await waitFor(() => {
      expect(savePolicyEntry.mutationFn).toHaveBeenCalledTimes(1);
    });
    const arg = savePolicyEntry.mutationFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    // Stored kind/audience are written back unchanged (never coerced).
    expect(arg.kind).toBe("follow_up");
    expect(arg.audience).toBe("lead-with-draft");
    expect(arg.offsetMinutes).toBe(2880); // 48 hours after
  });

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
    const tzSelect = screen.getByLabelText(/Timezone/i) as HTMLSelectElement;
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

  it("disables Save and shows a hint when validUntil < validFrom", async () => {
    const user = userEvent.setup();
    renderTab({ policies: [], derivedRulesByPolicyId: {} });

    expect(screen.getByTestId("policy-form")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: /forever \(no end date\)/i }),
    );
    const validFrom = screen.getByLabelText(/Valid from/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(
      /^policy-valid-until$|^Valid until$/i,
    ) as HTMLInputElement;

    const fromIso = validFrom.value;
    const before = new Date(fromIso);
    before.setUTCDate(before.getUTCDate() - 1);
    const beforeIso = before.toISOString().slice(0, 10);

    await user.clear(validUntil);
    await user.type(validUntil, beforeIso);

    expect(screen.getByTestId("policy-validity-hint")).toBeInTheDocument();
    expect(screen.getByTestId("policy-save-button")).toBeDisabled();
  });
});

describe("RemindersTab — permanent delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const empty = screen.getByTestId("reminders-empty-state");
    expect(empty.textContent.toLowerCase()).not.toContain("polic");
  });
});
