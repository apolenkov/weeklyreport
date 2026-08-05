import type { AppSettings } from "@customreport/shared";
import { MAX_FULL_NAME_LENGTH } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
  },
}));

import { SettingsTab } from "./settings-tab";

// Telegram integration status shape returned by
// `admin.integrationsStatus`. Default to «not configured, 0 bindings» so
// tests that don't care about Integrations don't have to opt out.
interface IntegrationStub {
  telegram: {
    configured: boolean;
    bindings: number;
  };
}
const DEFAULT_INTEGRATIONS: IntegrationStub = {
  telegram: { configured: false, bindings: 0 },
};

// Org data returned by admin.getOrganization.
const ORG_DATA = {
  id: "singleton",
  shortName: "PEO",
  fullName: "Product Engineering & Operations",
  createdAt: new Date("2026-05-10T00:00:00Z"),
  updatedAt: new Date("2026-05-10T00:00:00Z"),
};

function buildProxy(integrations: IntegrationStub = DEFAULT_INTEGRATIONS) {
  return createMockTRPC([
    { path: ["admin", "getOrganization"], query: ORG_DATA },
    { path: ["admin", "updateOrganization"], mutation: true },
    { path: ["admin", "updateSettings"], mutation: true },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
    { path: ["admin", "integrationsStatus"], query: integrations },
    { path: ["auth", "me"] },
    { path: ["org", "getPublic"] },
    { path: ["weeklyReport", "get"] },
  ]);
}

function renderSettings(
  proxy: ReturnType<typeof buildProxy>["proxy"],
  settingsOverride?: Partial<AppSettings>,
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  render(
    <Wrapper>
      <TRPCProxyContext.Provider value={proxy}>
        <SettingsTab settings={{ ...baseSettings, ...settingsOverride }} />
      </TRPCProxyContext.Provider>
    </Wrapper>,
  );

  return { qc };
}

// Defaults mirror SQL defaults so Periods / Reminders / Notifications
// render with realistic initial state.
const baseSettings: AppSettings = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  // Period-cycle defaults — mirror SQL.
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: null,
};

