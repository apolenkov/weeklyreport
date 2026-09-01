// @vitest-environment jsdom
// Data-loading hook pins cover query enablement, visibility gating, purge, and
// redirects; end-to-end coverage stays in the LeadForm suites.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionState } from "../../../../../shared/lib/auth/session-provider";
import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { logClientError } from "../../../../../shared/lib/errors/client-error-reporting";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { useLeadFormData } from "./use-lead-form-data";

const navState: {
  replace: ReturnType<typeof vi.fn>;
  searchParams: URLSearchParams;
} = {
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navState.replace, push: vi.fn() }),
  useSearchParams: () => navState.searchParams,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock(
  "../../../../../shared/lib/errors/client-error-reporting",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../../shared/lib/errors/client-error-reporting")
    >()),
    logClientError: vi.fn(),
  }),
);

const REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PINNED_REPORT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const VISIBILITY_KEY = `leadRecordVisibility:${USER_ID}:${REPORT_ID}`;

// Node 22 + jsdom in this repo do not provide window.localStorage, so the
// persisted-visibility path is exercised against an in-memory Storage stub
// (same recipe as use-record-visibility.test.ts).
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

function makeSection() {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: USER_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    status: "draft" as const,
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  };
}

function makeSession(
  overrides: Partial<SessionState> = {},
  userId: string = USER_ID,
): SessionState {
  return {
    user: {
      id: userId,
      name: "Test Lead",
      email: "lead@example.com",
      role: "lead",
    },
    organization: null,
    isLoading: false,
    isAuthenticated: true,
    ...overrides,
  };
}

function buildTRPC(
  active: unknown = {
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    authorName: "Test Lead",
  },
  failures: { viewSettings?: boolean; crossAuthors?: boolean } = {},
  byPeriodQueryFn?: (input: unknown) => unknown,
) {
  const byPeriodSpy = vi.fn();
  const contentSpy = vi.fn();
  const { proxy } = createMockTRPC([
    { path: ["reports", "getActive"], query: active },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "viewSettings"],
      query: failures.viewSettings
        ? Promise.reject(new Error("view settings failed"))
        : { unifiedActivityView: false },
    },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) => {
        byPeriodSpy(input);
        if (byPeriodQueryFn) return byPeriodQueryFn(input);
        return {
          section: makeSection(),
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        };
      },
    },
    {
      path: ["leadForm", "crossAuthors"],
      queryByInput: () =>
        failures.crossAuthors
          ? Promise.reject(new Error("cross authors failed"))
          : [],
    },
    {
      path: ["leadForm", "crossAuthorContent"],
      queryByInput: (input) => {
        contentSpy(input);
        return [];
      },
    },
  ]);
  return { proxy, byPeriodSpy, contentSpy };
}

interface HarnessOptions {
  session?: SessionState;
  active?: unknown;
  pinnedReportId?: string;
  redirectToCanonical?: boolean;
  isSlidesMode?: boolean;
  queryFailures?: { viewSettings?: boolean; crossAuthors?: boolean };
  byPeriodQueryFn?: (input: unknown) => unknown;
}

function renderData(options: HarnessOptions = {}) {
  const trpc = buildTRPC(
    options.active,
    options.queryFailures,
    options.byPeriodQueryFn,
  );
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const sessionHolder = { current: options.session ?? makeSession() };
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc.proxy}>
          <SessionContext.Provider value={sessionHolder.current}>
            {children}
          </SessionContext.Provider>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const rendered = renderHook(
    () =>
      useLeadFormData({
        isSlidesMode: options.isSlidesMode ?? false,
        ...(options.pinnedReportId !== undefined
          ? { reportId: options.pinnedReportId }
          : {}),
        ...(options.redirectToCanonical !== undefined
          ? { redirectToCanonical: options.redirectToCanonical }
          : {}),
      }),
    { wrapper: Wrapper },
  );
  return { ...rendered, ...trpc, qc, sessionHolder };
}

