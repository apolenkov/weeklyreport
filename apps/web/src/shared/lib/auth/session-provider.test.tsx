import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  type QueryObserverOptions,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { type UserSession, userSessionSchema } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { TRPCProxyContext } from "../trpc/trpc-context";
import { LAST_ROLE_STORAGE_KEY, readLastRole } from "./last-role";
import { SessionProvider, useSession } from "./session-provider";

const session = userSessionSchema.parse({
  userId: "a0000000-0000-4000-8000-000000000099",
  email: "head@example.test",
  name: "Synthetic Head",
  lastName: "Head",
  firstName: "Synthetic",
  middleName: "Operations",
  role: "head",
  activeReportId: "a0000000-0000-4000-8000-000000000001",
  activeReportSectionId: null,
  reportingGroupName: "Synthetic Group",
});
const clients: QueryClient[] = [];

function buildHarness(
  queryFn: () => UserSession | null | Promise<UserSession | null> = () =>
    session,
  queryOptions: Pick<QueryObserverOptions, "retry" | "retryDelay"> = {
    retry: false,
  },
) {
  const { proxy } = createMockTRPC([{ path: ["auth", "me"], query: queryFn }]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: queryOptions, mutations: { retry: false } },
  });
  clients.push(queryClient);
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          <SessionProvider>{children}</SessionProvider>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "true");
  window.localStorage.removeItem(LAST_ROLE_STORAGE_KEY);
});
afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients) client.clear();
  clients.length = 0;
  window.localStorage.removeItem(LAST_ROLE_STORAGE_KEY);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("SessionProvider + useSession", () => {
  it("returns loading state while auth.me is in flight", () => {
    const { Wrapper } = buildHarness(
      () => new Promise<UserSession>(() => undefined),
    );
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    expect(result.current).toEqual({
      user: null,
      organization: null,
      isLoading: true,
      isAuthenticated: false,
    });
  });

  it("keeps loading while the retry after a failed first auth.me is paused offline", async () => {
    // Real producer: the first auth.me fails, then the browser goes offline
    // before the retry, so the query stays pending with fetchStatus "paused".
    const { Wrapper, queryClient } = buildHarness(
      () => {
        onlineManager.setOnline(false);
        return Promise.reject(new Error("auth.me unavailable"));
      },
      { retry: 1, retryDelay: 0 },
    );
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });

    await waitFor(() => {
      const [query] = queryClient.getQueryCache().getAll();
      expect(query?.state).toMatchObject({
        status: "pending",
        fetchStatus: "paused",
        fetchFailureCount: 1,
      });
    });
    expect(result.current).toEqual({
      user: null,
      organization: null,
      isLoading: true,
      isAuthenticated: false,
    });
  });

  it("returns authenticated state and persists the dev role hint when auth.me resolves", async () => {
    const { Wrapper } = buildHarness();
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toEqual({
      id: session.userId,
      name: session.name,
      lastName: session.lastName,
      firstName: session.firstName,
      middleName: session.middleName,
      email: session.email,
      role: session.role,
      reportingGroupName: session.reportingGroupName,
    });
    expect(readLastRole()).toEqual({
      role: session.role,
      email: session.email,
      name: session.name,
    });
  });

  it("hydrates organization onto SessionState when auth.me carries it", async () => {
    const organization = {
      shortName: "SYN",
      fullName: "Synthetic Organization",
    };
    const { Wrapper } = buildHarness(() =>
      userSessionSchema.parse({ ...session, organization }),
    );
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(result.current.organization).toEqual(organization),
    );
  });

  it("returns unauthenticated state when auth.me resolves with null", async () => {
    const { Wrapper } = buildHarness(() => null);
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({
      user: null,
      organization: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it("blocks protected content and retries when auth.me fails", async () => {
    let attempts = 0;
    const { Wrapper } = buildHarness(() =>
      ++attempts === 1
        ? Promise.reject(new Error("Synthetic network failure"))
        : session,
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<p>Protected report</p>, { wrapper: Wrapper });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not verify your session.",
    );
    expect(screen.queryByText("Protected report")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Protected report")).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("throws a clear error when useSession() is called outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useSession())).toThrow(
      /useSession must be used within <SessionProvider>/,
    );
  });
});

describe("SessionProvider dev resume persistence boundary", () => {
  it.each(["false", "true"])(
    "does not persist personal resume data in production with auth stub %s",
    async (flag) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", flag);
      const write = vi.spyOn(Storage.prototype, "setItem");
      const { Wrapper } = buildHarness();
      const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
      expect(write).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(LAST_ROLE_STORAGE_KEY)).toBeNull();
    },
  );

  it("does not persist resume data when the development auth stub is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "false");
    const { Wrapper } = buildHarness();
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(window.localStorage.getItem(LAST_ROLE_STORAGE_KEY)).toBeNull();
  });

  it("retains the enabled dev resume hint after the session becomes anonymous", async () => {
    let current: UserSession | null = session;
    const { Wrapper, queryClient } = buildHarness(() => current);
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    const hint = readLastRole();
    expect(hint).toEqual({
      role: session.role,
      email: session.email,
      name: session.name,
    });
    current = null;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(readLastRole()).toEqual(hint);
  });
});
