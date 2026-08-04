import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import { isExpectedNavigationAbort, navigate } from "./navigation.ts";

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

  it("does not classify arbitrary navigation errors as redirect aborts", async () => {
    const error = new Error("page.goto: ECONNREFUSED");
    const page = fakePage(error);

    await expect(navigate(page, "/")).rejects.toBe(error);
    expect(isExpectedNavigationAbort(error)).toBe(false);
    expect(isExpectedNavigationAbort(new Error("net::ERR_ABORTED"))).toBe(true);
  });
});