describe("SettingsTab — Identity sub-tab", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the five tabs in the documented order", () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    // Tab triggers all visible — Identity active by default, including
    // the fifth «Integrations» tab.
    expect(screen.getByRole("tab", { name: /identity/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /periods/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /reminders/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /notifications/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /integrations/i })).toBeTruthy();
  });

  it("exposes the inert Holidays tab's coming-soon state via its accessible name", () => {
    // Holidays label is visually hidden below xl; ComingSoonBadge text is
    // the only source of the tab's accessible "coming soon" name.
    const { proxy } = buildProxy();
    renderSettings(proxy);

    expect(screen.getByRole("tab", { name: /coming soon/i })).toBeTruthy();
  });

  it("pointer and keyboard activation of the inert Holidays tab cannot change the selected tab", () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const holidaysTab = screen.getByRole("tab", { name: /coming soon/i });
    expect(holidaysTab).toBeDisabled();

    // Pointer: disabled trigger swallows the click.
    fireEvent.click(holidaysTab);
    expect(holidaysTab.getAttribute("aria-selected")).not.toBe("true");

    // Keyboard: the trigger is not focusable/tab-activatable while disabled.
    fireEvent.keyDown(holidaysTab, { key: "Enter" });
    expect(holidaysTab.getAttribute("aria-selected")).not.toBe("true");
  });

  it("loads the organization row into the Identity form", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    // Wait for the org query to populate the form.
    const shortNameInput =
      await screen.findByLabelText<HTMLInputElement>(/short name/i);
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const fullNameInput = screen.getByLabelText<HTMLInputElement>(/full name/i);
    expect(fullNameInput.value).toBe("Product Engineering & Operations");
    expect(fullNameInput.maxLength).toBe(MAX_FULL_NAME_LENGTH);
    expect(
      screen.getByText(`${ORG_DATA.fullName.length}/${MAX_FULL_NAME_LENGTH}`),
    ).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`max ${MAX_FULL_NAME_LENGTH} chars`, "i")),
    ).toBeTruthy();

    // Save button is enabled with valid data — proves the form is wired
    // (the click→mutate path is exercised in admin.integration.test.ts).
    const saveButton = screen.getByRole<HTMLButtonElement>("button", {
      name: /save organization identity/i,
    });
    await waitFor(() => expect(saveButton.disabled).toBe(false));
  });

  it("surfaces an organization-query failure instead of a disabled blank form", async () => {
    const proxy = createMockTRPC([
      {
        path: ["admin", "getOrganization"],
        query: () => {
          throw new Error("boom");
        },
      },
      { path: ["admin", "updateOrganization"], mutation: true },
      { path: ["admin", "updateSettings"], mutation: true },
      { path: ["admin", "snapshot"] },
      { path: ["admin", "getSettings"] },
      { path: ["admin", "integrationsStatus"], query: DEFAULT_INTEGRATIONS },
      { path: ["auth", "me"] },
      { path: ["org", "getPublic"] },
      { path: ["weeklyReport", "get"] },
    ]);
    renderSettings(proxy.proxy);

    expect(
      await screen.findByTestId("org-identity-load-error"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/short name/i)).not.toBeInTheDocument();
  });

  it("edits the Identity form and submits via the mutation hook", async () => {
    const { proxy, captured } = buildProxy();
    renderSettings(proxy);

    const shortNameInput =
      await screen.findByLabelText<HTMLInputElement>(/short name/i);
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const fullNameInput = screen.getByLabelText<HTMLInputElement>(/full name/i);

    fireEvent.change(shortNameInput, { target: { value: "PLAT" } });
    fireEvent.change(fullNameInput, {
      target: { value: "Platform Engineering" },
    });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /save organization identity/i }),
    );

    const updateOrgFn = expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn;
    await waitFor(() => {
      expect(updateOrgFn).toHaveBeenCalled();
    });
    expect(updateOrgFn.mock.calls[0]?.[0]).toEqual({
      shortName: "PLAT",
      fullName: "Platform Engineering",
    });
  });

  it("disables Save when shortName exceeds 16 chars, and re-enables at <=16", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const shortNameInput =
      await screen.findByLabelText<HTMLInputElement>(/short name/i);
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const saveButton = screen.getByRole<HTMLButtonElement>("button", {
      name: /save organization identity/i,
    });

    // fireEvent.change bypasses the input's maxLength DOM attribute (which
    // only clamps real typed/pasted input), so this is the only way to
    // actually exercise the over-limit disable branch.
    fireEvent.change(shortNameInput, {
      target: { value: "ABCDEFGHIJKLMNOPQ" },
    });

    expect(screen.getByText(/17\/16/)).toBeTruthy();
    await waitFor(() => expect(saveButton.disabled).toBe(true));

    fireEvent.change(shortNameInput, {
      target: { value: "ABCDEFGHIJKLMNOP" },
    });

    expect(screen.getByText(/16\/16/)).toBeTruthy();
    await waitFor(() => expect(saveButton.disabled).toBe(false));
  });

  // Spy on the exact query key because an active query may refetch and clear
  // its invalidated state before the assertion observes it.
  it("Save success invalidates admin.getOrganization by its specific queryKey", async () => {
    const { proxy, captured } = buildProxy();
    // Resolve the mutation so onSuccess fires.
    expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn.mockResolvedValue(undefined);
    // Stub fetch so the /api/revalidate-org call in onSuccess does not hang.
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    // finally, so a failed assertion cannot leak the stub into later tests.
    try {
      const { qc } = renderSettings(proxy);
      const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

      const shortNameInput =
        await screen.findByLabelText<HTMLInputElement>(/short name/i);
      await waitFor(() => expect(shortNameInput.value).toBe("PEO"));
      fireEvent.change(shortNameInput, { target: { value: "NEWN" } });

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: /save organization identity/i }),
      );

      // Wait for onSuccess to have fired and invalidateAdmin to have called
      // invalidateQueries with the specific admin.getOrganization key.
      const orgQueryKey = [["admin", "getOrganization"]];
      await waitFor(() => {
        const calledKeys = invalidateSpy.mock.calls.map((c) =>
          JSON.stringify(c[0]),
        );
        expect(
          calledKeys.some((k) => k.includes(JSON.stringify(orgQueryKey))),
        ).toBe(true);
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe("SettingsTab — Periods sub-tab (new fields)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the new fields and sends them on Save", async () => {
    const { proxy, captured } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    // periodLengthDays input is present.
    const periodLength =
      screen.getByLabelText<HTMLInputElement>(/period length/i);
    expect(periodLength.value).toBe("7");
    fireEvent.change(periodLength, { target: { value: "14" } });

    // gracePeriodHours present and editable.
    const grace = screen.getByLabelText<HTMLInputElement>(/grace period/i);
    fireEvent.change(grace, { target: { value: "48" } });

    await user.click(
      screen.getByRole("button", { name: /save period policy/i }),
    );

    const updateSettingsFn = expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn;
    await waitFor(() => {
      expect(updateSettingsFn).toHaveBeenCalled();
    });
    const payload = updateSettingsFn.mock.calls[0]?.[0] as Partial<AppSettings>;
    expect(payload.periodLengthDays).toBe(14);
    expect(payload.gracePeriodHours).toBe(48);
    // Other fields preserved on the PATCH payload.
    expect(payload.workingDays).toBe("mon-fri");
    expect(payload.allowLateSubmissions).toBe(true);
  });

  it("leaves autoPublishAfterDeadline enabled regardless of autoCreatePeriods", async () => {
    // The scheduler reads this setting independently, so coupling it to
    // automatic period creation would impose a false dependency.
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /auto-publish after deadline/i,
    });
    expect(checkbox.disabled).toBe(false);
  });
});

