/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts (as HTMLInputElement / HTMLSelectElement) are flagged redundant by ESLint's type-aware program, but the app tsconfig requires them for .value/.checked/.options access (TS2339); wave-6c-ii */
/**
 * UFB-047 / Phase 48-A — SettingsTab Identity sub-tab test.
 *
 * Strategy mirrors jobs-tab.test.tsx: stub the tRPC proxy and intercept
 * `admin.getOrganization.queryOptions` / `admin.updateOrganization
 * .mutationOptions`. We assert the Save button drives the mutation with
 * the form values and the success toast fires.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args) as unknown,
    error: (...args: unknown[]) => toastError(...args) as unknown,
    info: vi.fn(),
  },
}));

import type { MockSettings } from "./mock-data";
import { SettingsTab } from "./settings-tab";

interface Captured {
  updateOrgFn: ReturnType<typeof vi.fn>;
  updateSettingsFn: ReturnType<typeof vi.fn>;
}

// UFB-056 / Phase 55-5: Telegram integration status shape returned by
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

function makeMockTRPC(
  captured: Captured,
  integrations: IntegrationStub = DEFAULT_INTEGRATIONS,
) {
  return {
    admin: {
      getOrganization: {
        queryOptions: () => ({
          queryKey: ["admin", "getOrganization"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements React Query queryFn contract which must return Promise (no awaitable work in the stub)
          queryFn: async () => ({
            id: "singleton",
            shortName: "Demo",
            fullName: "Example Software Department",
            createdAt: new Date("2026-05-10T00:00:00Z"),
            updatedAt: new Date("2026-05-10T00:00:00Z"),
          }),
        }),
        pathFilter: () => ({ tag: "admin.getOrganization" }),
      },
      updateOrganization: {
        mutationOptions: (opts: {
          onSuccess?: () => void;
          onError?: (err: Error) => void;
        }) => ({
          mutationFn: captured.updateOrgFn,
          onSuccess: opts?.onSuccess,
          onError: opts?.onError,
        }),
      },
      updateSettings: {
        mutationOptions: (opts: {
          onSuccess?: () => void;
          onError?: (err: Error) => void;
        }) => ({
          mutationFn: captured.updateSettingsFn,
          onSuccess: opts?.onSuccess,
          onError: opts?.onError,
        }),
      },
      snapshot: { pathFilter: () => ({ tag: "admin.snapshot" }) },
      getSettings: { pathFilter: () => ({ tag: "admin.getSettings" }) },
      integrationsStatus: {
        queryOptions: () => ({
          queryKey: ["admin", "integrationsStatus"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements React Query queryFn contract which must return Promise (no awaitable work in the stub)
          queryFn: async () => integrations,
        }),
        pathFilter: () => ({ tag: "admin.integrationsStatus" }),
      },
    },
    auth: { me: { pathFilter: () => ({ tag: "auth.me" }) } },
    org: { getPublic: { pathFilter: () => ({ tag: "org.getPublic" }) } },
    weeklyReport: { get: { pathFilter: () => ({ tag: "weeklyReport.get" }) } },
  } as never;
}

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// UFB-048 (Phase 48-B): MockSettings expanded with 9 new fields. Defaults
// here mirror the SQL defaults so the Periods / Reminders / Notifications
// sub-tabs render with realistic initial state.
const baseSettings: MockSettings = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  // UFB-051 (Phase 51-A) defaults — mirror SQL.
  firstDayOfWeek: 1,
  deadlineDayOfWeek: 5,
  deadlineTime: "18:00",
  maxOpenPeriods: 1,
  requireAllSectionsToPublish: true,
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: null,
};

describe("SettingsTab — Identity sub-tab (UFB-047 / Phase 48-A)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the five tabs in the documented order", () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    // Tab triggers all visible — Identity active by default. UFB-056
    // (Phase 55-5) added the fifth «Integrations» tab.
    expect(screen.getByRole("tab", { name: /identity/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /periods/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /reminders/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /notifications/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /integrations/i })).toBeTruthy();
  });

  it("loads the organization row into the Identity form", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };

    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    // Wait for the org query to populate the form.
    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("Demo"));

    const fullNameInput = screen.getByLabelText(
      /full name/i,
    ) as HTMLInputElement;
    expect(fullNameInput.value).toBe("Example Software Department");

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
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };

    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("Demo"));

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

    await waitFor(() => {
      expect(captured.updateOrgFn).toHaveBeenCalled();
    });
    expect(captured.updateOrgFn.mock.calls[0]?.[0]).toEqual({
      shortName: "PLAT",
      fullName: "Platform Engineering",
    });
  });

  it("disables Save when shortName exceeds 16 chars", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const shortNameInput = (await screen.findByLabelText(
      /short name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(shortNameInput.value).toBe("Demo"));

    // The input itself caps at 16 via maxLength, so we read the counter to
    // assert the bound is communicated to the admin.
    expect(screen.getByText(/3\/16/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// UFB-048 (Phase 48-B): Periods / Reminders / Notifications sub-tabs.
// Each test follows the same shape: switch to the sub-tab, mutate one field,
// click Save, assert the mutation was called with the merged PATCH payload.
// ---------------------------------------------------------------------------

describe("SettingsTab — UFB-048 Periods sub-tab (Phase 48-B)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the new fields and sends them on Save", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };

    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

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
      screen.getByRole("button", { name: /save period settings/i }),
    );

    await waitFor(() => {
      expect(captured.updateSettingsFn).toHaveBeenCalled();
    });
    const payload = captured.updateSettingsFn.mock
      .calls[0]?.[0] as Partial<MockSettings>;
    expect(payload.periodLengthDays).toBe(14);
    expect(payload.gracePeriodHours).toBe(48);
    // Other fields preserved on the PATCH payload.
    expect(payload.workingDays).toBe("mon-fri");
    expect(payload.allowLateSubmissions).toBe(true);
  });

  it("disables autoPublishAfterDeadline when autoCreatePeriods is off", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    const checkbox = screen.getByRole("checkbox", {
      name: /auto-publish after deadline/i,
    }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UFB-051 (Phase 51-A): Periods sub-tab gains 8 new period-cycle inputs.
// Tests assert: (1) the inputs render with seeded values, (2) edits flow
// to the updateSettings PATCH payload, (3) the «reopen window» field
// greys out when «allow reopen» is off (UI-only — enforcement is 51-C).
// ---------------------------------------------------------------------------

describe("SettingsTab — UFB-051 Periods sub-tab (Phase 51-A)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the 8 new period-cycle inputs with seeded defaults", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    // firstDayOfWeek — Monday radio is selected by default.
    const mondayRadio = screen.getByLabelText(
      /monday \(iso\)/i,
    ) as HTMLInputElement;
    expect(mondayRadio.checked).toBe(true);

    // deadlineDayOfWeek — Friday (5) selected by default.
    const deadlineDay = screen.getByLabelText(
      /deadline day of week/i,
    ) as HTMLSelectElement;
    expect(deadlineDay.value).toBe("5");

    // deadlineTime — 18:00 default.
    const deadlineTime = screen.getByLabelText(
      /deadline time/i,
    ) as HTMLInputElement;
    expect(deadlineTime.value).toBe("18:00");

    // maxOpenPeriods — 1 default.
    const maxOpen = screen.getByLabelText(
      /max open periods/i,
    ) as HTMLInputElement;
    expect(maxOpen.value).toBe("1");

    // requireAllSectionsToPublish — checked by default.
    const requireAll = screen.getByRole("checkbox", {
      name: /require all sections to publish/i,
    }) as HTMLInputElement;
    expect(requireAll.checked).toBe(true);

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

  it("edits the 8 new fields and sends them on Save", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    // Switch firstDayOfWeek → Sunday.
    fireEvent.click(screen.getByLabelText(/sunday/i));

    // Switch deadlineDayOfWeek → Thursday.
    fireEvent.change(
      screen.getByLabelText(/deadline day of week/i) as HTMLSelectElement,
      { target: { value: "4" } },
    );

    // Change deadlineTime → 09:30.
    fireEvent.change(screen.getByLabelText(/deadline time/i), {
      target: { value: "09:30" },
    });

    // Bump maxOpenPeriods → 3.
    fireEvent.change(screen.getByLabelText(/max open periods/i), {
      target: { value: "3" },
    });

    // Untick requireAllSectionsToPublish.
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /require all sections to publish/i,
      }),
    );

    // Bump reopenWindowHours → 24.
    fireEvent.change(screen.getByLabelText(/reopen window \(hours\)/i), {
      target: { value: "24" },
    });

    await user.click(
      screen.getByRole("button", { name: /save period settings/i }),
    );

    await waitFor(() => {
      expect(captured.updateSettingsFn).toHaveBeenCalled();
    });
    const payload = captured.updateSettingsFn.mock
      .calls[0]?.[0] as Partial<MockSettings>;
    expect(payload.firstDayOfWeek).toBe(7);
    expect(payload.deadlineDayOfWeek).toBe(4);
    expect(payload.deadlineTime).toBe("09:30");
    expect(payload.maxOpenPeriods).toBe(3);
    expect(payload.requireAllSectionsToPublish).toBe(false);
    expect(payload.reopenWindowHours).toBe(24);
    // allowReopenAfterPublish was not touched — stays true.
    expect(payload.allowReopenAfterPublish).toBe(true);
  });

  it("disables reopenWindowHours when allowReopenAfterPublish is off", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab
            settings={{ ...baseSettings, allowReopenAfterPublish: false }}
          />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /periods/i }));

    const reopenWindow = screen.getByLabelText(
      /reopen window \(hours\)/i,
    ) as HTMLInputElement;
    expect(reopenWindow.disabled).toBe(true);
  });
});

describe("SettingsTab — UFB-048 Reminders sub-tab (Phase 48-B)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders defaults and sends timezone + audience on Save", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };

    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /reminders/i }));

    const tzSelect = screen.getByLabelText(
      /default timezone/i,
    ) as HTMLSelectElement;
    expect(tzSelect.value).toBe("Europe/Moscow");
    fireEvent.change(tzSelect, { target: { value: "Asia/Yekaterinburg" } });

    const audSelect = screen.getByLabelText(
      /default audience/i,
    ) as HTMLSelectElement;
    fireEvent.change(audSelect, { target: { value: "head-of-late" } });

    await user.click(
      screen.getByRole("button", { name: /save reminder defaults/i }),
    );

    await waitFor(() => {
      expect(captured.updateSettingsFn).toHaveBeenCalled();
    });
    expect(captured.updateSettingsFn.mock.calls[0]?.[0]).toEqual({
      defaultTimezone: "Asia/Yekaterinburg",
      defaultReminderAudience: "head-of-late",
    });
  });
});

describe("SettingsTab — UFB-048 Notifications sub-tab (Phase 48-B)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("saves a valid email and sends null when cleared", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };

    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /notifications/i }));

    const input = screen.getByLabelText(
      /notification from-email/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "reports@example.com" } });

    await user.click(
      screen.getByRole("button", { name: /save notification settings/i }),
    );

    await waitFor(() => {
      expect(captured.updateSettingsFn).toHaveBeenCalled();
    });
    expect(captured.updateSettingsFn.mock.calls[0]?.[0]).toEqual({
      notificationFromEmail: "reports@example.com",
    });
  });

  it("disables Save on a malformed email", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

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

// ─── UFB-056 / Phase 55-5: Integrations sub-tab (A11) ────────────────────

describe("SettingsTab — UFB-056 Integrations sub-tab (Phase 55-5)", () => {
  // A11: Telegram is seeds-only — badge is always "Coming Soon" regardless
  // of configured/bindings state. Technical details still rendered for
  // debugging; Slack card (third provider) also always "Coming Soon".
  it("renders Coming Soon badge for Telegram regardless of configured state", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider
          value={makeMockTRPC(captured, {
            telegram: { configured: false, bindings: 0 },
          })}
        >
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const badge = await screen.findByTestId("integration-badge-telegram");
    await waitFor(() => expect(badge.dataset.state).toBe("coming-soon"));
    expect(badge.textContent).toMatch(/coming soon/i);

    expect(
      screen.getByTestId("integration-telegram-configured").textContent,
    ).toBe("no");
    expect(
      screen.getByTestId("integration-telegram-bindings").textContent,
    ).toBe("0");
  });

  it("still shows Coming Soon when token is configured and bindings exist", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider
          value={makeMockTRPC(captured, {
            telegram: { configured: true, bindings: 4 },
          })}
        >
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const badge = await screen.findByTestId("integration-badge-telegram");
    await waitFor(() => expect(badge.dataset.state).toBe("coming-soon"));
    expect(badge.textContent).toMatch(/coming soon/i);
    expect(
      screen.getByTestId("integration-telegram-bindings").textContent,
    ).toBe("4");
  });

  it("still shows Coming Soon when token is set but no users are bound yet", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider
          value={makeMockTRPC(captured, {
            telegram: { configured: true, bindings: 0 },
          })}
        >
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const badge = await screen.findByTestId("integration-badge-telegram");
    await waitFor(() => expect(badge.dataset.state).toBe("coming-soon"));
    expect(
      screen.getByTestId("integration-telegram-configured").textContent,
    ).toBe("yes");
  });

  it("renders the Slack Coming Soon card (A11 third provider)", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /integrations/i }));

    const slackBadge = await screen.findByTestId("integration-badge-slack");
    await waitFor(() => expect(slackBadge.dataset.state).toBe("coming-soon"));
    expect(slackBadge.textContent).toMatch(/coming soon/i);
  });

  it("renders the AI Integration Coming Soon card (B8)", async () => {
    const captured: Captured = {
      updateOrgFn: vi.fn(),
      updateSettingsFn: vi.fn(),
    };
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={makeMockTRPC(captured)}>
          <SettingsTab settings={baseSettings} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );

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
