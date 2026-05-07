import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// 39-05: search-input renders results from `trpc.search.query`. Mock the
// tRPC context + useQuery so we can drive the data path without a real
// network. next/navigation is stubbed so the click-through router.push
// doesn't require Next's app shell.

const useQueryMock = vi.fn();
const queryOptionsMock = vi.fn((args: unknown) => ({
  queryKey: ['search', 'query', args],
}));
const pushMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => useQueryMock(opts),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('../../lib/trpc-context', () => ({
  useTRPC: () => ({
    search: {
      query: {
        queryOptions: (args: unknown) => queryOptionsMock(args),
      },
    },
  }),
}));

import { SearchInput } from './search-input';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const SECTION_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';

describe('SearchInput — 39-05 (PERF-05)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useQueryMock.mockReset();
    queryOptionsMock.mockClear();
    pushMock.mockClear();
    useQueryMock.mockReturnValue({ data: [], isFetching: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the input with the supplied placeholder', () => {
    render(<SearchInput scope="mine" placeholder="Найти в моих отчётах" />);
    expect(
      screen.getByPlaceholderText('Найти в моих отчётах'),
    ).toBeInTheDocument();
  });

  it('does not call trpc.search.query.queryOptions while q is below the 2-char floor', () => {
    render(<SearchInput scope="mine" />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'a' } });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // `enabled` flag in useQuery options should be false until q.length >= 2.
    const lastCall = useQueryMock.mock.calls.at(-1);
    expect(lastCall?.[0]?.enabled).toBe(false);
  });

  it('fires the query when q has 2+ chars after the debounce window elapses', () => {
    render(<SearchInput scope="mine" />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'PR' } });
    });
    // Before debounce fires, the queryOptions sees the previous (empty) value
    // for one render but `enabled` is still false because debouncedQ is ''.
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // After debounce, queryOptions is invoked with the new q AND enabled=true.
    const calls = queryOptionsMock.mock.calls;
    const lastQueryOptionsArg = calls.at(-1)?.[0] as
      | { q?: string; scope?: string }
      | undefined;
    expect(lastQueryOptionsArg?.q).toBe('PR');
    expect(lastQueryOptionsArg?.scope).toBe('mine');

    const lastUseQueryArg = useQueryMock.mock.calls.at(-1)?.[0] as
      | { enabled?: boolean }
      | undefined;
    expect(lastUseQueryArg?.enabled).toBe(true);
  });

  it('renders results returned by useQuery and converts <<…>> markers to <mark>', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          type: 'item',
          id: ITEM_ID,
          title: 'Релиз заблокирован',
          snippet: 'Релиз <<заблокирован>> security-сканером',
          rank: 0.5,
          projectId: PROJECT_ID,
          reportId: REPORT_ID,
          reportSectionId: SECTION_ID,
          createdAt: '2026-05-06T08:00:00.000Z',
        },
      ],
      isFetching: false,
    });

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole('combobox');

    act(() => {
      fireEvent.change(input, { target: { value: 'релиз' } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('Релиз заблокирован')).toBeInTheDocument();
    // The marker text should be inside a <mark> element.
    const markEl = screen.getByText('заблокирован');
    expect(markEl.tagName).toBe('MARK');
  });

  it('renders the empty state when the data array is empty', () => {
    useQueryMock.mockReturnValue({ data: [], isFetching: false });
    render(<SearchInput scope="mine" />);

    const input = screen.getByRole('combobox');
    act(() => {
      fireEvent.change(input, { target: { value: 'unknown' } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders an error state when search fails', () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
    });
    render(<SearchInput scope="all" />);

    const input = screen.getByRole('combobox');
    act(() => {
      fireEvent.change(input, { target: { value: 'platform' } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  it('navigates via router.push on Enter when a hit is highlighted', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          type: 'item',
          id: ITEM_ID,
          title: 'Test item',
          snippet: 'Test <<item>>',
          rank: 0.9,
          projectId: PROJECT_ID,
          reportId: REPORT_ID,
          reportSectionId: SECTION_ID,
          createdAt: '2026-05-06T08:00:00.000Z',
        },
      ],
      isFetching: false,
    });

    render(<SearchInput scope="mine" />);
    const input = screen.getByRole('combobox');
    act(() => {
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // 35-07 (UX-15): search hits land on the addressed URL.
    expect(pushMock).toHaveBeenCalledWith(
      `/lead/report/${REPORT_ID}#section-${SECTION_ID}`,
    );
  });

  it('clears the input on Escape', () => {
    render(<SearchInput scope="mine" />);
    const input = screen.getByRole('combobox') as HTMLInputElement;

    act(() => {
      fireEvent.change(input, { target: { value: 'release' } });
    });
    expect(input.value).toBe('release');

    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(input.value).toBe('');
  });

  it('forwards scope="all" through to queryOptions', () => {
    render(<SearchInput scope="all" />);
    const input = screen.getByRole('combobox');
    act(() => {
      fireEvent.change(input, { target: { value: 'platform' } });
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const lastQueryOptionsArg = queryOptionsMock.mock.calls.at(-1)?.[0] as
      | { scope?: string }
      | undefined;
    expect(lastQueryOptionsArg?.scope).toBe('all');
  });

  it('routes a project hit to /admin?tab=products', () => {
    useQueryMock.mockReturnValue({
      data: [
        {
          type: 'project',
          id: PROJECT_ID,
          title: 'E-Commerce Platform',
          snippet: '<<E-Commerce>> Platform',
          rank: 0.7,
          projectId: PROJECT_ID,
          createdAt: '2026-05-06T08:00:00.000Z',
        },
      ],
      isFetching: false,
    });

    render(<SearchInput scope="all" />);
    const input = screen.getByRole('combobox');
    act(() => {
      fireEvent.change(input, { target: { value: 'platform' } });
      fireEvent.focus(input);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(pushMock).toHaveBeenCalledWith(
      `/admin?tab=products&filter=${PROJECT_ID}`,
    );
  });
});