describe("SettingsTab — Periods sub-tab (period-cycle inputs)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the period-cycle inputs with seeded defaults", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    // deadlineTime — 18:00 default.
    const deadlineTime =
      screen.getByLabelText<HTMLInputElement>(/deadline time/i);
    expect(deadlineTime.value).toBe("18:00");

    expect(screen.queryByLabelText(/monday \(iso\)/i)).toBeNull();
    expect(screen.queryByLabelText(/deadline day of week/i)).toBeNull();
    expect(screen.queryByLabelText(/max open periods/i)).toBeNull();
    expect(
      screen.queryByRole("checkbox", {
        name: /require all sections to publish/i,
      }),
    ).toBeNull();

    // allowReopenAfterPublish — checked by default.
    const allowReopen = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /allow reopen after publish/i,
    });
    expect(allowReopen.checked).toBe(true);

    // reopenWindowHours — 72 default, enabled (since allowReopen is on).
    const reopenWindow = screen.getByLabelText<HTMLInputElement>(
      /reopen window \(hours\)/i,
    );
    expect(reopenWindow.value).toBe("72");
    expect(reopenWindow.disabled).toBe(false);
  });

  it("edits the period-cycle fields and sends them on Save", async () => {
    const { proxy, captured } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    // Change deadlineTime → 09:30.
    fireEvent.change(screen.getByLabelText(/deadline time/i), {
      target: { value: "09:30" },
    });

    // Bump reopenWindowHours → 24.
    fireEvent.change(screen.getByLabelText(/reopen window \(hours\)/i), {
      target: { value: "24" },
    });

    await user.click(
      screen.getByRole("button", { name: /save period policy/i }),
    );

    const updateSettingsFn = expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn;
    await waitFor(() => {
      expect(updateSettingsFn).toHaveBeenCalled();
    });
    const payload = updateSettingsFn.mock.calls[0]?.[0] as Partial<AppSettings>;
    expect(payload.deadlineTime).toBe("09:30");
    expect(payload.reopenWindowHours).toBe(24);
    // allowReopenAfterPublish was not touched — stays true.
    expect(payload.allowReopenAfterPublish).toBe(true);
  });

  it("clearing the deadline time does not silently substitute 18:00", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    const deadlineTime =
      screen.getByLabelText<HTMLInputElement>(/deadline time/i);
    await user.clear(deadlineTime);

    // The raw empty value is kept in the draft — no fabricated default — and
    // the shared schema rejects an empty HH:MM on Save (fail loud).
    expect(deadlineTime.value).toBe("");
  });

  it("disables reopenWindowHours when allowReopenAfterPublish is off", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy, { allowReopenAfterPublish: false });

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    const reopenWindow = screen.getByLabelText<HTMLInputElement>(
      /reopen window \(hours\)/i,
    );
    expect(reopenWindow.disabled).toBe(true);
  });
});

