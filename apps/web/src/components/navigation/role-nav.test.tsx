import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// JSDOM doesn't implement window.matchMedia (used by SidebarProvider's use-mobile hook)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { RoleNav } from './role-nav';
import { SidebarProvider } from '@customreport/ui';

void React;

afterEach(() => {
  cleanup();
});

describe('RoleNav', () => {
  it('shows My Report for lead users and hides the head dashboard entry', () => {
    render(<SidebarProvider><RoleNav role="lead" currentPath="/lead/report" /></SidebarProvider>);

    expect(screen.getByRole('link', { name: 'My Report' })).toHaveAttribute('href', '/lead/report');
    expect(screen.queryByRole('link', { name: 'Review Dashboard' })).not.toBeInTheDocument();
  });

  it('shows Review Dashboard for head users', () => {
    render(
      <SidebarProvider>
        <RoleNav
          activeReportId="22222222-2222-4222-8222-222222222222"
          role="head"
          currentPath="/head/dashboard"
        />
      </SidebarProvider>,
    );

    expect(screen.getByRole('link', { name: 'Review Dashboard' })).toHaveAttribute(
      'href',
      '/head/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Published Report' })).toHaveAttribute(
      'href',
      '/reports/22222222-2222-4222-8222-222222222222',
    );
    expect(screen.getByRole('link', { name: 'Report History' })).toHaveAttribute(
      'href',
      '/reports/history',
    );
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('shows only the published report route for viewer users', () => {
    render(
      <SidebarProvider>
        <RoleNav
          activeReportId="22222222-2222-4222-8222-222222222222"
          role="viewer"
          currentPath="/reports/22222222-2222-4222-8222-222222222222"
        />
      </SidebarProvider>,
    );

    expect(screen.queryByRole('link', { name: 'My Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Published Report' })).toHaveAttribute(
      'href',
      '/reports/22222222-2222-4222-8222-222222222222',
    );
    expect(screen.getByRole('link', { name: 'Report History' })).toHaveAttribute(
      'href',
      '/reports/history',
    );
  });
});
