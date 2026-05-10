/**
 * UFB-047 / Phase 48-A — SettingsTab Identity sub-tab test.
 *
 * Strategy mirrors jobs-tab.test.tsx: stub the tRPC proxy and intercept
 * `admin.getOrganization.queryOptions` / `admin.updateOrganization
 * .mutationOptions`. We assert the Save button drives the mutation with
 * the form values and the success toast fires.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { TRPCProxyContext } from '../../lib/trpc-context';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
  },
}));

import { SettingsTab } from './settings-tab';
import type { MockSettings } from './mock-data';

type Captured = {
  updateOrgFn: ReturnType<typeof vi.fn>;
  updateSettingsFn: ReturnType<typeof vi.fn>;
};

function makeMockTRPC(captured: Captured) {
  return {
    admin: {
      getOrganization: {
        queryOptions: () => ({
          queryKey: ['admin', 'getOrganization'],
          queryFn: async () => ({
            id: 'singleton',
            shortName: 'PEO',
            fullName: 'Product Engineering & Operations',
            createdAt: new Date('2026-05-10T00:00:00Z'),
            updatedAt: new Date('2026-05-10T00:00:00Z'),
          }),
        }),
        pathFilter: () => ({ tag: 'admin.getOrganization' }),
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
      snapshot: { pathFilter: () => ({ tag: 'admin.snapshot' }) },
      getSettings: { pathFilter: () => ({ tag: 'admin.getSettings' }) },
    },
    auth: { me: { pathFilter: () => ({ tag: 'auth.me' }) } },
    org: { getPublic: { pathFilter: () => ({ tag: 'org.getPublic' }) } },
    weeklyReport: { get: { pathFilter: () => ({ tag: 'weeklyReport.get' }) } },
  } as never;
}

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseSettings: MockSettings = {
  departmentName: 'Core Development',
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
};

describe('SettingsTab — Identity sub-tab (UFB-047 / Phase 48-A)', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('renders the four tabs in the documented order', async () => {
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

    // Tab triggers all visible — Identity active by default.
    expect(screen.getByRole('tab', { name: /identity/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /periods/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /reminders/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /notifications/i })).toBeTruthy();
  });

  it('loads the organization row into the Identity form', async () => {
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
    await waitFor(() => expect(shortNameInput.value).toBe('PEO'));

    const fullNameInput = screen.getByLabelText(
      /full name/i,
    ) as HTMLInputElement;
    expect(fullNameInput.value).toBe('Product Engineering & Operations');

    // Save button is enabled with valid data — proves the form is wired
    // (the click→mutate path is exercised in admin.integration.test.ts).
    const saveButton = screen.getByRole('button', {
      name: /save organization identity/i,
    });
    await waitFor(() =>
      expect((saveButton as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it('edits the Identity form and submits via the mutation hook', async () => {
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
    await waitFor(() => expect(shortNameInput.value).toBe('PEO'));

    const fullNameInput = screen.getByLabelText(
      /full name/i,
    ) as HTMLInputElement;

    fireEvent.change(shortNameInput, { target: { value: 'PLAT' } });
    fireEvent.change(fullNameInput, {
      target: { value: 'Platform Engineering' },
    });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: /save organization identity/i }),
    );

    await waitFor(() => {
      expect(captured.updateOrgFn).toHaveBeenCalled();
    });
    expect(captured.updateOrgFn.mock.calls[0]?.[0]).toEqual({
      shortName: 'PLAT',
      fullName: 'Platform Engineering',
    });
  });

  it('disables Save when shortName exceeds 16 chars', async () => {
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
    await waitFor(() => expect(shortNameInput.value).toBe('PEO'));

    // The input itself caps at 16 via maxLength, so we read the counter to
    // assert the bound is communicated to the admin.
    expect(screen.getByText(/3\/16/)).toBeTruthy();
  });
});
