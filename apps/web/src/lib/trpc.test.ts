import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCClientError } from '@trpc/client';

import { createAuthRedirectHandler } from './trpc';

// ---------------------------------------------------------------------------
// Helpers — build a fake TRPCClientError with the desired httpStatus.
// ---------------------------------------------------------------------------

function makeUnauthorizedError(): TRPCClientError<never> {
  const err = new TRPCClientError<never>('UNAUTHORIZED');
  // The `data` property is read by the link to determine the HTTP status.
  Object.defineProperty(err, 'data', {
    value: { httpStatus: 401, code: 'UNAUTHORIZED' },
    configurable: true,
  });
  return err;
}

function makeServerError(): TRPCClientError<never> {
  const err = new TRPCClientError<never>('INTERNAL_SERVER_ERROR');
  Object.defineProperty(err, 'data', {
    value: { httpStatus: 500, code: 'INTERNAL_SERVER_ERROR' },
    configurable: true,
  });
  return err;
}

// ---------------------------------------------------------------------------
// window.location stubs
// ---------------------------------------------------------------------------

let assignSpy: ReturnType<typeof vi.fn>;

function stubLocation(pathname: string, search = '') {
  assignSpy = vi.fn();
  const fakeLocation = {
    pathname,
    search,
    href: `http://localhost:3000${pathname}${search}`,
    assign: assignSpy,
  };
  vi.stubGlobal('window', { location: fakeLocation });
}

beforeEach(() => {
  assignSpy = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests for the auth-redirect handler — pure function, no observable
// machinery required to validate the redirect logic.
// ---------------------------------------------------------------------------

describe('createAuthRedirectHandler — 401 interceptor logic', () => {
  it('redirects to /?next=<encoded-path> on 401 from a protected page', () => {
    stubLocation('/lead/report');
    const handled = createAuthRedirectHandler()(makeUnauthorizedError());
    expect(handled).toBe(true);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/?next=%2Flead%2Freport');
  });

  it('preserves query string in the next= parameter', () => {
    stubLocation('/lead/report', '?period=2026-W17');
    createAuthRedirectHandler()(makeUnauthorizedError());
    expect(assignSpy).toHaveBeenCalledWith(
      '/?next=%2Flead%2Freport%3Fperiod%3D2026-W17',
    );
  });

  it('does not redirect when already on / (login page)', () => {
    stubLocation('/');
    const handled = createAuthRedirectHandler()(makeUnauthorizedError());
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does not redirect when on /auth/error', () => {
    stubLocation('/auth/error');
    const handled = createAuthRedirectHandler()(makeUnauthorizedError());
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does not redirect on non-401 errors', () => {
    stubLocation('/lead/report');
    const handled = createAuthRedirectHandler()(makeServerError());
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does not redirect on plain Error objects (non-TRPCClientError)', () => {
    stubLocation('/lead/report');
    const handled = createAuthRedirectHandler()(new Error('boom'));
    expect(handled).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
