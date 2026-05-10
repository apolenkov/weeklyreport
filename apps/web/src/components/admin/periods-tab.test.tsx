import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { PeriodListItem } from '@customreport/shared';

import { TRPCProxyContext } from '../../lib/trpc-context';

import { PeriodsTab } from './periods-tab';

// ----- mocks ---------------------------------------------------------

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: () => undefined,
  },
}));

// ----- fixtures ------------------------------------------------------

function makeRow(overrides: Partial<PeriodListItem>): PeriodListItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    periodStart: new Date('2026-05-04T00:00:00Z'),
    periodEnd: new Date('2026-05-10T23:59:59Z'),
    deadline: new Date('2026-05-09T18:00:00Z'),
    publishedAt: null,
    periodState: 'open',
    periodStatus: 'open',
    archived: false,
    autoPublished: false,
    autoArchived: false,
    submittedCount: 3,
    totalCount: 6,
    canReopen: false,
    canArchive: false,
    ...overrides,
  };
}

const openRow = makeRow({
  id: '11111111-1111-4111-8111-111111111101',
  periodState: 'open',
  periodStatus: 'open',
});
const publishedFresh = makeRow({
  id: '11111111-1111-4111-8111-111111111102',
  periodState: 'published',
  periodStatus: 'published',
  publishedAt: new Date(Date.now() - 2 * 3_600_000),
  submittedCount: 6,
  totalCount: 6,
  canReopen: true,
  canArchive: true,
});
const publishedStale = makeRow({
  id: '11111111-1111-4111-8111-111111111103',
  periodState: 'published',
  periodStatus: 'published',
  publishedAt: new Date(Date.now() - 200 * 3_600_000),
  canReopen: false,
  canArchive: true,
});
const archivedRow = makeRow({
  id: '11111111-1111-4111-8111-111111111104',
  periodState: 'archived',
  periodStatus: 'published',
  archived: true,
});

// ----- tRPC test double ----------------------------------------------

type Captured = {
  publishMutationFn: ReturnType<typeof vi.fn>;
  reopenMutationFn: ReturnType<typeof vi.fn>;
  archiveMutationFn: ReturnType<typeof vi.fn>;
  unarchiveMutationFn: ReturnType<typeof vi.fn>;
  listInputs: Array<{ bucket: string }>;
};

function makeMockTRPC(opts: {
  active: PeriodListItem[];
  archive: PeriodListItem[];
  captured: Captured;
}) {
  // Use unique query keys keyed on the `bucket` arg so the active vs.
  // archive caches stay independent (the real proxy does this via
  // queryKey derivation from the trpc path).
  return {
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ['admin', 'snapshot'] }) },
      getSettings: {
        pathFilter: () => ({ queryKey: ['admin', 'settings'] }),
      },
      getOrganization: {
        pathFilter: () => ({ queryKey: ['admin', 'getOrganization'] }),
      },
      listPeriodsByState: {
        pathFilter: () => ({ queryKey: ['admin', 'listPeriodsByState'] }),
        queryOptions: (input: { bucket: string }) => {
          opts.captured.listInputs.push(input);
          return {
            queryKey: ['admin', 'listPeriodsByState', input.bucket],
            queryFn: async () =>
              input.bucket === 'archive' ? opts.archive : opts.active,
          };
        },
      },
      archivePeriod: {
        pathFilter: () => ({ queryKey: ['admin', 'archivePeriod'] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.archiveMutationFn,
          onSuccess: mopts['onSuccess'],
          onError: mopts['onError'],
        }),
      },
      unarchivePeriod: {
        pathFilter: () => ({ queryKey: ['admin', 'unarchivePeriod'] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.unarchiveMutationFn,
          onSuccess: mopts['onSuccess'],
          onError: mopts['onError'],
        }),
      },
    },
    period: {
      publish: {
        pathFilter: () => ({ queryKey: ['period', 'publish'] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.publishMutationFn,
          onSuccess: mopts['onSuccess'],
          onError: mopts['onError'],
        }),
      },
      reopen: {
        pathFilter: () => ({ queryKey: ['period', 'reopen'] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.captured.reopenMutationFn,
          onSuccess: mopts['onSuccess'],
          onError: mopts['onError'],
        }),
      },
    },
    org: { getPublic: { pathFilter: () => ({ queryKey: ['org'] }) } },
    auth: { me: { pathFilter: () => ({ queryKey: ['auth'] }) } },
    weeklyReport: {
      get: { pathFilter: () => ({ queryKey: ['weeklyReport', 'get'] }) },
    },
  } as never;
}

