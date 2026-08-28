import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — replace useTRPC and useQuery before importing the module under test.
// We test the provider's mapping logic, not the network or React Query wiring.
// ---------------------------------------------------------------------------

const useQueryMock = vi.fn();
const writeLastRoleMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (...args: unknown[]): unknown => useQueryMock(...args),
  };
});

vi.mock("../trpc/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({ queryKey: ["auth.me"] }),
      },
    },
  }),
}));

vi.mock("./last-role", () => ({
  writeLastRole: writeLastRoleMock,
}));

// Imports after mocks
import { SessionProvider, useSession } from "./session-provider";

beforeEach(() => {
  useQueryMock.mockReset();
  writeLastRoleMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe("SessionProvider + useSession", () => {
  it("returns loading state while auth.me is in flight", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current).toEqual({
      user: null,
      // SessionState exposes an `organization` slot hydrated from the API.
      // Loading/unauthenticated states carry null.
      organization: null,
      isLoading: true,
      isAuthenticated: false,
    });
  });

  it("returns authenticated state and persists the role when auth.me resolves", async () => {
    useQueryMock.mockReturnValue({
      data: {
        userId: "a0000000-0000-4000-8000-000000000099",
        email: "head@customreport.local",
        name: "Department Head",
        lastName: "Head",
        firstName: "Department",
        middleName: "Operations",
        role: "head",
        activeReportId: "a0000000-0000-4000-8000-000000000001",
        activeReportSectionId: null,
        reportingGroupName: "Software Development",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      id: "a0000000-0000-4000-8000-000000000099",
      name: "Department Head",
      lastName: "Head",
      firstName: "Department",
      middleName: "Operations",
      email: "head@customreport.local",
      role: "head",
      reportingGroupName: "Software Development",
    });
    await waitFor(() =>
      expect(writeLastRoleMock).toHaveBeenCalledWith({
        role: "head",
        email: "head@customreport.local",
        name: "Department Head",
      }),
    );
    expect(writeLastRoleMock).toHaveBeenCalledTimes(1);
  });

  it("hydrates organization onto SessionState when auth.me carries it", () => {
    useQueryMock.mockReturnValue({
      data: {
        userId: "a0000000-0000-4000-8000-000000000099",
        email: "head@customreport.local",
        name: "Department Head",
        role: "head",
        activeReportId: "a0000000-0000-4000-8000-000000000001",
        activeReportSectionId: null,
        organization: {
          shortName: "Demo",
          fullName: "Example Software Department",
        },
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current.organization).toEqual({
      shortName: "Demo",
      fullName: "Example Software Department",
    });
  });

  it("returns unauthenticated state when auth.me resolves with null", () => {
    useQueryMock.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current).toEqual({
      user: null,
      organization: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it("blocks protected content and retries when auth.me fails", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useQueryMock.mockReturnValue({
      data: undefined,
      error: new Error("network unavailable"),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* expected client error telemetry */
    });

    render(
      <SessionProvider>
        <p>Protected report</p>
      </SessionProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not verify your session.",
    );
    expect(screen.queryByText("Protected report")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("throws a clear error when useSession() is called outside the provider", () => {
    useQueryMock.mockReturnValue({ data: null, isLoading: false });

    // Suppress React's error boundary console noise for this expected throw.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* intentionally empty: suppresses React error-boundary console noise for this expected throw */
    });

    expect(() => renderHook(() => useSession())).toThrow(
      /useSession must be used within <SessionProvider>/,
    );

    errorSpy.mockRestore();
  });
});
