import { describe, expect, it } from 'vitest';

import { verifySamlProfile, type SamlStrategyOptions } from './saml.strategy.js';

const baseOptions = {
  callbackUrl: 'http://localhost/callback',
  entryPoint: 'http://localhost/entry',
  issuer: 'test-issuer',
  idpCert: 'CERT',
  validateInResponseTo: 'never',
  disableRequestedAuthnContext: true,
  signatureAlgorithm: 'sha256',
  digestAlgorithm: 'sha256',
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,
  acceptedClockSkewMs: 0,
} as unknown as SamlStrategyOptions;

const devOptions: SamlStrategyOptions = { ...baseOptions, devMode: true };
const prodOptions: SamlStrategyOptions = { ...baseOptions, devMode: false };

describe('verifySamlProfile (AUTH-02)', () => {
  describe('devMode=true (legacy fallback preserved)', () => {
    it('missing role defaults to viewer (Phase 26 ergonomics)', () => {
      const result = verifySamlProfile(devOptions, {
        nameID: 'u-1',
        email: 'u@example.com',
        displayName: 'U',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe('viewer');
    });

    it('honours role when present', () => {
      const result = verifySamlProfile(devOptions, {
        nameID: 'u-2',
        email: 'h@example.com',
        role: 'head',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe('head');
    });

    it('normalises mixed-case role even in dev mode', () => {
      const result = verifySamlProfile(devOptions, {
        nameID: 'u-3',
        email: 'h@example.com',
        role: 'HEAD',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe('head');
    });
  });

  describe('devMode=false (production strict path)', () => {
    it('rejects a profile without a role attribute (A-2 mitigation)', () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: 'u-1',
        email: 'u@example.com',
        displayName: 'U',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('missing required role attribute');
      }
    });

    it('accepts a valid head profile', () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: 'u-2',
        email: 'head@example.com',
        displayName: 'Head',
        role: 'head',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.profile.role).toBe('head');
        expect(result.profile.email).toBe('head@example.com');
        expect(result.profile.samlId).toBe('u-2');
      }
    });

    it('normalises uppercase role (HEAD → head)', () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: 'u-3',
        email: 'h@example.com',
        role: 'HEAD',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe('head');
    });

    it('rejects an unrecognised role value', () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: 'u-4',
        email: 'bad@example.com',
        role: 'superuser',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('missing required role attribute');
      }
    });

    it('rejects a missing profile', () => {
      const result = verifySamlProfile(prodOptions, null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('SAML profile is missing');
      }
    });
  });
});
