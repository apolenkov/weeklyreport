import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ForbiddenPage } from './forbidden-page';

describe('ForbiddenPage (AUTH-07)', () => {
  it('renders the Access denied heading', () => {
    render(<ForbiddenPage requiredRoles={['head']} />);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('renders the required roles label for a single role', () => {
    render(<ForbiddenPage requiredRoles={['head']} />);
    expect(screen.getByText(/this page requires the head role/i)).toBeInTheDocument();
  });

  it('joins multiple required roles with " or "', () => {
    render(<ForbiddenPage requiredRoles={['head', 'admin']} />);
    expect(screen.getByText(/head or admin/)).toBeInTheDocument();
  });

  it('renders a return-to-home link pointing at /', () => {
    render(<ForbiddenPage requiredRoles={['head']} />);
    const link = screen.getByRole('link', { name: /return to home/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('does NOT leak the user actual role into the DOM (T4)', () => {
    // The component contract is that requiredRoles is the ONLY role-shaped
    // input — no actualRole prop exists, so there is no surface through
    // which the user's role can reach the DOM. Spot-check by ensuring no
    // disallowed string ('viewer' / 'lead') appears when only 'head' is
    // required.
    render(<ForbiddenPage requiredRoles={['head']} />);
    expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\blead\b/i)).not.toBeInTheDocument();
  });
});
