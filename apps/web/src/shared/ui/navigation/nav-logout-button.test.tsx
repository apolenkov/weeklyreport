// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionTransition from "../../lib/auth/session-transition";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { NavLogoutButton } from "./nav-logout-button";

function renderWithQueryClient(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe("NavLogoutButton", () => {
  const realLocation = window.location;
  const realLocationDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "location",
  );
  const cookieMarkerName = "nav_logout_boundary_check";
  const cookieMarker = `${cookieMarkerName}=ok`;
  const transitionHandles: sessionTransition.SessionTransitionHandle[] = [];
  const originalBeginSessionTransition =
    sessionTransition.beginSessionTransition;
  let beginSessionTransitionSpy: MockInstance<
    typeof sessionTransition.beginSessionTransition
  > | null = null;
  let hrefAssign: ReturnType<typeof vi.fn<(value: string) => void>> = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn> = vi.fn();
  let previousCookieMarker: string | undefined;

  beforeEach(() => {
    transitionHandles.length = 0;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.clearAllMocks();

    hrefAssign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(value: string) {
          hrefAssign(value);
        },
      },
    });

    beginSessionTransitionSpy = vi.spyOn(
      sessionTransition,
      "beginSessionTransition",
    );
    beginSessionTransitionSpy.mockImplementation(() => {
      const transition = originalBeginSessionTransition();
      if (transition) {
        transitionHandles.push(transition);
      }
      return transition;
    });

    previousCookieMarker = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${cookieMarkerName}=`));
    document.cookie = `${cookieMarker}; path=/`;
  });

  afterEach(() => {
    while (transitionHandles.length > 0) {
      const transition = transitionHandles.shift();
      transition?.finish();
    }

    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (beginSessionTransitionSpy) {
      beginSessionTransitionSpy.mockRestore();
      beginSessionTransitionSpy = null;
    }

    if (realLocationDescriptor) {
      Object.defineProperty(window, "location", realLocationDescriptor);
    } else {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: realLocation,
      });
    }

    document.cookie = `${cookieMarkerName}=; Max-Age=0; path=/`;
    if (previousCookieMarker) {
      document.cookie = `${previousCookieMarker}; path=/`;
    }
  });

  it("uses the shared responsive toolbar geometry", () => {
    renderWithQueryClient(<NavLogoutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "min-w-[var(--toolbar-control-h)]",
      "w-10",
    );
  });

  it("keeps transition pending until logout resolves and then redirects to root", async () => {
    const logoutResponse = deferred<{ ok: boolean }>();
    fetchMock = vi
      .fn<() => Promise<{ ok: boolean }>>()
      .mockReturnValue(logoutResponse.promise);
    vi.stubGlobal("fetch", fetchMock);
    renderWithQueryClient(<NavLogoutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    const preClickCookie = document.cookie;
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("nav-logout-spinner")).toHaveClass(
      "animate-spin",
      "motion-reduce:animate-none",
    );
    expect(screen.queryByTestId("nav-logout-icon")).not.toBeInTheDocument();
    expect(hrefAssign).not.toHaveBeenCalled();
    expect(document.cookie).toBe(preClickCookie);

    logoutResponse.resolve({ ok: true });
    await waitFor(() => expect(hrefAssign).toHaveBeenCalledWith("/"));
    expect(hrefAssign).toHaveBeenCalledTimes(1);
    expect(document.cookie).toContain(cookieMarker);
    const transition = transitionHandles.shift();
    expect(transition).toBeDefined();
    transition?.finish();
    expect(sessionTransition.isSessionTransitionActive()).toBe(false);
  });

  it.each([
    {
      label: "non-OK response",
      settle: (request: ReturnType<typeof deferred<{ ok: boolean }>>) =>
        request.resolve({ ok: false }),
    },
    {
      label: "rejected network",
      settle: (request: ReturnType<typeof deferred<{ ok: boolean }>>) =>
        request.reject(new Error("network unavailable")),
    },
  ])("does not redirect when logout fails with $label", async ({ settle }) => {
    const logoutResponse = deferred<{ ok: boolean }>();
    fetchMock = vi
      .fn<() => Promise<{ ok: boolean }>>()
      .mockReturnValue(logoutResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<NavLogoutButton />);
    const button = screen.getByRole("button", { name: "Sign out" });
    const preClickCookie = document.cookie;
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(button).toBeDisabled();
    expect(hrefAssign).not.toHaveBeenCalled();
    expect(document.cookie).toBe(preClickCookie);

    settle(logoutResponse);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(toast.error).toHaveBeenCalledWith(
      "Sign out failed. You are still signed in.",
    );
    expect(hrefAssign).not.toHaveBeenCalled();
    expect(screen.getByTestId("nav-logout-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-logout-spinner")).not.toBeInTheDocument();
    expect(document.cookie).toBe(preClickCookie);
    expect(sessionTransition.isSessionTransitionActive()).toBe(false);
  });
});
