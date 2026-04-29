import { describe, expect, it } from 'vitest';

import type { AppLogger } from './logger.js';
import { createAuditLogger, createNullAuditLogger } from './audit-logger.js';

type Captured = { level: 'info' | 'warn' | 'error' | 'debug'; message: string; context?: Record<string, unknown> };

function makeCapturingLogger(): { logger: AppLogger; entries: Captured[] } {
  const entries: Captured[] = [];
  const push = (level: Captured['level']) =>
    (message: string, context?: Record<string, unknown>) => {
      entries.push({ level, message, context });
    };
  const logger: AppLogger = {
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    child() {
      return logger;
    },
  };
  return { logger, entries };
}

describe('createAuditLogger', () => {
  it('loginSuccess emits exactly the {event, userId, role, ip} envelope on info', () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginSuccess({
      userId: 'u1',
      role: 'lead',
      ip: '10.0.0.1',
    });

    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('audit');
    expect(entry.context).toEqual({
      event: 'login-success',
      userId: 'u1',
      role: 'lead',
      ip: '10.0.0.1',
    });
    // Whitelist enforced — attemptedRole MUST NOT appear on a login-success
    // envelope; the type system blocks it at compile time and the
    // implementation never spreads extra keys.
    expect(Object.keys(entry.context ?? {})).not.toContain('attemptedRole');
  });

  it('roleDenied emits the {event, userId, role, attemptedRole, ip} envelope on warn', () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.roleDenied({
      userId: 'viewer-1',
      role: 'viewer',
      attemptedRole: ['head'],
      ip: '10.0.0.2',
    });

    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('audit');
    expect(entry.context).toEqual({
      event: 'role-denied',
      userId: 'viewer-1',
      role: 'viewer',
      attemptedRole: ['head'],
      ip: '10.0.0.2',
    });
  });

  it('loginFail carries the reason and emits on warn', () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginFail({
      userId: 'anonymous',
      role: 'unknown',
      ip: '10.0.0.3',
      reason: 'token-verify-failed',
    });

    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.level).toBe('warn');
    expect(entry.context).toEqual({
      event: 'login-fail',
      userId: 'anonymous',
      role: 'unknown',
      ip: '10.0.0.3',
      reason: 'token-verify-failed',
    });
  });

  it('logout emits {event, userId, role, ip} on info', () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.logout({
      userId: 'u9',
      role: 'head',
      ip: '127.0.0.1',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.context).toEqual({
      event: 'logout',
      userId: 'u9',
      role: 'head',
      ip: '127.0.0.1',
    });
  });

  it('no SAML / cookie / token field can leak into the audit envelope', () => {
    const { logger, entries } = makeCapturingLogger();
    const audit = createAuditLogger(logger);

    audit.loginSuccess({
      userId: 'u1',
      role: 'lead',
      ip: '10.0.0.1',
    });
    audit.roleDenied({
      userId: 'u2',
      role: 'viewer',
      attemptedRole: 'head',
      ip: '10.0.0.4',
    });

    const forbidden = ['samlAssertion', 'nameID', 'cookie', 'token', 'password', 'authorization'];
    for (const entry of entries) {
      const keys = Object.keys(entry.context ?? {});
      for (const banned of forbidden) {
        expect(keys).not.toContain(banned);
      }
    }
  });
});

describe('createNullAuditLogger', () => {
  it('all methods are no-ops and do not throw', () => {
    const audit = createNullAuditLogger();
    expect(() =>
      audit.loginSuccess({ userId: 'u', role: 'lead', ip: 'x' }),
    ).not.toThrow();
    expect(() =>
      audit.loginFail({ userId: 'u', role: 'unknown', ip: 'x', reason: 'r' }),
    ).not.toThrow();
    expect(() => audit.logout({ userId: 'u', role: 'lead', ip: 'x' })).not.toThrow();
    expect(() =>
      audit.roleDenied({ userId: 'u', role: 'viewer', attemptedRole: 'head', ip: 'x' }),
    ).not.toThrow();
  });
});