function renderTab(args?: {
  active?: PeriodListItem[];
  archive?: PeriodListItem[];
}) {
  const captured: Captured = {
    publishMutationFn: vi.fn().mockResolvedValue({ success: true }),
    reopenMutationFn: vi.fn().mockResolvedValue({ success: true }),
    archiveMutationFn: vi.fn().mockResolvedValue({ success: true }),
    unarchiveMutationFn: vi.fn().mockResolvedValue({ success: true }),
    listInputs: [],
  };

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC({
    active: args?.active ?? [openRow, publishedFresh, publishedStale],
    archive: args?.archive ?? [archivedRow],
    captured,
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(<PeriodsTab />, { wrapper: Wrapper });
  return { ...result, captured };
}

// ----- tests ---------------------------------------------------------

describe('PeriodsTab (UFB-052 / Phase 51-B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Active rows with state badges and progress', async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-active-row-${openRow.id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`periods-active-row-${publishedFresh.id}`),
    ).toBeInTheDocument();

    // Progress badge on a fully-submitted row shows 6/6 with success tone.
    const progress = screen.getByTestId(
      `periods-row-${publishedFresh.id}-progress`,
    );
    expect(progress).toHaveTextContent('6/6');
    expect(progress).toHaveAttribute('data-progress-tone', 'success');

    // The state badges are scoped per row — assert the published row's
    // state cell carries the 'published' badge.
    const publishedRow = screen.getByTestId(
      `periods-active-row-${publishedFresh.id}`,
    );
    expect(publishedRow).toHaveAttribute('data-period-state', 'published');
  });

  it('archive section is collapsed by default and does not render archive rows', async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-active-row-${openRow.id}`),
      ).toBeInTheDocument();
    });

    // Body hidden + no archive row rendered. The TanStack Query
    // `enabled: false` flag prevents the queryFn from running even
    // though the queryOptions object is constructed during render.
    expect(screen.queryByTestId('periods-archive-body')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`periods-archive-row-${archivedRow.id}`),
    ).not.toBeInTheDocument();
  });

  it('expands the archive section on toggle click and fires the archive query', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId('periods-archive-toggle'));
    await waitFor(() => {
      expect(
        screen.getByTestId(`periods-archive-row-${archivedRow.id}`),
      ).toBeInTheDocument();
    });
  });

  it('action menu visibility: published-fresh shows Reopen + Archive', async () => {
    const user = userEvent.setup();
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-menu-trigger-${publishedFresh.id}`),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByTestId(`action-menu-trigger-${publishedFresh.id}`),
    );

    expect(
      screen.getByTestId(`action-reopen-${publishedFresh.id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`action-archive-${publishedFresh.id}`),
    ).toBeInTheDocument();
  });

  it('action menu visibility: published-stale (canReopen=false) hides Reopen, keeps Archive', async () => {
    const user = userEvent.setup();
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-menu-trigger-${publishedStale.id}`),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByTestId(`action-menu-trigger-${publishedStale.id}`),
    );

    expect(
      screen.queryByTestId(`action-reopen-${publishedStale.id}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`action-archive-${publishedStale.id}`),
    ).toBeInTheDocument();
  });

  it('action menu visibility: open row exposes Publish now', async () => {
    const user = userEvent.setup();
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-menu-trigger-${openRow.id}`),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`action-menu-trigger-${openRow.id}`));

    expect(
      screen.getByTestId(`action-publish-${openRow.id}`),
    ).toBeInTheDocument();
    // No archive on open rows (canArchive=false).
    expect(
      screen.queryByTestId(`action-archive-${openRow.id}`),
    ).not.toBeInTheDocument();
  });

  it('action menu visibility: archived row exposes Unarchive only', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByTestId('periods-archive-toggle'));
    await waitFor(() => {
      expect(
        screen.getByTestId(`action-menu-trigger-${archivedRow.id}`),
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByTestId(`action-menu-trigger-${archivedRow.id}`),
    );

    expect(
      screen.getByTestId(`action-unarchive-${archivedRow.id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`action-archive-${archivedRow.id}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`action-reopen-${archivedRow.id}`),
    ).not.toBeInTheDocument();
  });

  it('clicking Archive fires the archive mutation with the periodId', async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-menu-trigger-${publishedFresh.id}`),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByTestId(`action-menu-trigger-${publishedFresh.id}`),
    );
    await user.click(screen.getByTestId(`action-archive-${publishedFresh.id}`));

    await waitFor(() => {
      expect(captured.archiveMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.archiveMutationFn.mock.calls[0]?.[0]).toEqual({
      periodId: publishedFresh.id,
    });
  });

  it('clicking Reopen fires the period.reopen mutation with the reportId', async () => {
    const user = userEvent.setup();
    const { captured } = renderTab();

    await waitFor(() => {
      expect(
        screen.getByTestId(`action-menu-trigger-${publishedFresh.id}`),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByTestId(`action-menu-trigger-${publishedFresh.id}`),
    );
    await user.click(screen.getByTestId(`action-reopen-${publishedFresh.id}`));

    await waitFor(() => {
      expect(captured.reopenMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.reopenMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: publishedFresh.id,
    });
  });

  it('reopened-status published rows render the "(reopened)" badge', async () => {
    renderTab({
      active: [
        makeRow({
          id: '11111111-1111-4111-8111-111111111199',
          periodState: 'open',
          periodStatus: 'reopened',
        }),
      ],
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('periods-row-11111111-1111-4111-8111-111111111199-reopened-badge'),
      ).toBeInTheDocument();
    });
  });

  it('progress badge shows em-dash when totalCount=0 (new period, no sections yet)', async () => {
    renderTab({
      active: [
        makeRow({
          id: '11111111-1111-4111-8111-111111111188',
          totalCount: 0,
          submittedCount: 0,
        }),
      ],
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('periods-row-11111111-1111-4111-8111-111111111188-progress'),
      ).toHaveTextContent('—');
    });
  });
});