beforeEach(() => {
  vi.clearAllMocks();
  installStorageStub();
  navState.replace = vi.fn();
  navState.searchParams = new URLSearchParams();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLeadFormData — query enablement", () => {
  it("does not fetch byPeriod while the session is loading", async () => {
    const { result, byPeriodSpy } = renderData({
      session: makeSession({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      }),
    });

    await waitFor(() => expect(result.current.activeReportId).toBe(REPORT_ID));
    expect(byPeriodSpy).not.toHaveBeenCalled();
    expect(result.current.byPeriodData).toBeUndefined();
  });

  it("does not fetch byPeriod for a head-like session", async () => {
    const { result, byPeriodSpy } = renderData({
      session: makeSession({
        user: {
          id: USER_ID,
          name: "Test Head",
          email: "head@example.com",
          role: "head",
        },
      }),
    });

    await waitFor(() => expect(result.current.activeReportId).toBe(REPORT_ID));
    expect(byPeriodSpy).not.toHaveBeenCalled();
    expect(result.current.awaitingRoleRedirect).toBe(true);
  });

  it("does not fetch byPeriod when no report is resolvable", async () => {
    const { result, byPeriodSpy } = renderData({ active: null });

    await waitFor(() => expect(result.current.activeData).toBeNull());
    expect(result.current.targetReportId).toBeNull();
    expect(byPeriodSpy).not.toHaveBeenCalled();
  });

  it("prefers the pinned route report id over the active period", async () => {
    const { result, byPeriodSpy } = renderData({
      pinnedReportId: PINNED_REPORT_ID,
    });

    await waitFor(() =>
      expect(byPeriodSpy).toHaveBeenCalledWith({ reportId: PINNED_REPORT_ID }),
    );
    expect(result.current.targetReportId).toBe(PINNED_REPORT_ID);
    await waitFor(() =>
      expect(result.current.sectionIdForActions).toBe(SECTION_ID),
    );
  });

  it("exposes the primary-read error and keeps it during an in-flight retry", async () => {
    let shouldFail = true;
    let resolveRetry!: (value: unknown) => void;
    const retryPromise = new Promise<unknown>((resolve) => {
      resolveRetry = resolve;
    });
    const { result, byPeriodSpy } = renderData({
      byPeriodQueryFn: () => {
        if (shouldFail) return Promise.reject(new Error("section unavailable"));
        return retryPromise;
      },
    });

    await waitFor(() => expect(result.current.byPeriodError).toBe(true));
    expect(result.current.byPeriodData).toBeUndefined();
    expect(result.current.byPeriodFetching).toBe(false);

    shouldFail = false;
    let retry!: Promise<unknown>;
    let duplicateRetry!: Promise<unknown>;
    act(() => {
      retry = result.current.retrySection();
      duplicateRetry = result.current.retrySection();
    });
    expect(duplicateRetry).toBe(retry);
    await waitFor(() => {
      expect(result.current.byPeriodError).toBe(true);
      expect(result.current.byPeriodFetching).toBe(true);
    });
    expect(byPeriodSpy).toHaveBeenCalledTimes(2);

    resolveRetry({
      section: makeSection(),
      readOnly: false,
      canRequestReopen: false,
      publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    });
    await act(async () => {
      await retry;
    });
    await waitFor(() => {
      expect(result.current.byPeriodError).toBe(false);
      expect(result.current.byPeriodFetching).toBe(false);
      expect(result.current.byPeriodData).toBeDefined();
    });
    expect(logClientError).toHaveBeenCalledTimes(1);
  });

  it("keeps the primary-read error after a retry fails again", async () => {
    const byPeriodQueryFn = vi.fn(() =>
      Promise.reject(new Error("section still unavailable")),
    );
    const { result, byPeriodSpy } = renderData({ byPeriodQueryFn });

    await waitFor(() => expect(result.current.byPeriodError).toBe(true));
    await act(async () => {
      await result.current.retrySection();
    });

    await waitFor(() => {
      expect(result.current.byPeriodError).toBe(true);
      expect(result.current.byPeriodFetching).toBe(false);
    });
    expect(byPeriodSpy).toHaveBeenCalledTimes(2);
    expect(logClientError).toHaveBeenCalledTimes(2);
  });
});

describe("useLeadFormData — full-content gating", () => {
  it("issues no crossAuthorContent fetch in the default Mine state", async () => {
    const { result, contentSpy } = renderData();

    await waitFor(() => expect(result.current.visibilityHydrated).toBe(true));
    expect(result.current.isEveryone).toBe(false);
    expect(contentSpy).not.toHaveBeenCalled();
  });

  it("fetches crossAuthorContent once hydrated Everyone on an own deck", async () => {
    window.localStorage.setItem(VISIBILITY_KEY, "everyone");
    const { result, contentSpy } = renderData();

    await waitFor(() =>
      expect(contentSpy).toHaveBeenCalledWith({ reportId: REPORT_ID }),
    );
    expect(result.current.isEveryone).toBe(true);
    expect(result.current.toolbarVisibility).toBe("everyone");
  });

  it("never fetches crossAuthorContent on a foreign slides deck", async () => {
    window.localStorage.setItem(VISIBILITY_KEY, "everyone");
    navState.searchParams = new URLSearchParams(`authorId=${OTHER_USER_ID}`);
    const { result, contentSpy } = renderData({ isSlidesMode: true });

    await waitFor(() => expect(result.current.visibilityHydrated).toBe(true));
    expect(result.current.isForeignSlidesDeck).toBe(true);
    expect(result.current.recordVisibility).toBe("everyone");
    expect(result.current.toolbarVisibility).toBe("mine");
    expect(contentSpy).not.toHaveBeenCalled();
  });
});

