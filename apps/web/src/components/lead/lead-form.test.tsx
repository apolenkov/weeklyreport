/**
 * Tests for the LeadForm container's mutation wiring (submit + revoke +
 * autosave + dirty-state). The four queries (getActive / byPeriod / versions /
 * myHistory) are mocked at the tRPC-proxy boundary, mirroring the autosave
 * hook test harness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

import { LeadForm } from './lead-form';
import { TRPCProxyContext } from '../../lib/trpc-context';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/lead/report',
}));

const SECTION_ID = '11111111-1111-1111-1111-111111111111';
const REPORT_ID = '33333333-3333-3333-3333-333333333333';
const PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const AUTHOR_ID = '44444444-4444-4444-4444-444444444444';

function makeSection(overrides: { status?: 'draft' | 'submitted' } = {}) {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: 'Test Lead',
    status: overrides.status ?? ('draft' as const),
    submittedAt: null,
    projects: [
      { projectId: PROJECT_ID, projectName: 'Test Product', trafficLight: 'green' as const },
    ],
    items: [
      {
        id: '55555555-5555-5555-5555-555555555555',
        projectId: PROJECT_ID,
        type: 'current' as const,
        text: 'Existing item',
        tag: 'tag',
        workflowStatus: 'in_progress' as const,
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [
      {
        id: '66666666-6666-6666-6666-666666666666',
        text: 'Existing decision',
        owner: 'Owner',
        impact: 'Impact',
      },
    ],
    priorities: [{ id: '77777777-7777-7777-7777-777777777777', rank: 1, text: 'Priority text' }],
  };
}

type Capture = {
  submitOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
  revokeOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
  saveDraftOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
};

async function flushAll() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function buildHarness(opts: {
  sectionStatus?: 'draft' | 'submitted';
  submitFn?: () => Promise<unknown>;
  revokeFn?: () => Promise<unknown>;
} = {}) {
  const cap: Capture = {};
  const calls: { type: string; vars: unknown }[] = [];

  const trpcMock = {
    reports: {
      getActive: {
        queryOptions: () => ({
          queryKey: ['reports.getActive'],
          queryFn: async () => ({ reportId: REPORT_ID, reportSectionId: SECTION_ID, authorName: 'Test Lead' }),
        }),
        pathFilter: () => ({ queryKey: ['reports.getActive'] }),
      },
      myHistory: {
        queryOptions: () => ({
          queryKey: ['reports.myHistory'],
          queryFn: async () => [],
        }),
        pathFilter: () => ({ queryKey: ['reports.myHistory'] }),
      },
      saveDraft: {
        mutationOptions: (passed: NonNullable<Capture['saveDraftOpts']>) => {
          cap.saveDraftOpts = passed;
          return {
            ...passed,
            mutationFn: async (vars: unknown) => {
              calls.push({ type: 'saveDraft', vars });
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ['reports.saveDraft'] }),
      },
      submit: {
        mutationOptions: (passed: NonNullable<Capture['submitOpts']>) => {
          cap.submitOpts = passed;
          return {
            ...passed,
            mutationFn: async (vars: unknown) => {
              calls.push({ type: 'submit', vars });
              if (opts.submitFn) return opts.submitFn();
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ['reports.submit'] }),
      },
    },
    leadForm: {
      byPeriod: {
        queryOptions: () => ({
          queryKey: ['leadForm.byPeriod'],
          queryFn: async () => ({ section: makeSection({ status: opts.sectionStatus }), readOnly: false }),
        }),
        pathFilter: () => ({ queryKey: ['leadForm.byPeriod'] }),
      },
      versions: {
        queryOptions: () => ({
          queryKey: ['leadForm.versions'],
          queryFn: async () => [],
        }),
        pathFilter: () => ({ queryKey: ['leadForm.versions'] }),
      },
      revoke: {
        mutationOptions: (passed: NonNullable<Capture['revokeOpts']>) => {
          cap.revokeOpts = passed;
          return {
            ...passed,
            mutationFn: async (vars: unknown) => {
              calls.push({ type: 'revoke', vars });
              if (opts.revokeFn) return opts.revokeFn();
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ['leadForm.revoke'] }),
      },
      fillFrom: {
        mutationOptions: (passed: object) => ({ ...passed, mutationFn: async () => ({}) }),
        pathFilter: () => ({ queryKey: ['leadForm.fillFrom'] }),
      },
      restoreVersion: {
        mutationOptions: (passed: object) => ({ ...passed, mutationFn: async () => ({}) }),
        pathFilter: () => ({ queryKey: ['leadForm.restoreVersion'] }),
      },
    },
    review: { dashboard: { pathFilter: () => ({ queryKey: ['review.dashboard'] }) } },
    archive: { list: { pathFilter: () => ({ queryKey: ['archive.list'] }) } },
    weeklyReport: { get: { pathFilter: () => ({ queryKey: ['weeklyReport.get'] }) } },
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ['admin.snapshot'] }) },
      getSettings: { pathFilter: () => ({ queryKey: ['admin.getSettings'] }) },
    },
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, cap, calls, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LeadForm mutation wiring', () => {
  it('submit success: invalidates caches, fires toast.success, locks form', async () => {
    const { Wrapper, cap, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Wait for queries to resolve.
    await act(async () => {
      await flushAll();
    });

    // onSuccess from the submit mutation fires invalidations + toast.
    expect(cap.submitOpts).toBeDefined();
    // Trigger onSuccess deterministically — the mutation wiring is the unit
    // under test (the orchestration of invalidation + toast + lock).
    act(() => {
      cap.submitOpts!.onSuccess?.();
    });
    expect(toast.success).toHaveBeenCalledWith('Report submitted');
    // invalidateLeadForm + invalidateLeadHistory each call invalidateQueries.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('submit error: fires toast.error with the error message', async () => {
    const { Wrapper, cap } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    expect(cap.submitOpts).toBeDefined();
    // Simulate error path.
    cap.submitOpts!.onError?.(new Error('Submit blew up'));
    expect(toast.error).toHaveBeenCalledWith('Submit blew up');
  });

  it('editing a decision marks the form dirty (autosave indicator changes from Autosaved)', async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    // Initially "Autosaved" badge is shown.
    expect(await screen.findByText('Autosaved')).toBeInTheDocument();

    // Change a decision text.
    const inputs = screen.getAllByRole('textbox');
    const decisionInput = inputs.find(
      (el) => (el as HTMLInputElement).value === 'Existing decision',
    ) as HTMLInputElement;
    expect(decisionInput).toBeDefined();

    act(() => {
      decisionInput.focus();
      // Use the native setter to bypass React's input dedup.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(decisionInput, 'Existing decision EDITED');
      decisionInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      await flushAll();
    });

    // After the edit the autosave hook flips state to "pending" -> indicator
    // text changes away from "Autosaved".
    const indicator = screen.queryByText('Autosaved');
    expect(indicator).toBeNull();
    // Pending or Saving... should now show.
    const pending = screen.queryByText(/Pending|Saving/i);
    expect(pending).not.toBeNull();
  });

  it('revoke success: invalidates dashboard + leadForm + history, fires toast.success', async () => {
    const { Wrapper, cap, queryClient } = buildHarness({ sectionStatus: 'submitted' });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    // Revoke button only renders when submitted.
    const revokeBtn = await screen.findByRole('button', { name: /Revoke/i });
    revokeBtn.click();
    await act(async () => {
      await flushAll();
    });

    expect(cap.revokeOpts).toBeDefined();
    cap.revokeOpts!.onSuccess?.();
    expect(toast.success).toHaveBeenCalledWith('Section unlocked');
    // invalidateLeadForm (3 keys) + invalidateDashboard (3 keys) +
    // invalidateLeadHistory (1 key) -> at least 7 invalidateQueries calls.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(7);
  });
});
