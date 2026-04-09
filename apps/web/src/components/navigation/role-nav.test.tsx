import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RoleNav } from './role-nav';

void React;

afterEach(() => {
  cleanup();
});

describe('RoleNav', () => {
  it('shows My Report for lead users and hides the head dashboard entry', () => {
    render(<RoleNav role="lead" currentPath="/lead/report" />);

    expect(screen.getByRole('link', { name: 'My Report' })).toHaveAttribute('href', '/lead/report');
    expect(screen.queryByRole('link', { name: 'Review Dashboard' })).not.toBeInTheDocument();
  });

  it('shows Review Dashboard for head users', () => {
    render(
      <RoleNav
        activeReportId="22222222-2222-4222-8222-222222222222"
        role="head"
        currentPath="/head/dashboard"
      />,
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
      <RoleNav
        activeReportId="22222222-2222-4222-8222-222222222222"
        role="viewer"
        currentPath="/reports/22222222-2222-4222-8222-222222222222"
      />,
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
