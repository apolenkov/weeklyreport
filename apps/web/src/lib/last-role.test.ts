/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAST_ROLE_STORAGE_KEY,
  clearLastRole,
  readLastRole,
  writeLastRole,
  type LastRoleRecord,
} from './last-role';

/**
 * UFB-071 (2026-05-11): last-role storage helper tests. Pins the
 * round-trip contract, malformed-value tolerance, and SSR safety.
 *
 * jsdom 26 (via vitest 4) does NOT ship a working `localStorage` by
 * default; we stub a minimal in-memory implementation per test so the
 * helper's `typeof window !== 'undefined'` guards still resolve true
 * and exercise the real read/write code paths.
 */

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  };
}

describe('last-role helper', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sample: LastRoleRecord = {
    role: 'head',
    email: 'head@customreport.local',
    name: 'Антон К.',
  };

  it('round-trips a valid record through localStorage', () => {
    writeLastRole(sample);
    expect(readLastRole()).toEqual(sample);
  });

  it('returns null when nothing is stored', () => {
    expect(readLastRole()).toBeNull();
  });

  it('returns null for malformed JSON without throwing', () => {
    storage.setItem(LAST_ROLE_STORAGE_KEY, '{not-json');
    expect(readLastRole()).toBeNull();
  });

  it('returns null when the stored shape is missing fields', () => {
    storage.setItem(LAST_ROLE_STORAGE_KEY, JSON.stringify({ role: 'head' }));
    expect(readLastRole()).toBeNull();
  });

  it('rejects an unknown role token', () => {
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: 'superuser',
        email: 'x@customreport.local',
        name: 'X',
      }),
    );
    expect(readLastRole()).toBeNull();
  });

  it('clearLastRole removes the key', () => {
    writeLastRole(sample);
    clearLastRole();
    expect(storage.getItem(LAST_ROLE_STORAGE_KEY)).toBeNull();
  });

  it('writeLastRole swallows quota errors', () => {
    const setItemSpy = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeLastRole(sample)).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('writeLastRole rejects records with empty email', () => {
    writeLastRole({ ...sample, email: '' });
    expect(readLastRole()).toBeNull();
  });
});
