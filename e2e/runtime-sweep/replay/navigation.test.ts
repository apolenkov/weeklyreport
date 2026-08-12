import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ActionNavigationPage,
  expectedActionNavigationFor,
  observeActionNavigation,
} from "./control-actions/action-navigation-boundary.ts";
import {
  type AppReadyPage,
  isExpectedNavigationAbort,
  navigate,
  type NavigationPage,
  type NavigationSettlePage,
  settleNavigation,
  waitForAppReady,
} from "./navigation.ts";

class FakeElement {
  readonly attributes: Readonly<Record<string, string>>;
  readonly hasHeading: boolean;

  constructor(
    attributes: Readonly<Record<string, string>> = {},
    hasHeading = false,
  ) {
    this.attributes = attributes;
    this.hasHeading = hasHeading;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  getClientRects(): readonly object[] {
    return [{}];
  }

  querySelector(selector: string): FakeElement | null {
    return selector === "h1" && this.hasHeading ? new FakeElement() : null;
  }
}

function fakePage(
  gotoError: Error,
  finalUrl = "http://127.0.0.1:3105/head/dashboard",
): NavigationPage {
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
    waitForFunction: () => Promise.resolve(),
  } satisfies NavigationPage;
}

describe("runtime navigation recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("requires the app heading to be inside main content", async () => {
    const main = new FakeElement({
      "aria-busy": "false",
      "aria-hidden": "false",
    });
    const outsideHeading = new FakeElement();
    let predicate: ((selector: string) => boolean) | undefined;
    const page = {
      waitForFunction: (candidate: (selector: string) => boolean) => {
        predicate = candidate;
        return Promise.resolve();
      },
    } satisfies AppReadyPage;
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        selector === "#main-content"
          ? main
          : selector === "h1"
            ? outsideHeading
            : null,
    });

    await waitForAppReady(page);

    expect(predicate?.("#main-content")).toBe(false);
  });

  it("requires two consecutive ready checks after a route settles", async () => {
    const waitForFunction = vi.fn(() => Promise.resolve());
    const page = { waitForFunction } satisfies AppReadyPage;

    await waitForAppReady(page);

    expect(waitForFunction).toHaveBeenCalledTimes(2);
  });

  it("navigates a relative route from the initial blank page", async () => {
    const page = {
      url: () => "about:blank",
      goto: () => Promise.resolve({ status: () => 200 }),
      waitForURL: () => Promise.resolve(),
      waitForLoadState: () => Promise.resolve(),
      waitForFunction: () => Promise.resolve(),
    } satisfies NavigationPage;

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
      waitForFunction: () => Promise.resolve(),
    } satisfies NavigationSettlePage;

    await expect(settleNavigation(page)).rejects.toBe(error);
  });

  it("propagates non-timeout errors from an armed action observer", async () => {
    const error = new Error("browser disconnected");
    const page = {
      url: () => "http://127.0.0.1:3105/report",
      waitForURL: () => Promise.reject(error),
    } satisfies ActionNavigationPage;
    const observer = observeActionNavigation(page);

    await expect(observer.waitForNavigation()).rejects.toBe(error);
  });

  it("uses the deterministic sign-out timeout", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    const waitForURL = vi.fn(() => Promise.reject(timeout));
    const page = {
      url: () => "http://127.0.0.1:3105/report",
      waitForURL,
    } satisfies ActionNavigationPage;
    const expectation = expectedActionNavigationFor("button:Sign%20out:1");
    const observer = observeActionNavigation(page, expectation);
    await expect(observer.waitForNavigation()).resolves.toBe(false);
    expect(waitForURL).toHaveBeenCalledWith(expect.any(Function), {
      timeout: expectation?.timeoutMs,
    });
  });

  it("does not require frame navigation for a same-document skip link", () => {
    expect(
      expectedActionNavigationFor("link:Skip%20to%20content:1"),
    ).toBeUndefined();
  });

  it("does not infer navigation from a button's accessible name", () => {
    expect(expectedActionNavigationFor("button:Document:1")).toBeUndefined();
  });

  it("waits for delayed navigation from generic router controls", async () => {
    const navigation = Promise.withResolvers<void>();
    const pageState = { url: "http://127.0.0.1:3105/report" };
    const page = {
      url: () => pageState.url,
      waitForURL: vi.fn(async (predicate: (url: URL) => boolean) => {
        await navigation.promise;
        pageState.url = "http://127.0.0.1:3105/status";
        if (!predicate(new URL(pageState.url))) {
          throw new Error("Navigation predicate rejected the new URL");
        }
      }),
    } satisfies ActionNavigationPage;
    const expectation = expectedActionNavigationFor("link:Status:1");
    if (expectation === undefined)
      throw new Error("Generic router links must arm navigation observation");
    const observer = observeActionNavigation(page, expectation);
    const waiting = observer.waitForNavigation();
    navigation.resolve();
    await expect(waiting).resolves.toBe(true);
    expect(page.url()).toContain("/status");
  });
});
