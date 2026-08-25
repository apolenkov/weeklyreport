import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ActionNavigationPage,
  expectedActionNavigationFor,
  observeActionNavigation,
} from "./control-actions/action-navigation-boundary.ts";
import {
  type AppReadyArgument,
  type AppReadyPage,
  isExpectedNavigationAbort,
  navigate,
  navigateReveal,
  type NavigationPage,
  type NavigationSettlePage,
  settleNavigation,
  waitForAppReady,
} from "./navigation.ts";

const APP_READY_ARGUMENT: AppReadyArgument = {
  rootSelector: "#main-content",
  loadingSelector:
    '[aria-busy="true"], [data-slot="skeleton"], .skeleton, .animate-pulse',
};

class FakeElement {
  constructor(
    readonly attributes: Readonly<Record<string, string>> = {},
    readonly hasHeading = false,
    readonly descendants: readonly FakeElement[] = [],
    readonly clientRects: readonly object[] = [{}],
  ) {}

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  getClientRects(): readonly object[] {
    return this.clientRects;
  }

  querySelector(selector: string): FakeElement | null {
    return selector === "h1" && this.hasHeading ? new FakeElement() : null;
  }

  querySelectorAll(selector: string): readonly FakeElement[] {
    const selectors = selector.split(",").map((candidate) => candidate.trim());
    const descendants = this.descendants.flatMap((descendant) => [
      descendant,
      ...descendant.querySelectorAll(selector),
    ]);
    return descendants.filter((descendant) =>
      selectors.some((candidate) => descendant.matches(candidate)),
    );
  }

  matches(selector: string): boolean {
    const classes = this.attributes.class?.split(/\s+/u) ?? [];
    return (
      (selector === '[aria-busy="true"]' &&
        this.getAttribute("aria-busy")?.toLocaleLowerCase() === "true") ||
      (selector === '[data-slot="skeleton"]' &&
        this.getAttribute("data-slot") === "skeleton") ||
      (selector === ".skeleton" && classes.includes("skeleton")) ||
      (selector === ".animate-pulse" && classes.includes("animate-pulse"))
    );
  }
}

function headedMain(descendants: readonly FakeElement[] = []): FakeElement {
  return new FakeElement(
    { "aria-busy": "false", "aria-hidden": "false" },
    true,
    descendants,
  );
}

async function evaluateReady(main: FakeElement): Promise<boolean> {
  let predicate: ((argument: AppReadyArgument) => boolean) | undefined;
  let argument: AppReadyArgument | undefined;
  const page = {
    waitForFunction: (
      candidate: (argument: AppReadyArgument) => boolean,
      candidateArgument?: AppReadyArgument,
    ) => {
      predicate = candidate;
      argument = candidateArgument;
      return Promise.resolve();
    },
  } satisfies AppReadyPage;
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("document", {
    querySelector: (selector: string) =>
      selector === "#main-content" ? main : null,
  });

  await waitForAppReady(page);

  if (predicate === undefined)
    throw new Error("waitForAppReady did not provide a predicate");
  if (argument === undefined)
    throw new Error("waitForAppReady did not provide a predicate argument");
  return predicate(argument);
}

function fakePage(
  gotoError: Error,
  finalUrl = "http://127.0.0.1:3105/head/dashboard",
): NavigationPage {
  const currentUrl = vi
    .fn<() => string>()
    .mockReturnValueOnce("http://127.0.0.1:3105/")
    .mockReturnValue(finalUrl);
  const resolved = () => Promise.resolve();
  return {
    url: currentUrl,
    goto: () => Promise.reject(gotoError),
    waitForURL: (predicate: (url: URL) => boolean) =>
      predicate(new URL(finalUrl))
        ? Promise.resolve()
        : Promise.reject(
            new Error("final URL predicate rejected the settled navigation"),
          ),
    waitForLoadState: resolved,
    waitForFunction: resolved,
  } satisfies NavigationPage;
}

const navigationProbeFor = (currentUrl: string, status: number) => {
  const goto = vi.fn(() => Promise.resolve({ status: () => status }));
  const waitForLoadState = vi.fn(() => Promise.resolve());
  const waitForFunction = vi.fn(() => Promise.resolve());
  return {
    page: {
      url: () => currentUrl,
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

describe("runtime navigation recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("requires the app heading to be inside main content", async () => {
    await expect(evaluateReady(new FakeElement())).resolves.toBe(false);
  });

  it.each([
    new FakeElement({ "data-slot": "skeleton" }),
    new FakeElement({ class: "skeleton" }),
    new FakeElement({ "aria-busy": "true" }),
    new FakeElement({
      class: "h-4 w-20 animate-pulse rounded bg-[var(--color-border)]",
    }),
    new FakeElement({
      class: "h-64 w-full animate-pulse rounded-md bg-muted/50",
    }),
  ])("rejects ready state with a visible loading marker", async (marker) => {
    await expect(evaluateReady(headedMain([marker]))).resolves.toBe(false);
  });

  it("accepts headed content with hidden loading markers", async () => {
    const markers = [
      new FakeElement({ "data-slot": "skeleton", "aria-hidden": "true" }),
      new FakeElement({ class: "skeleton" }, false, [], []),
      new FakeElement({ "aria-busy": "true", "aria-hidden": "true" }),
    ];
    await expect(evaluateReady(headedMain(markers))).resolves.toBe(true);
  });

  it("rejects busy and hidden main roots", async () => {
    for (const attribute of ["aria-busy", "aria-hidden"] as const) {
      await expect(
        evaluateReady(new FakeElement({ [attribute]: "true" }, true)),
      ).resolves.toBe(false);
    }
  });

  it("requires two consecutive ready checks after a route settles", async () => {
    const waitForFunction = vi.fn(() => Promise.resolve());
    const page = { waitForFunction } satisfies AppReadyPage;

    await waitForAppReady(page);

    expect(waitForFunction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      APP_READY_ARGUMENT,
      { polling: "raf", timeout: 10_000 },
    );
    expect(waitForFunction).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      APP_READY_ARGUMENT,
      { polling: "raf", timeout: 10_000 },
    );
  });

  it("propagates readiness timeout errors without a retry", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    const waitForFunction = vi.fn(() => Promise.reject(timeout));
    const page = { waitForFunction } satisfies AppReadyPage;

    await expect(waitForAppReady(page)).rejects.toBe(timeout);
    expect(waitForFunction).toHaveBeenCalledTimes(1);
  });

  it("navigates a relative route from the initial blank page", async () => {
    const { page, goto, waitForLoadState, waitForFunction } =
      navigationProbeFor("about:blank", 200);

    await expect(navigate(page, "/head")).resolves.toBe(200);
    expect(goto).toHaveBeenCalledWith("/head", {
      waitUntil: "domcontentloaded",
    });
    expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
      timeout: 3000,
    });
    expect(waitForFunction).toHaveBeenCalledTimes(2);
  });

  it("keeps reveal replay off network-idle but waits for finite UI transitions", async () => {
    const { page, goto, waitForLoadState, waitForFunction } =
      navigationProbeFor("http://127.0.0.1:3105/head", 204);

    await expect(navigateReveal(page, "/head")).resolves.toBe(204);
    expect(goto).toHaveBeenCalledWith("/head", {
      waitUntil: "domcontentloaded",
    });
    expect(waitForLoadState).not.toHaveBeenCalled();
    expect(waitForFunction).toHaveBeenCalledTimes(2);
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
