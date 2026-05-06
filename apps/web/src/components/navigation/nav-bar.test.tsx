import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Role } from '@customreport/shared';

vi.mock('next/navigation', () => ({
  usePathname: () => '/lead/report',
}));

const useSessionMock = vi.fn();
vi.mock('../../lib/session-provider', () => ({
  useSession: () => useSessionMock(),
}));

// Phase 33-04: NavBar now reads the active period via tRPC for the right-rail
// badge. Tests don't exercise that surface — stub the proxy to a minimal
// object that satisfies `trpc.weeklyReport.get.queryOptions(...)` calls.
vi.mock('../../lib/trpc-context', () => ({
  useTRPC: () => ({
    weeklyReport: {
      get: {
        queryOptions: () => ({
          queryKey: ['weeklyReport', 'get'],
          queryFn: async () => null,
          enabled: false,
        }),
      },
    },
  }),
}));

// useQuery without a real QueryClientProvider would crash; stub it for these
// role-visibility tests since we don't care about the period badge here.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
}));

import { NavBar } from './nav-bar';

function setRole(role: Role | null): void {
  if (role === null) {
    useSessionMock.mockReturnValue({ user: null, isLoading: true, isAuthenticated: false });
  } else {
    useSessionMock.mockReturnValue({
      user: { id: 'u1', name: 'Test User', email: 't@test.local', role },
      isLoading: false,
      isAuthenticated: true,
    });
  }
}

describe('NavBar — AUTH-06 role-aware visibility (Phase 29-06)', () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it('viewer does NOT see /admin link in the DOM', () => {
    setRole('viewer');
    render(<NavBar />);
    expect(screen.queryByRole('link', { name: /Админка/ })).toBeNull();
  });

  it('viewer does NOT see /head/* links (Dashboard, Weekly Report)', () => {
    setRole('viewer');
    render(<NavBar />);
    expect(screen.queryByRole('link', { name: /Дашборд/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Сводка/i })).toBeNull();
  });

  it('viewer does NOT see /lead/* links (My Report, History)', () => {
    setRole('viewer');
    render(<NavBar />);
    expect(screen.queryByRole('link', { name: /Мой отчёт/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Моя история/i })).toBeNull();
  });

  it('viewer DOES see /reports/* links (Archive)', () => {
    setRole('viewer');
    render(<NavBar />);
    // Multiple /reports links may render (desktop + mobile nav) — getAllByRole.
    const reportsLinks = screen.getAllByRole('link', { name: /Архив/i });
    expect(reportsLinks.length).toBeGreaterThan(0);
  });

  it('lead does NOT see /head/* links but DOES see /lead/* and /reports/*', () => {
    setRole('lead');
    render(<NavBar />);
    expect(screen.queryByRole('link', { name: /Дашборд/i })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Мой отчёт/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Архив/i }).length).toBeGreaterThan(0);
  });

  it('lead does NOT see /admin link', () => {
    setRole('lead');
    render(<NavBar />);
    expect(screen.queryByRole('link', { name: /Админка/ })).toBeNull();
  });

  it('head sees /admin link in the DOM', () => {
    setRole('head');
    render(<NavBar />);
    expect(screen.getAllByRole('link', { name: /Админка/ }).length).toBeGreaterThan(0);
  });

  it('head sees /head/* links (Dashboard, Weekly Report)', () => {
    setRole('head');
    render(<NavBar />);
    expect(screen.getAllByRole('link', { name: /Дашборд/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Сводка/i }).length).toBeGreaterThan(0);
  });

  it('admin sees /admin link', () => {
    setRole('admin');
    render(<NavBar />);
    expect(screen.getAllByRole('link', { name: /Админка/ }).length).toBeGreaterThan(0);
  });

  it('null session (still loading) renders NO role-gated links', () => {
    setRole(null);
    render(<NavBar />);
    expect(screen.queryByRole('link', { name: /Админка/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Дашборд/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Мой отчёт/i })).toBeNull();
  });

  it('hidden links are absent from the DOM (filtered before render — not CSS-hidden)', () => {
    // T0 invariant from the plan: queryByText returning null is the proof.
    // Critical for AUTH-06 — a hostile viewer who reads the rendered HTML must
    // see no enumeration of /admin or /head routes.
    setRole('viewer');
    const { container } = render(<NavBar />);
    expect(container.innerHTML).not.toContain('href="/admin"');
    expect(container.innerHTML).not.toContain('href="/head/dashboard"');
    expect(container.innerHTML).not.toContain('href="/head/report"');
    expect(container.innerHTML).not.toContain('href="/lead/report"');
  });
});
