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
    render(<RoleNav role="head" currentPath="/head/dashboard" />);

    expect(screen.getByRole('link', { name: 'Review Dashboard' })).toHaveAttribute(
      'href',
      '/head/dashboard',
    );
  });

  it('shows no phase-one working links for viewer users', () => {
    render(<RoleNav role="viewer" currentPath="/" />);

    expect(screen.queryByRole('link', { name: 'My Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review Dashboard' })).not.toBeInTheDocument();
  });
});