describe("useLeadFormData — foreign-content purge guard", () => {
  it("purges cached content on leaving Everyone and re-fetches on return", async () => {
    window.localStorage.setItem(VISIBILITY_KEY, "everyone");
    const { result, contentSpy, qc } = renderData();

    await waitFor(() => expect(contentSpy).toHaveBeenCalled());
    const removeSpy = vi.spyOn(qc, "removeQueries");

    act(() => {
      result.current.setRecordVisibility("mine");
    });

    await waitFor(() =>
      expect(removeSpy).toHaveBeenCalledWith({
        queryKey: [["leadForm", "crossAuthorContent"]],
      }),
    );

    contentSpy.mockClear();
    act(() => {
      result.current.setRecordVisibility("everyone");
    });
    await waitFor(() =>
      expect(contentSpy).toHaveBeenCalledWith({ reportId: REPORT_ID }),
    );
  });

  it("purges cached content unconditionally on identity change", async () => {
    const { result, qc, sessionHolder, rerender } = renderData();

    await waitFor(() => expect(result.current.visibilityHydrated).toBe(true));
    const removeSpy = vi.spyOn(qc, "removeQueries");
    removeSpy.mockClear();

    sessionHolder.current = makeSession({}, OTHER_USER_ID);
    rerender();

    await waitFor(() =>
      expect(removeSpy).toHaveBeenCalledWith({
        queryKey: [["leadForm", "crossAuthorContent"]],
      }),
    );
  });
});

describe("useLeadFormData — redirects", () => {
  it("replaces the bare route with the canonical addressed URL", async () => {
    renderData({ redirectToCanonical: true });

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith(
        `/lead/report/${REPORT_ID}`,
      ),
    );
  });

  it("preserves slides mode in the canonical redirect", async () => {
    renderData({ redirectToCanonical: true, isSlidesMode: true });

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith(
        `/lead/report/${REPORT_ID}?mode=slides`,
      ),
    );
  });

  it("does not redirect when the route is already addressed", async () => {
    const { result } = renderData({
      pinnedReportId: PINNED_REPORT_ID,
      redirectToCanonical: false,
    });

    await waitFor(() => expect(result.current.activeReportId).toBe(REPORT_ID));
    expect(navState.replace).not.toHaveBeenCalled();
  });

  it("routes a head-like session away from the lead form", async () => {
    renderData({
      session: makeSession({
        user: {
          id: USER_ID,
          name: "Test Head",
          email: "head@example.com",
          role: "head",
        },
      }),
    });

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith("/head/dashboard"),
    );
  });

  it("routes a head-like session to the addressed head report when pinned", async () => {
    renderData({
      pinnedReportId: PINNED_REPORT_ID,
      session: makeSession({
        user: {
          id: USER_ID,
          name: "Test Admin",
          email: "admin@example.com",
          role: "admin",
        },
      }),
    });

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith(
        `/head/report/${encodeURIComponent(PINNED_REPORT_ID)}`,
      ),
    );
  });
});

describe("useLeadFormData — auxiliary query failure surfacing", () => {
  it("toasts when the view-settings query fails instead of silently degrading", async () => {
    renderData({ queryFailures: { viewSettings: true } });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load form settings"),
      ),
    );
    expect(logClientError).toHaveBeenCalledWith(
      "leadForm.viewSettings.load_failed",
      expect.objectContaining({ message: "view settings failed" }),
      expect.objectContaining({
        component: "LeadForm",
        procedure: "leadForm.viewSettings",
      }),
    );
  });

  it("toasts when the cross-authors query fails instead of silently returning an empty roster", async () => {
    renderData({ queryFailures: { crossAuthors: true } });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load cross-author data"),
      ),
    );
    expect(logClientError).toHaveBeenCalledWith(
      "leadForm.crossAuthors.load_failed",
      expect.objectContaining({ message: "cross authors failed" }),
      expect.objectContaining({
        component: "LeadForm",
        procedure: "leadForm.crossAuthors",
      }),
    );
  });
});
