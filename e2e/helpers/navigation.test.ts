import { describe, expect, it, vi } from "vitest";

import {
  isExpectedNavigationAbort,
  navigate,
  type NavigationPage,
  type NavigationSettlePage,
  settleNavigation,
} from "./navigation.ts";

const successfulPage = (status: number) => {
  const goto = vi.fn(() => Promise.resolve({ status: () => status }));
  const waitForLoadState = vi.fn(() => Promise.resolve());
  const waitForFunction = vi.fn(() => Promise.resolve());
  return {
    page: {
      url: () => "about:blank",
      goto,
      waitForURL: () => Promise.resolve(),
      waitForLoadState,
      waitForFunction,
    } satisfies NavigationPage,
    goto,
    waitForLoadState,
    waitForFunction,
  };
};

const abortingPage = (
  error: Error,
  finalUrl = "http://127.0.0.1:3105/head/dashboard",
) => {
  const url = vi.fn<() => string>().mockReturnValue("http://127.0.0.1:3105/");
  const waitForURL = vi.fn((predicate: (candidate: URL) => boolean) =>
    predicate(new URL(finalUrl))
      ? Promise.resolve()
      : Promise.reject(new Error("final URL was not accepted")),
  );
  return {
    page: {
      url,
      goto: () => Promise.reject(error),
      waitForURL,
      waitForLoadState: () => Promise.resolve(),
      waitForFunction: () => Promise.resolve(),
    } satisfies NavigationPage,
    waitForURL,
  };
};

describe("acceptance navigation", () => {
  it("returns the navigation status after the app is stable", async () => {
    const { page, goto, waitForLoadState, waitForFunction } =
      successfulPage(200);

    await expect(navigate(page, "/head/dashboard")).resolves.toBe(200);
    expect(goto).toHaveBeenCalledWith("/head/dashboard", {
      waitUntil: "domcontentloaded",
    });
    expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
      timeout: 3000,
    });
    expect(waitForFunction).toHaveBeenCalledTimes(2);
  });

  it.each([
    "page.goto: net::ERR_ABORTED",
    "page.goto: NS_BINDING_ABORTED",
    'Navigation is interrupted by another navigation to "/head/dashboard"',
  ])("waits for the final URL after an expected abort: %s", async (message) => {
    const { page, waitForURL } = abortingPage(new Error(message));

    await expect(navigate(page, "/")).resolves.toBeNull();
    expect(waitForURL).toHaveBeenCalledOnce();
  });

  it("propagates an arbitrary navigation failure", async () => {
    const error = new Error("page.goto: ECONNREFUSED");
    const { page } = abortingPage(error);

    await expect(navigate(page, "/")).rejects.toBe(error);
    expect(isExpectedNavigationAbort(error)).toBe(false);
  });

  it("tolerates only a network-idle timeout", async () => {
    const timeout = Object.assign(new Error("network idle timed out"), {
      name: "TimeoutError",
    });
    const waitForFunction = vi.fn(() => Promise.resolve());
    const page = {
      waitForLoadState: () => Promise.reject(timeout),
      waitForFunction,
    } satisfies NavigationSettlePage;

    await expect(settleNavigation(page)).resolves.toBeUndefined();
    expect(waitForFunction).toHaveBeenCalledTimes(2);
  });

  it("propagates non-timeout settle failures", async () => {
    const error = new Error("browser disconnected");
    const page = {
      waitForLoadState: () => Promise.reject(error),
      waitForFunction: () => Promise.resolve(),
    } satisfies NavigationSettlePage;

    await expect(settleNavigation(page)).rejects.toBe(error);
  });
});
