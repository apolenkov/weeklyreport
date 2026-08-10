import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRecordVisibility } from "./use-record-visibility";

const REPORT_A = "report-a";
const REPORT_B = "report-b";
const USER_1 = "user-1";
const USER_2 = "user-2";

function keyFor(userId: string, reportId: string): string {
  return `leadRecordVisibility:${userId}:${reportId}`;
}

// Node 22 + jsdom in this repo do not provide window.localStorage, so the hook
// is exercised against an in-memory Storage stub. The hook's runtime guard
// (readStored/writeStored) tolerates the store being absent entirely.
function installStorageStub(): void {
  const store = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  vi.stubGlobal("localStorage", stub);
  Object.defineProperty(window, "localStorage", {
    value: stub,
    configurable: true,
  });
}

beforeEach(() => {
  installStorageStub();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRecordVisibility", () => {
  it("defaults to mine and reports hydrated once the context resolves", () => {
    const { result } = renderHook(() => useRecordVisibility(USER_1, REPORT_A));
    expect(result.current.visibility).toBe("mine");
    expect(result.current.hydrated).toBe(true);
  });

  it("restores a persisted everyone choice on reload", () => {
    window.localStorage.setItem(keyFor(USER_1, REPORT_A), "everyone");
    const { result } = renderHook(() => useRecordVisibility(USER_1, REPORT_A));
    expect(result.current.visibility).toBe("everyone");
  });

  it("persists the choice under the per-user, per-report key", () => {
    const { result } = renderHook(() => useRecordVisibility(USER_1, REPORT_A));
    act(() => result.current.setVisibility("everyone"));
    expect(window.localStorage.getItem(keyFor(USER_1, REPORT_A))).toBe(
      "everyone",
    );
  });

  it("does not bleed one user's everyone into another user on the same report", () => {
    window.localStorage.setItem(keyFor(USER_1, REPORT_A), "everyone");
    const { result } = renderHook(() => useRecordVisibility(USER_2, REPORT_A));
    expect(result.current.visibility).toBe("mine");
  });

  it("does not carry one report's everyone into another report", () => {
    window.localStorage.setItem(keyFor(USER_1, REPORT_A), "everyone");
    const { result } = renderHook(() => useRecordVisibility(USER_1, REPORT_B));
    expect(result.current.visibility).toBe("mine");
  });

  it("re-scopes the lookup and re-defaults to mine on a user change", () => {
    window.localStorage.setItem(keyFor(USER_1, REPORT_A), "everyone");
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) => useRecordVisibility(userId, REPORT_A),
      { initialProps: { userId: USER_1 } },
    );
    expect(result.current.visibility).toBe("everyone");
    rerender({ userId: USER_2 });
    expect(result.current.visibility).toBe("mine");
  });

  it("stays unhydrated until the user id is known", () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) =>
        useRecordVisibility(userId, REPORT_A),
      { initialProps: { userId: null as string | null } },
    );
    expect(result.current.hydrated).toBe(false);
    rerender({ userId: USER_1 });
    expect(result.current.hydrated).toBe(true);
  });
});
