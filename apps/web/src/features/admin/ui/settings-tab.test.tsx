/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts are required for value, checked, and options access under the app tsconfig. */
/**
 * SettingsTab Identity sub-tab test.
 *
 * Strategy mirrors jobs-tab.test.tsx: stub the tRPC proxy and intercept
 * `admin.getOrganization.queryOptions` / `admin.updateOrganization
 * .mutationOptions`. We assert the Save button drives the mutation with
 * the form values and the success toast fires.
 */

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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args) as unknown,
    error: (...args: unknown[]) => toastError(...args) as unknown,
    info: vi.fn(),
  },
}));

import type { MockSettings } from "../model/admin-types";
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

/**
 * Builds the tRPC proxy for SettingsTab tests using the shared factory.
 * Returns both the proxy and the captured mutation registry so tests can
 * assert against specific mutation calls.
 */
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

/**
 * Renders SettingsTab inside QueryClientProvider + TRPCProxyContext, returning
 * the QueryClient so tests can spy on invalidations.
 */
function renderSettings(
  proxy: ReturnType<typeof buildProxy>["proxy"],
  settingsOverride?: Partial<MockSettings>,
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

// MockSettings covers 9 fields beyond the base pair. Defaults here mirror
// the SQL defaults so the Periods / Reminders / Notifications sub-tabs
// render with realistic initial state.
const baseSettings: MockSettings = {
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
    // The Holidays trigger holds an inert span whose visible label is hidden
    // below xl. Its
    // coming-soon state reaches the tab's accessible name through the descendant
    // ComingSoonBadge text. Removing the redundant native title="Coming Soon"
    // must not strip that name — this locks it so the source scan has a runtime
    // companion.
    const { proxy } = buildProxy();
    renderSettings(proxy);

    expect(screen.getByRole("tab", { name: /coming soon/i })).toBeTruthy();
  });

  it("loads the organization row into the Identity form", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    // Wait for the org query to populate the form.
    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const fullNameInput = screen.getByLabelText(
      /full name/i,
    ) as HTMLInputElement;
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
    const saveButton = screen.getByRole("button", {
      name: /save organization identity/i,
    });
    await waitFor(() =>
      expect((saveButton as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("edits the Identity form and submits via the mutation hook", async () => {
    const { proxy, captured } = buildProxy();
    renderSettings(proxy);

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const fullNameInput = screen.getByLabelText(
      /full name/i,
    ) as HTMLInputElement;

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

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const saveButton = screen.getByRole("button", {
      name: /save organization identity/i,
    }) as HTMLButtonElement;

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
    const { qc } = renderSettings(proxy);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
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

    globalThis.fetch = origFetch;
  });
});

// ---------------------------------------------------------------------------
// Periods / Reminders / Notifications sub-tabs.
// Each test follows the same shape: switch to the sub-tab, mutate one field,
// click Save, assert the mutation was called with the merged PATCH payload.
// ---------------------------------------------------------------------------

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
    const periodLength = screen.getByLabelText(
      /period length/i,
    ) as HTMLInputElement;
    expect(periodLength.value).toBe("7");
    fireEvent.change(periodLength, { target: { value: "14" } });

    // gracePeriodHours present and editable.
    const grace = screen.getByLabelText(/grace period/i) as HTMLInputElement;
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
    const payload = updateSettingsFn.mock
      .calls[0]?.[0] as Partial<MockSettings>;
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

    const checkbox = screen.getByRole("checkbox", {
      name: /auto-publish after deadline/i,
    }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Periods sub-tab period-cycle inputs (deadline-time default + reopen
// gating). The four consumer-less inputs (firstDayOfWeek, deadlineDayOfWeek,
// maxOpenPeriods, requireAllSectionsToPublish) were removed. Tests assert:
// (1) the remaining inputs render with seeded values, (2) edits flow to the
// updateSettings PATCH payload, (3) «reopen window» greys out when «allow
// reopen» is off.
// ---------------------------------------------------------------------------

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
    const deadlineTime = screen.getByLabelText(
      /deadline time/i,
    ) as HTMLInputElement;
    expect(deadlineTime.value).toBe("18:00");

    // The four consumer-less inputs were removed.
    expect(screen.queryByLabelText(/monday \(iso\)/i)).toBeNull();
    expect(screen.queryByLabelText(/deadline day of week/i)).toBeNull();
    expect(screen.queryByLabelText(/max open periods/i)).toBeNull();
    expect(
      screen.queryByRole("checkbox", {
        name: /require all sections to publish/i,
      }),
    ).toBeNull();

    // allowReopenAfterPublish — checked by default.
    const allowReopen = screen.getByRole("checkbox", {
      name: /allow reopen after publish/i,
    }) as HTMLInputElement;
    expect(allowReopen.checked).toBe(true);

    // reopenWindowHours — 72 default, enabled (since allowReopen is on).
    const reopenWindow = screen.getByLabelText(
      /reopen window \(hours\)/i,
    ) as HTMLInputElement;
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
    const payload = updateSettingsFn.mock
      .calls[0]?.[0] as Partial<MockSettings>;
    expect(payload.deadlineTime).toBe("09:30");
    expect(payload.reopenWindowHours).toBe(24);
    // allowReopenAfterPublish was not touched — stays true.
    expect(payload.allowReopenAfterPublish).toBe(true);
  });

  it("disables reopenWindowHours when allowReopenAfterPublish is off", async () => {
    const { proxy } = buildProxy();
    renderSettings(proxy, { allowReopenAfterPublish: false });

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    const reopenWindow = screen.getByLabelText(
      /reopen window \(hours\)/i,
    ) as HTMLInputElement;
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

    const tzSelect = screen.getByLabelText(
      /default timezone/i,
    ) as HTMLSelectElement;
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

    const input = screen.getByLabelText(
      /notification from-email/i,
    ) as HTMLInputElement;
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

    const input = screen.getByLabelText(
      /notification from-email/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-an-email" } });

    const saveBtn = screen.getByRole("button", {
      name: /save notification settings/i,
    }) as HTMLButtonElement;
    await waitFor(() => expect(saveBtn.disabled).toBe(true));
  });
});

// ─── Integrations sub-tab ────────────────────

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
    // Even when the Telegram transport reports configured + active bindings,
    // the Element card surfaces NO live status — showing Telegram state under
    // an "Element" heading would be a false claim. Honesty rule (Codex review).
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

  it("does not render Slack or CI cards (removed in cleanup)", async () => {
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

describe("SettingsTab — accessibility regression", () => {
  // Stub fetch so /api/revalidate-org called in onSuccess doesn't hang or
  // reject while we await the success message.
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("holidays-coming-soon span has no aria-label attribute", () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const span = screen.getByTestId("holidays-coming-soon");
    expect(span.hasAttribute("aria-label")).toBe(false);
  });

  // The badge text is a descendant of the tab trigger, so it must remain part
  // of the computed accessible name without a redundant aria-label.
  it("holidays tab is announced as coming soon via its computed accessible name", () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const announced = screen.queryAllByRole("tab", { name: /coming soon/i });
    expect(announced).toHaveLength(1);
    // The announced tab is the holidays one (hosts the inert coming-soon span).
    const holidaysSpan = screen.getByTestId("holidays-coming-soon");
    expect(announced[0]?.contains(holidaysSpan)).toBe(true);
  });

  it("holidays-coming-soon span retains aria-disabled=true", () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const span = screen.getByTestId("holidays-coming-soon");
    expect(span.getAttribute("aria-disabled")).toBe("true");
  });

  it("holidays tab trigger has no icon (matches sibling tabs)", () => {
    const { proxy } = buildProxy();
    renderSettings(proxy);

    const span = screen.getByTestId("holidays-coming-soon");
    expect(span.querySelector("svg")).toBeNull();
  });

  it("CheckIcon SVG has aria-hidden=true in Identity success message", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    // Wait for the org query to populate the form, then save.
    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    fireEvent.change(shortNameInput, { target: { value: "NEW" } });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /save organization identity/i }),
    );

    // Wait for the success message to appear.
    const successSpan = await screen.findByText(/identity saved/i);
    const svg = successSpan.closest("span")?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("CheckIcon SVG aria-hidden=true persists in Identity saved message", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    const fullNameInput = screen.getByLabelText(
      /full name/i,
    ) as HTMLInputElement;
    fireEvent.change(shortNameInput, { target: { value: "ACME" } });
    fireEvent.change(fullNameInput, { target: { value: "Acme Corp" } });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /save organization identity/i }),
    );

    const successMsg = await screen.findByText(/identity saved/i);
    const container = successMsg.closest("span");
    expect(container).not.toBeNull();
    const svg = container?.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("CheckIcon SVG aria-hidden=true in Period policy saved message", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    fireEvent.change(screen.getByLabelText(/period length/i), {
      target: { value: "14" },
    });

    await user.click(
      screen.getByRole("button", { name: /save period policy/i }),
    );

    const successMsg = await screen.findByText(/period policy saved/i);
    const container = successMsg.closest("span");
    const svg = container?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("CheckIcon SVG aria-hidden=true in Reminder defaults saved message", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /reminders/i }));

    fireEvent.change(
      screen.getByLabelText(/default timezone/i) as HTMLSelectElement,
      { target: { value: "Asia/Yekaterinburg" } },
    );

    await user.click(
      screen.getByRole("button", { name: /save reminder defaults/i }),
    );

    const successMsg = await screen.findByText(/reminder defaults saved/i);
    const container = successMsg.closest("span");
    const svg = container?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("CheckIcon SVG aria-hidden=true in Notification settings saved message", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /notifications/i }));

    fireEvent.change(
      screen.getByLabelText(/notification from-email/i) as HTMLInputElement,
      { target: { value: "reports@example.com" } },
    );

    await user.click(
      screen.getByRole("button", { name: /save notification settings/i }),
    );

    const successMsg = await screen.findByText(/notification settings saved/i);
    const container = successMsg.closest("span");
    const svg = container?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("CheckIcon SVG attributes snapshot — viewBox, stroke, fill, strokeWidth, strokeLinecap, strokeLinejoin", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    fireEvent.change(shortNameInput, { target: { value: "SNAP" } });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /save organization identity/i }),
    );

    const successMsg = await screen.findByText(/identity saved/i);
    const svg = successMsg.closest("span")?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.outerHTML).toMatchInlineSnapshot(
      `"<svg viewBox="0 0 24 24" class="h-4 w-4" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>"`,
    );
  });

  it("success message DOM structure snapshot — CheckIcon SVG and text node coexist in span", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    fireEvent.change(shortNameInput, { target: { value: "SNAP2" } });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /save organization identity/i }),
    );

    const successMsg = await screen.findByText(/identity saved/i);
    const container = successMsg.closest("span");
    expect(container?.outerHTML).toMatchInlineSnapshot(
      `"<span class="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]"><svg viewBox="0 0 24 24" class="h-4 w-4" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>Identity saved</span>"`,
    );
  });
});
