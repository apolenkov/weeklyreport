// @vitest-environment jsdom
import { sessionRoleSchema } from "@weeklyreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LAST_ROLE_STORAGE_KEY,
  type LastRoleRecord,
  readLastRole,
  writeLastRole,
} from "./last-role";

// jsdom 26 has no working localStorage by default — stub an in-memory store
// so the helper's window guards resolve true and exercise real read/write paths.

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  };
}

describe("last-role helper", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sample: LastRoleRecord = {
    role: "head",
    email: "head@weeklyreport.local",
    name: "Антон К.",
  };

  it("round-trips a valid record through localStorage", () => {
    writeLastRole(sample);
    expect(readLastRole()).toEqual(sample);
  });

  it("returns null when nothing is stored", () => {
    expect(readLastRole()).toBeNull();
  });

  it("returns null for malformed JSON without throwing", () => {
    storage.setItem(LAST_ROLE_STORAGE_KEY, "{not-json");
    expect(readLastRole()).toBeNull();
  });

  it("returns null when the stored shape is missing fields", () => {
    storage.setItem(LAST_ROLE_STORAGE_KEY, JSON.stringify({ role: "head" }));
    expect(readLastRole()).toBeNull();
  });

  it("rejects an unknown role token", () => {
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: "superuser",
        email: "x@weeklyreport.local",
        name: "X",
      }),
    );
    expect(readLastRole()).toBeNull();
  });

  it("round-trips every session role (role-type guard parity)", () => {
    for (const role of sessionRoleSchema.options) {
      writeLastRole({ ...sample, role });
      expect(readLastRole()).toEqual({ ...sample, role });
    }
  });

  it("writeLastRole swallows quota errors", () => {
    const setItemSpy = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeLastRole(sample)).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
  });

  it("writeLastRole rejects records with empty email", () => {
    writeLastRole({ ...sample, email: "" });
    expect(readLastRole()).toBeNull();
  });
});
