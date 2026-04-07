import { describe, expect, it } from 'vitest';

import { createAuthController } from './auth.controller';
import { createRoleGuard } from './roles.guard';

const env = {
  AUTH_JWT_SECRET: 'phase-01-secret',
  AUTH_JWT_COOKIE_NAME: 'customreport_session',
  KEYCLOAK_SAML_CALLBACK_URL: 'http://localhost:3001/auth/saml/callback',
  KEYCLOAK_SAML_ENTRY_POINT: 'http://localhost:8080/realms/customreport/protocol/saml',
  KEYCLOAK_SAML_ISSUER: 'customreport',
  KEYCLOAK_SAML_CERT: 'CERT_DATA',
  NODE_ENV: 'test',
} satisfies NodeJS.ProcessEnv;

describe('auth controller and roles guard', () => {
  it('issues an httpOnly JWT cookie for a valid SAML-derived session', () => {
    const controller = createAuthController(env);
    const issued = controller.issueSessionCookie({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'lead1@customreport.local',
      name: 'Lead 1',
      role: 'lead',
      activeReportId: '22222222-2222-4222-8222-222222222222',
      activeReportSectionId: '33333333-3333-4333-8333-333333333333',
    });

    expect(issued.setCookieHeader).toContain('customreport_session=');
    expect(issued.setCookieHeader).toContain('HttpOnly');
  });

  it('restores the session payload from the JWT cookie token', () => {
    const controller = createAuthController(env);
    const issued = controller.issueSessionCookie({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'head@customreport.local',
      name: 'Department Head',
      role: 'head',
      activeReportId: '22222222-2222-4222-8222-222222222222',
      activeReportSectionId: null,
    });

    const restored = controller.verifySessionToken(issued.token);

    expect(restored.role).toBe('head');
    expect(restored.email).toBe('head@customreport.local');
  });

  it('blocks access when a user does not have the required role', () => {
    const guard = createRoleGuard('head');

    expect(guard.canActivate({ user: { role: 'lead' } })).toBe(false);
    expect(guard.canActivate({ user: { role: 'head' } })).toBe(true);
  });
});
