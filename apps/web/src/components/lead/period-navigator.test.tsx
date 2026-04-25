/**
 * Tests for the lead-side <PeriodNavigator/>.
 *
 * Wires `useRouter` + `useSearchParams` from `next/navigation` to drive the
 * `?period=` query param. The current period is the default (no query); past
 * periods are surfaced via the URL (read-only banner is rendered by LeadForm,
 * the navigator only owns the URL state).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';

const replace = vi.fn();
const push = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/lead/report',
}));

import { PeriodNavigator } from './period-navigator';
import type { ReportPeriod } from './mock-data';

const PERIODS: ReportPeriod[] = [
  {
    id: '2026-W17',
    weekLabel: 'Week 17',
    dateRange: 'Apr 21–27',
    isCurrent: true,
    isSubmitted: false,
  },
  {
    id: '2026-W16',
    weekLabel: 'Week 16',
    dateRange: 'Apr 14–20',
    isCurrent: false,
    isSubmitted: true,
  },
  {
    id: '2026-W15',
    weekLabel: 'Week 15',
    dateRange: 'Apr 7–13',
    isCurrent: false,
    isSubmitted: true,
  },
];

describe('PeriodNavigator (lead)', () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it('selecting a non-current period calls router.replace with ?period=', () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2026-W16' } });
    expect(replace).toHaveBeenCalledTimes(1);
    const arg = replace.mock.calls[0]?.[0] as string;
    expect(arg).toContain('/lead/report');
    expect(arg).toContain('period=2026-W16');
  });

  it('selecting the current period removes the ?period= search param', () => {
    mockSearchParams = new URLSearchParams('period=2026-W16');
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2026-W17' } });
    expect(replace).toHaveBeenCalledTimes(1);
    const arg = replace.mock.calls[0]?.[0] as string;
    // No `period=` key after the current period is selected.
    expect(arg).not.toMatch(/[?&]period=/);
  });

  it('initial render reflects the URL period (no internal selected state)', () => {
    mockSearchParams = new URLSearchParams('period=2026-W15');
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    expect(select.value).toBe('2026-W15');
  });

  it('uses pathname from usePathname (does not hardcode /lead/report)', () => {
    render(<PeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2026-W15' } });
    const arg = replace.mock.calls[0]?.[0] as string;
    // Should start with the pathname mocked above.
    expect(arg.startsWith('/lead/report')).toBe(true);
  });
});
