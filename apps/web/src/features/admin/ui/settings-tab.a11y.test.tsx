import type { AppSettings } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=settings"),
}));

import { SettingsTab } from "./settings-tab";

// Org data returned by admin.getOrganization.
const ORG_DATA = {
  id: "singleton",
  shortName: "PEO",
  fullName: "Product Engineering & Operations",
  createdAt: new Date("2026-05-10T00:00:00Z"),
  updatedAt: new Date("2026-05-10T00:00:00Z"),
};

function buildProxy() {
  return createMockTRPC([
    { path: ["admin", "getOrganization"], query: ORG_DATA },
    { path: ["admin", "updateOrganization"], mutation: true },
    { path: ["admin", "updateSettings"], mutation: true },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
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

async function expectSuccessAnnouncement(text: string) {
  const announcement = await screen.findByRole("status");
  expect(announcement).toHaveAttribute("aria-live", "polite");
  expect(announcement).toHaveTextContent(text);
  expect(announcement.querySelector("svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
}

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

  it("announces a successful Identity save with a decorative icon", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateOrganization"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    // Wait for the org query to populate the form, then save.
    const shortNameInput =
      await screen.findByLabelText<HTMLInputElement>(/short name/i);
    await waitFor(() => expect(shortNameInput.value).toBe("PEO"));

    fireEvent.change(shortNameInput, { target: { value: "NEW" } });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /save organization identity/i }),
    );

    await expectSuccessAnnouncement("Identity saved");
  });

  it("announces a successful Period policy save with a decorative icon", async () => {
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

    await expectSuccessAnnouncement("Period policy saved");
  });

  it("announces a successful Reminder defaults save with a decorative icon", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /reminders/i }));

    fireEvent.change(
      screen.getByLabelText<HTMLSelectElement>(/default timezone/i),
      { target: { value: "Asia/Yekaterinburg" } },
    );

    await user.click(
      screen.getByRole("button", { name: /save reminder defaults/i }),
    );

    await expectSuccessAnnouncement("Reminder defaults saved");
  });

  it("announces a successful Notification settings save with a decorative icon", async () => {
    const { proxy, captured } = buildProxy();
    expectDefined(
      captured["admin.updateSettings"],
    ).mutationFn.mockResolvedValue(undefined);
    renderSettings(proxy);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /notifications/i }));

    fireEvent.change(
      screen.getByLabelText<HTMLInputElement>(/notification from-email/i),
      { target: { value: "reports@example.com" } },
    );

    await user.click(
      screen.getByRole("button", { name: /save notification settings/i }),
    );

    await expectSuccessAnnouncement("Notification settings saved");
  });
});
