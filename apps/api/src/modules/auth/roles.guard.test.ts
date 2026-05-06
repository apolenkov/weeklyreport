import { describe, expect, it } from 'vitest';

import type { Role } from '@customreport/shared';

import { createRoleGuard, type GuardContext } from './roles.guard';

describe('createRoleGuard', () => {
  // -----------------------------------------------------------------------
  // Guard creation
  // -----------------------------------------------------------------------

  it('creates a guard for "head" role', () => {
    const guard = createRoleGuard('head');
    expect(guard).toBeDefined();
    expect(typeof guard.canActivate).toBe('function');
  });

  it('creates a guard for "lead" role', () => {
    const guard = createRoleGuard('lead');
    expect(guard).toBeDefined();
  });

  it('creates a guard for "viewer" role', () => {
    const guard = createRoleGuard('viewer');
    expect(guard).toBeDefined();
  });

  it('throws for invalid role string', () => {
    expect(() => createRoleGuard('auditor' as unknown as Role)).toThrow();
  });

  it('creates a guard for "admin" role (Phase 32-c1 widened enum)', () => {
    const guard = createRoleGuard('admin');
    expect(guard).toBeDefined();
  });

  it('throws for empty role string', () => {
    expect(() => createRoleGuard('' as unknown as Role)).toThrow();
  });

  // -----------------------------------------------------------------------
  // Head guard
  // -----------------------------------------------------------------------

  describe('head guard', () => {
    const headGuard = createRoleGuard('head');

    it('allows head user', () => {
      const ctx: GuardContext = { user: { role: 'head' } };
      expect(headGuard.canActivate(ctx)).toBe(true);
    });

    it('denies lead user', () => {
      const ctx: GuardContext = { user: { role: 'lead' } };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });

    it('denies viewer user', () => {
      const ctx: GuardContext = { user: { role: 'viewer' } };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });

    it('denies when user is undefined', () => {
      const ctx: GuardContext = {};
      expect(headGuard.canActivate(ctx)).toBe(false);
    });

    it('denies when user.role is undefined', () => {
      const ctx: GuardContext = { user: {} };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Lead guard
  // -----------------------------------------------------------------------

  describe('lead guard', () => {
    const leadGuard = createRoleGuard('lead');

    it('allows lead user', () => {
      const ctx: GuardContext = { user: { role: 'lead' } };
      expect(leadGuard.canActivate(ctx)).toBe(true);
    });

    it('denies head user', () => {
      const ctx: GuardContext = { user: { role: 'head' } };
      expect(leadGuard.canActivate(ctx)).toBe(false);
    });

    it('denies viewer user', () => {
      const ctx: GuardContext = { user: { role: 'viewer' } };
      expect(leadGuard.canActivate(ctx)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Viewer guard
  // -----------------------------------------------------------------------

  describe('viewer guard', () => {
    const viewerGuard = createRoleGuard('viewer');

    it('allows viewer user', () => {
      const ctx: GuardContext = { user: { role: 'viewer' } };
      expect(viewerGuard.canActivate(ctx)).toBe(true);
    });

    it('denies head user', () => {
      const ctx: GuardContext = { user: { role: 'head' } };
      expect(viewerGuard.canActivate(ctx)).toBe(false);
    });

    it('denies lead user', () => {
      const ctx: GuardContext = { user: { role: 'lead' } };
      expect(viewerGuard.canActivate(ctx)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // P0 Regression — AUTH scenarios
  // -----------------------------------------------------------------------

  describe('head guard — regression (AUTH-039..041)', () => {
    const headGuard = createRoleGuard('head');

    it('allows head for headProcedure (AUTH-041 P0)', () => {
      const ctx: GuardContext = { user: { role: 'head' } };
      expect(headGuard.canActivate(ctx)).toBe(true);
    });

    it('denies lead for headProcedure (AUTH-039 P0)', () => {
      const ctx: GuardContext = { user: { role: 'lead' } };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });

    it('denies viewer for headProcedure (AUTH-040 P0)', () => {
      const ctx: GuardContext = { user: { role: 'viewer' } };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });

    it('denies when role is null', () => {
      const ctx: GuardContext = { user: { role: null as unknown as Role } };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });

    it('denies when role is an arbitrary string', () => {
      const ctx: GuardContext = {
        user: { role: 'superadmin' as unknown as Role },
      };
      expect(headGuard.canActivate(ctx)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('each guard is independent (no shared state)', () => {
      const headGuard = createRoleGuard('head');
      const leadGuard = createRoleGuard('lead');

      const headCtx: GuardContext = { user: { role: 'head' } };
      const leadCtx: GuardContext = { user: { role: 'lead' } };

      expect(headGuard.canActivate(headCtx)).toBe(true);
      expect(headGuard.canActivate(leadCtx)).toBe(false);
      expect(leadGuard.canActivate(leadCtx)).toBe(true);
      expect(leadGuard.canActivate(headCtx)).toBe(false);
    });

    it('guard is reusable across multiple calls', () => {
      const guard = createRoleGuard('head');

      expect(guard.canActivate({ user: { role: 'head' } })).toBe(true);
      expect(guard.canActivate({ user: { role: 'lead' } })).toBe(false);
      expect(guard.canActivate({ user: { role: 'head' } })).toBe(true);
    });
  });
});
