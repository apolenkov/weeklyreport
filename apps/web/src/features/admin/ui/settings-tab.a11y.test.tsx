/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts are required for value, checked, and options access under the app tsconfig. */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Defaults mirror SQL defaults so Periods / Reminders / Notifications
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
