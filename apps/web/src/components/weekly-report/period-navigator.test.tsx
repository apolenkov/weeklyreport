/**
 * Tests for the head-side <HeadPeriodNavigator/>.
 *
 * Per the 21-04 SUMMARY decision (path "a"), past periods are addressed by
 * routing to /reports/[reportId] — the existing reportId-based query handles
 * the data load. The "current" period routes back to the head's live report
 * page (basePath default `/head/report`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';

const push = vi.fn();
const replace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/head/report',
}));

import { HeadPeriodNavigator } from './period-navigator';
import type { ReportPeriod } from '../dashboard/mock-data';

const PERIODS: ReportPeriod[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    weekLabel: 'Week 17',
    dateRange: 'Apr 21–27',
    isCurrent: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    weekLabel: 'Week 16',
    dateRange: 'Apr 14–20',
    isCurrent: false,
  },
];

describe('HeadPeriodNavigator', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it('selecting a non-current period routes to /reports/<reportId>', () => {
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    fireEvent.change(select, {
      target: { value: '22222222-2222-2222-2222-222222222222' },
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      '/reports/22222222-2222-2222-2222-222222222222',
    );
  });

  it('selecting the current period routes back to basePath (/head/report)', () => {
    mockSearchParams = new URLSearchParams();
    render(<HeadPeriodNavigator periods={PERIODS} />);
    // Programmatically navigate to the current period (after rendering it).
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    // First simulate already being on a non-current period selection:
    // change to current id.
    fireEvent.change(select, {
      target: { value: '11111111-1111-1111-1111-111111111111' },
    });
    expect(push).toHaveBeenCalledWith('/head/report');
  });

  it('initial render reflects the ?period= search param', () => {
    mockSearchParams = new URLSearchParams(
      'period=22222222-2222-2222-2222-222222222222',
    );
    render(<HeadPeriodNavigator periods={PERIODS} />);
    const select = screen.getByLabelText('Select reporting period') as HTMLSelectElement;
    expect(select.value).toBe('22222222-2222-2222-2222-222222222222');
  });
});
