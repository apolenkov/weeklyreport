/**
 * Weekly Report page — Phase 22 (plan 22-05) wiring tests.
 *
 * Strategy: mock the tRPC proxy as a stub so we can intercept
 * `period.publish.mutationOptions` / `period.reopen.mutationOptions` and the
 * `weeklyReport.get.queryOptions`. We DO NOT extend MSW handlers — these
 * mutations are only exercised at the wire-up level here.
 *
 * The structural goal: when the head clicks the publish button, the parent's
 * mutation fires with `{ reportId }`; on success, cache invalidation helpers
 * fire and a toast confirms.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { TRPCProxyContext } from '../../lib/trpc-context';

// We mock cache-keys to verify invalidation cascade without actually inspecting
// react-query internals.
vi.mock('../../lib/cache-keys', () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
}));

// Mock toast so we can assert success/error feedback.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
  },
}));

// Mock Next.js navigation hooks consumed by HeadPeriodNavigator. We don't drive
// route changes in these tests — just neutralize the hook calls.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/head/report',
}));

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from '../../lib/cache-keys';
import { WeeklyReportPage } from './weekly-report-page';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';

function makeWeeklyReportData(periodStatus: 'open' | 'published' | 'reopened') {
  return {
    reportId: REPORT_ID,
    periodStart: new Date('2026-04-14T00:00:00Z'),
    periodEnd: new Date('2026-04-20T00:00:00Z'),
    periodStatus,
    weekLabel: 'Week 16',
    submissionCount: 4,
    totalLeads: 6,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
  } as const;
}

type Captured = {
  publishOptions?: { onSuccess?: () => void; onError?: (err: Error) => void };
  reopenOptions?: { onSuccess?: () => void; onError?: (err: Error) => void };
  pdfExportRequestOptions?: {
    onSuccess?: (job: { jobId: string }) => void;
    onError?: (err: Error) => void;
  };
  publishMutationFn: ReturnType<typeof vi.fn>;
  reopenMutationFn: ReturnType<typeof vi.fn>;
  pdfExportRequestMutationFn: ReturnType<typeof vi.fn>;
};

function makeMockTRPC(
  data: ReturnType<typeof makeWeeklyReportData>,
  captured: Captured,
) {
  return {
    weeklyReport: {
      get: {
        queryOptions: () => ({
          queryKey: ['weeklyReport', 'get'],
          queryFn: async () => data,
        }),
        pathFilter: () => ({ queryKey: ['weeklyReport', 'get'] }),
      },
    },
    period: {
      publish: {
        mutationOptions: (opts: Captured['publishOptions']) => {
          captured.publishOptions = opts;
          return {
            mutationFn: captured.publishMutationFn,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
      reopen: {
        mutationOptions: (opts: Captured['reopenOptions']) => {
          captured.reopenOptions = opts;
          return {
            mutationFn: captured.reopenMutationFn,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
    },
    // Phase 23-01: ExportPdfButton (rendered inside WeeklyReportPage) calls
    // both `pdfExport.request.mutationOptions` and `pdfExport.status.queryOptions`
    // unconditionally on every render. Mock the surface here so the parent
    // page renders without throwing — these tests do not exercise PDF export
    // behavior, they only need the mock to be structurally valid.
    pdfExport: {
      request: {
        mutationOptions: (opts: Captured['pdfExportRequestOptions']) => {
          captured.pdfExportRequestOptions = opts;
          return {
            mutationFn: captured.pdfExportRequestMutationFn,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
      status: {
        queryOptions: () => ({
          queryKey: ['pdfExport', 'status'],
          queryFn: async () => null,
          enabled: false,
        }),
      },
    },
    review: { dashboard: { pathFilter: () => ({ queryKey: ['review', 'dashboard'] }) } },
    archive: { list: { pathFilter: () => ({ queryKey: ['archive', 'list'] }) } },
    reports: {
      myHistory: { pathFilter: () => ({ queryKey: ['reports', 'myHistory'] }) },
      getActive: { pathFilter: () => ({ queryKey: ['reports', 'getActive'] }) },
    },
    leadForm: {
      byPeriod: { pathFilter: () => ({ queryKey: ['leadForm', 'byPeriod'] }) },
      versions: { pathFilter: () => ({ queryKey: ['leadForm', 'versions'] }) },
    },
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ['admin', 'snapshot'] }) },
      getSettings: { pathFilter: () => ({ queryKey: ['admin', 'getSettings'] }) },
    },
    // Phase 31 (AI-01): AiSummaryCard is mounted inside WeeklyReportPage.
    // It calls ai.summary.queryOptions and conditionally ai.regenerateSummary.
    // mutationOptions. These tests do not exercise AI behaviour — provide
    // a structurally valid mock so the card renders its loading/empty state.
    ai: {
      summary: {
        queryOptions: () => ({
          queryKey: ['ai', 'summary'],
          queryFn: async () => null,
          enabled: false,
        }),
        queryKey: () => ['ai', 'summary'],
      },
      regenerateSummary: {
        mutationOptions: (opts: { onSuccess?: () => void } | undefined) => ({
          mutationFn: vi.fn(),
          onSuccess: opts?.onSuccess,
        }),
      },
      sentiment: {
        queryOptions: () => ({
          queryKey: ['ai', 'sentiment'],
          queryFn: async () => null,
          enabled: false,
        }),
      },
    },
  } as never;
}

function renderPage(
  data: ReturnType<typeof makeWeeklyReportData>,
  captured: Captured,
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC(data, captured);
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>{children}</TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  return render(<WeeklyReportPage />, { wrapper: Wrapper });
}

describe('WeeklyReportPage — Publish & Lock / Reopen wiring (Phase 22 plan 22-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking Publish & Lock fires period.publish with reportId from view.period', async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData('open'), captured);

    // Wait for query to resolve and page to render.
    await screen.findByRole('button', { name: /publish & lock/i });

    // First click opens the confirmation dialog.
    await userEvent.click(screen.getByRole('button', { name: /publish & lock/i }));

    // Confirm in the dialog.
    const dialog = await screen.findByRole('dialog', { name: /confirm publish/i });
    const buttons = dialog.querySelectorAll('button');
    await userEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() => {
      expect(captured.publishMutationFn).toHaveBeenCalledTimes(1);
    });
    // TanStack Query invokes mutationFn(variables, context); assert the first arg only.
    expect(captured.publishMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it('on publish success: invalidateDashboard + invalidateLeadHistory fire and a success toast appears', async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn().mockResolvedValue(undefined),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData('open'), captured);

    await screen.findByRole('button', { name: /publish & lock/i });

    // Trigger the onSuccess hook directly via the captured options. This decouples
    // the test from internal react-query timing while still exercising the user code.
    expect(captured.publishOptions?.onSuccess).toBeTypeOf('function');
    act(() => {
      captured.publishOptions!.onSuccess!();
    });

    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('on publish error: a toast.error is shown', async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn(),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData('open'), captured);

    await screen.findByRole('button', { name: /publish & lock/i });

    expect(captured.publishOptions?.onError).toBeTypeOf('function');
    act(() => {
      captured.publishOptions!.onError!(new Error('Forbidden'));
    });

    expect(toastError).toHaveBeenCalled();
  });

  it('clicking Reopen Period (via confirm dialog) fires period.reopen with reportId when periodStatus is published', async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn().mockResolvedValue(undefined),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData('published'), captured);

    // Reopen is now destructive → goes through ConfirmDeleteDialog.
    const reopenBtn = await screen.findByRole('button', { name: /reopen period/i });
    await userEvent.click(reopenBtn);

    // Confirm dialog renders with a "Reopen" button (label set via confirmLabel="Reopen").
    const confirmBtn = await screen.findByRole('button', { name: /^reopen$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(captured.reopenMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(captured.reopenMutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it('on reopen success: invalidateDashboard + invalidateLeadForm + invalidateLeadHistory fire', async () => {
    const captured: Captured = {
      publishMutationFn: vi.fn(),
      reopenMutationFn: vi.fn(),
      pdfExportRequestMutationFn: vi.fn(),
    };
    renderPage(makeWeeklyReportData('published'), captured);

    await screen.findByRole('button', { name: /reopen period/i });

    expect(captured.reopenOptions?.onSuccess).toBeTypeOf('function');
    act(() => {
      captured.reopenOptions!.onSuccess!();
    });

    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadForm).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });
});