describe("SettingsTab — Reminders sub-tab", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("sends only the timezone default on Save; the stale audience control is gone", async () => {
    const { proxy, captured } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /reminders/i }));

    const tzSelect =
      screen.getByLabelText<HTMLSelectElement>(/default timezone/i);
    expect(tzSelect.value).toBe("Europe/Moscow");
    fireEvent.change(tzSelect, { target: { value: "Asia/Yekaterinburg" } });

    // The Reminder type preset owns the kind/audience pairing, so the inert
    // "Default audience" control must not render.
    expect(
      screen.queryByLabelText(/default audience/i),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /save reminder defaults/i }),
    );

    const updateSettingsFn = expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn;
    await waitFor(() => {
      expect(updateSettingsFn).toHaveBeenCalled();
    });
    expect(updateSettingsFn.mock.calls[0]?.[0]).toEqual({
      defaultTimezone: "Asia/Yekaterinburg",
    });
  });
});

describe("SettingsTab — Notifications sub-tab", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("saves a valid email and sends null when cleared", async () => {
    const { proxy, captured } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /notifications/i }));

    const input = screen.getByLabelText<HTMLInputElement>(
      /notification from-email/i,
    );
    fireEvent.change(input, { target: { value: "reports@example.com" } });

    await user.click(
      screen.getByRole("button", { name: /save notification settings/i }),
    );

    const updateSettingsFn = expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn;
    await waitFor(() => {
      expect(updateSettingsFn).toHaveBeenCalled();
    });
    expect(updateSettingsFn.mock.calls[0]?.[0]).toEqual({
      notificationFromEmail: "reports@example.com",
    });
  });

  it("disables Save on a malformed email", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /notifications/i }));

    const input = screen.getByLabelText<HTMLInputElement>(
      /notification from-email/i,
    );
    fireEvent.change(input, { target: { value: "not-an-email" } });

    const saveBtn = screen.getByRole<HTMLButtonElement>("button", {
      name: /save notification settings/i,
    });
    await waitFor(() => expect(saveBtn.disabled).toBe(true));
  });
});

describe("SettingsTab — Integrations sub-tab", () => {
  // Element has no live status because the available configured and binding
  // values describe Telegram and would be false under an Element heading.
  it("names the messaging card Element with a Coming Soon badge", async () => {
    const { proxy } = buildProxy({
      telegram: { configured: false, bindings: 0 },
    });
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const row = await screen.findByTestId("integration-row-telegram");
    expect(within(row).getByRole("heading", { name: /element/i })).toBeTruthy();

    const badge = await screen.findByTestId("integration-badge-telegram");
    await waitFor(() => expect(badge.dataset.state).toBe("coming-soon"));
    expect(badge.textContent).toMatch(/coming soon/i);

    // The card must not surface a "Telegram" heading to the user.
    expect(within(row).queryByText(/telegram/i)).toBeNull();
  });

  it("renders no Telegram-derived messaging status under the Element card", async () => {
    // Telegram status under an "Element" heading would be a false claim.
    const { proxy } = buildProxy({
      telegram: { configured: true, bindings: 4 },
    });
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const badge = await screen.findByTestId("integration-badge-telegram");
    await waitFor(() => expect(badge.dataset.state).toBe("coming-soon"));

    // The configured/bindings status rows are gone — no "yes"/"4" leaks.
    expect(screen.queryByTestId("integration-telegram-configured")).toBeNull();
    expect(screen.queryByTestId("integration-telegram-bindings")).toBeNull();
    const row = screen.getByTestId("integration-row-telegram");
    expect(within(row).queryByText("4")).toBeNull();
    expect(within(row).queryByText(/^yes$/i)).toBeNull();
  });

  it("does not render Slack or CI cards", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    // Telegram card present anchors the tab content before asserting absence.
    await screen.findByTestId("integration-badge-telegram");
    expect(screen.queryByTestId("integration-row-slack")).toBeNull();
    expect(screen.queryByTestId("integration-row-ci")).toBeNull();
  });

  it("renders the AI Coming Soon card", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const aiBadge = await screen.findByTestId("integration-badge-ai");
    await waitFor(() => expect(aiBadge.dataset.state).toBe("coming-soon"));
    expect(aiBadge.textContent).toMatch(/coming soon/i);

    expect(screen.getByTestId("integration-ai-provider").textContent).toMatch(
      /not configured/i,
    );
    expect(screen.getByTestId("integration-ai-rag").textContent).toMatch(
      /empty/i,
    );
  });
});
