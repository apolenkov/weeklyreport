import { describe, expect, it } from 'vitest';

import { buildLoginRedirect, shouldRedirectToLogin } from '../../proxy';
import { extractSessionToken, parseSessionPayload } from './session';

describe('web auth session helpers', () => {
  it('redirects anonymous users to login for protected routes', () => {
    expect(shouldRedirectToLogin('/lead/report', {})).toBe(true);
    expect(buildLoginRedirect('http://localhost:3000/lead/report', 'http://localhost:3001/auth/saml/login')).toContain('redirectTo=');
  });

  it('does not redirect authenticated users with a session cookie', () => {
    expect(
      shouldRedirectToLogin('/head/dashboard', {
        customreport_session: 'signed-token',
      }),
    ).toBe(false);
  });

  it('extracts and validates session payloads across refreshes', () => {
    const token = extractSessionToken('customreport_session=signed-token; Path=/; HttpOnly');
    const session = parseSessionPayload({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'viewer@customreport.local',
      name: 'Viewer',
      role: 'viewer',
      activeReportId: null,
      activeReportSectionId: null,
    });

    expect(token).toBe('signed-token');
    expect(session.role).toBe('viewer');
  });
});
