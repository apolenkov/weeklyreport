import type { AppSettings, OrganizationPublic } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { RemindersSubTab } from "../../admin/ui/reminders/settings-reminders-sub-tab";
import { PeriodsSubTab } from "../../period/ui/settings-periods-sub-tab";
import { IdentitySubTab } from "./settings-identity-sub-tab";
import { NotificationsSubTab } from "./settings-notifications-sub-tab";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const organization: OrganizationPublic = {
  shortName: "A",
  fullName: "Organization A",
};
const settings: AppSettings = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: "a@example.com",
};

const forms = [
  {
    name: "Identity",
    render: (_settings: AppSettings) => <IdentitySubTab />,
    field: /short name/i,
    save: /save organization identity/i,
    value: "A1",
    replacement: "B",
    mutation: "admin.updateOrganization",
    input: { shortName: "A1", fullName: "Organization A" },
    echo: {},
  },
  {
    name: "Notifications",
    render: (value: AppSettings) => (
      <NotificationsSubTab serverSettings={value} />
    ),
    field: /notification from-email/i,
    save: /save notification settings/i,
    value: "a1@example.com",
    replacement: "b@example.com",
    mutation: "admin.updateSettings",
    input: { notificationFromEmail: "a1@example.com" },
    echo: { notificationFromEmail: "a1@example.com" },
  },
  {
    name: "Periods",
    render: (value: AppSettings) => <PeriodsSubTab serverSettings={value} />,
    field: /period length/i,
    save: /save period policy/i,
    value: 14,
    replacement: "15",
    mutation: "admin.updateSettings",
    input: { periodLengthDays: 14 },
    echo: { periodLengthDays: 14 },
  },
  {
    name: "Reminders",
    render: (value: AppSettings) => <RemindersSubTab serverSettings={value} />,
    field: /default timezone/i,
    save: /save reminder defaults/i,
    value: "Asia/Yekaterinburg",
    replacement: "Europe/Moscow",
    mutation: "admin.updateSettings",
    input: { defaultTimezone: "Asia/Yekaterinburg" },
    echo: { defaultTimezone: "Asia/Yekaterinburg" },
  },
];

function mountForm(form: (typeof forms)[number]) {
  const pending = Promise.withResolvers<void>();
  const { proxy, captured } = createMockTRPC([
    { path: ["admin", "getOrganization"], query: organization },
    { path: ["admin", "updateOrganization"], mutation: true },
    { path: ["admin", "updateSettings"], mutation: true },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
    { path: ["auth", "me"] },
    { path: ["org", "getPublic"] },
    { path: ["weeklyReport", "get"] },
  ]);
  const mutation = expectDefined(captured[form.mutation]);
  mutation.mutationFn.mockImplementation(() => pending.promise);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const rendered = render(form.render(settings), { wrapper: Wrapper });
  return { ...rendered, pending, mutation };
}

async function editControl(
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  value: string,
) {
  if (control instanceof HTMLSelectElement) {
    await user.selectOptions(control, value);
  } else {
    await user.clear(control);
    await user.type(control, value);
  }
}

describe.each(forms)("$name pending draft", (form) => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["success", "failure"] as const)(
    "locks submitted input until %s and then releases it",
    async (outcome) => {
      const harness = mountForm(form);
      const user = userEvent.setup();
      const control = await screen.findByLabelText(form.field);
      await editControl(user, control, String(form.value));
      await user.click(screen.getByRole("button", { name: form.save }));
      await waitFor(() => expect(harness.mutation.calls).toHaveLength(1));
      expect(harness.mutation.calls[0]).toMatchObject(form.input);
      expect(control).toBeDisabled();
      expect(screen.getByRole("button", { name: form.save })).toBeDisabled();

      if (control instanceof HTMLSelectElement) {
        await user.selectOptions(control, form.replacement);
      } else {
        await user.type(control, form.replacement);
      }
      expect(control).toHaveValue(form.value);
      expect(harness.mutation.calls).toHaveLength(1);

      await act(async () => {
        if (outcome === "success") harness.pending.resolve();
        else harness.pending.reject(new Error("Save failed"));
        await harness.pending.promise.catch(() => undefined);
      });
      await waitFor(() => expect(control).toBeEnabled());
      if (outcome === "success") {
        harness.rerender(form.render({ ...settings, ...form.echo }));
      }
      expect(control).toHaveValue(form.value);
      await editControl(user, control, form.replacement);
      expect(control).toHaveValue(
        typeof form.value === "number"
          ? Number(form.replacement)
          : form.replacement,
      );
      expect(harness.mutation.calls).toHaveLength(1);
    },
  );
});

describe("Notifications — shared email admission", () => {
  const notifications = expectDefined(
    forms.find((form) => form.name === "Notifications"),
  );
  const email254 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(56)}.test`;
  const email255 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.test`;

  it.each([
    { name: "255-character email", value: email255 },
    { name: "consecutive local dots", value: "name..last@example.test" },
  ])("rejects $name before mutation", async ({ value }) => {
    const harness = mountForm(notifications);
    const user = userEvent.setup();
    const field = await screen.findByLabelText(/notification from-email/i);
    await editControl(user, field, value);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "Enter a valid email or leave the field empty.",
    );
    const save = screen.getByRole("button", {
      name: /save notification settings/i,
    });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(harness.mutation.calls).toHaveLength(0);
  });

  it.each([
    { name: "254-character email", value: email254, expected: email254 },
    {
      name: "ordinary trimmed address",
      value: "  owner@example.test  ",
      expected: "owner@example.test",
    },
    { name: "empty clear", value: "", expected: null },
    { name: "whitespace clear", value: " ".repeat(3), expected: null },
  ])(
    "accepts $name and preserves the wire payload",
    async ({ value, expected }) => {
      const harness = mountForm(notifications);
      const user = userEvent.setup();
      const field = await screen.findByLabelText(/notification from-email/i);
      await user.clear(field);
      if (value !== "") await user.type(field, value);
      expect(field).toHaveAttribute("aria-invalid", "false");
      await user.click(
        screen.getByRole("button", { name: /save notification settings/i }),
      );
      await waitFor(() =>
        expect(harness.mutation.calls).toEqual([
          { notificationFromEmail: expected },
        ]),
      );
      await act(async () => {
        harness.pending.resolve();
        await harness.pending.promise;
      });
    },
  );
});
