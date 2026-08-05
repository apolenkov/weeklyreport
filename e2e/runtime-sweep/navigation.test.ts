import type { Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  expectedActionNavigationFor,
  observeActionNavigation,
} from "./action-navigation-boundary.ts";
import {
  isExpectedNavigationAbort,
  navigate,
  settleNavigation,
} from "./navigation.ts";

function fakePage(
  gotoError: Error,
  finalUrl = "http://127.0.0.1:3105/head/dashboard",
): Page {
  const currentUrl = vi
    .fn<() => string>()
    .mockReturnValueOnce("http://127.0.0.1:3105/")
    .mockReturnValue(finalUrl);
  return {
    url: currentUrl,
    goto: () => Promise.reject(gotoError),
    waitForURL: (predicate: (url: URL) => boolean) => {
      if (!predicate(new URL(finalUrl))) {
        throw new Error("final URL predicate rejected the settled navigation");
      }
      return Promise.resolve();
    },
    waitForLoadState: () => Promise.resolve(),
  } as unknown as Page;
}

describe("runtime navigation recovery", () => {
  afterEach(() => vi.useRealTimers());

  it("navigates a relative route from the initial blank page", async () => {
    const page = {
      url: () => "about:blank",
      goto: () => Promise.resolve({ status: () => 200 }),
      waitForLoadState: () => Promise.resolve(),
    } as unknown as Page;

    await expect(navigate(page, "/head")).resolves.toBe(200);
  });

  it("waits for the final URL after a client redirect abort", async () => {
    const page = fakePage(
      new Error("page.goto: net::ERR_ABORTED at http://127.0.0.1:3105/"),
    );

    await expect(navigate(page, "/")).resolves.toBeNull();
    expect(page.url()).toBe("http://127.0.0.1:3105/head/dashboard");
  });

  it("waits for the final URL when Playwright reports an interrupted navigation", async () => {
    const page = fakePage(
      new Error(
        'page.goto: Navigation to "http://127.0.0.1:3105/lead/report/1" is interrupted by another navigation to "http://127.0.0.1:3105/?next=%2Flead%2Freport%2F1"',
      ),
    );

    await expect(navigate(page, "/lead/report/1")).resolves.toBeNull();
  });

  it("does not classify arbitrary navigation errors as redirect aborts", async () => {
    const error = new Error("page.goto: ECONNREFUSED");
    const page = fakePage(error);

    await expect(navigate(page, "/")).rejects.toBe(error);
    expect(isExpectedNavigationAbort(error)).toBe(false);
    expect(isExpectedNavigationAbort(new Error("net::ERR_ABORTED"))).toBe(true);
  });

  it("propagates non-timeout errors from the navigation settle boundary", async () => {
    const error = new Error("browser disconnected");
    const page = {
      waitForLoadState: () => Promise.reject(error),
    } as unknown as Page;

    await expect(settleNavigation(page)).rejects.toBe(error);
  });

  it("propagates non-timeout errors from an armed action observer", async () => {
    const error = new Error("browser disconnected");
    const frame = {};
    const page = {
      url: () => "http://127.0.0.1:3105/report",
      mainFrame: () => frame,
      waitForEvent: () => Promise.reject(error),
    } as unknown as Page;
    const observer = observeActionNavigation(page);

    await expect(observer.waitForNavigation()).rejects.toBe(error);
  });

  it("cancels the sign-out observer at its deterministic timeout", async () => {
    vi.useFakeTimers();
    const frame = {};
    let signal: AbortSignal | undefined;
    const page = {
      url: () => "http://127.0.0.1:3105/report",
      mainFrame: () => frame,
      waitForEvent: (
        _event: string,
        options: { readonly signal?: AbortSignal },
      ) => {
        signal = options.signal;
        return new Promise((_resolve, reject) =>
          options.signal?.addEventListener("abort", () => reject(), {
            once: true,
          }),
        );
      },
    } as unknown as Page;
    const expectation = expectedActionNavigationFor("button:Sign%20out:1");
    const observer = observeActionNavigation(page, expectation);
    const waiting = observer.waitForNavigation();

    await vi.advanceTimersByTimeAsync(expectation?.timeoutMs ?? 0);

    await expect(waiting).resolves.toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
