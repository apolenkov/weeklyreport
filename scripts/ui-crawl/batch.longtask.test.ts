/// <reference lib="dom" />
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { type BatchOutcome, pressBatch } from "./batch.ts";
import type { Browser } from "./driver.ts";
import type { ProbedControl } from "./probe.ts";

const control: ProbedControl = {
  selector: "#inspect",
  tag: "button",
  role: "button",
  name: "Inspect health",
  type: "button",
  href: null,
  disabled: false,
  selected: false,
  alternatives: [],
  bounds: { x: 0, y: 0, width: 100, height: 30 },
  clipped: false,
  obstructedBy: null,
};

/** Browsers without longtask timing reject the type in observe(), everything else works. */
class NoLongTaskObserver {
  observe = (options: { type: string }): void => {
    if (options.type === "longtask")
      throw new TypeError("longtask is not a valid observation type");
  };
  takeRecords = (): never[] => [];
  disconnect = (): void => undefined;
}

/** A browser that supports longtask; the fake never delivers entries, so durations stay empty. */
class LongTaskObserver {
  observe = (): void => undefined;
  takeRecords = (): never[] => [];
  disconnect = (): void => undefined;
}

function fakeBrowser(): { browser: Browser; source: () => string } {
  let source = "";
  const browser: Browser = {
    session: "longtask-test",
    profile: new Map(),
    stalls: [],
    restarts: [],
    close: () => undefined,
    batch: () => [],
    evaluate: (script: string): unknown => {
      source = script;
      return null;
    },
  };
  return { browser, source: () => source };
}

interface Realm {
  __crawlDone: Promise<BatchOutcome>;
  __crawl2: { longSupported: boolean };
}

/** Runs the generated batch script in a fresh iframe realm whose PerformanceObserver is the given fake. */
async function pressWithObserver(
  observer: unknown,
): Promise<{ outcome: BatchOutcome; longSupported: boolean }> {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const pageWindow = iframe.contentWindow;
  const pageDocument = iframe.contentDocument;
  if (!pageWindow || !pageDocument)
    throw new Error("Missing JSDOM iframe realm");
  const button = pageDocument.createElement("button");
  button.id = "inspect";
  button.textContent = "Inspect health";
  pageDocument.body.append(button);
  const rect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 30,
    width: 100,
    height: 30,
  };
  // jsdom performs no layout: give the pressed control a real box...
  button.getBoundingClientRect = (): DOMRect => rect as unknown as DOMRect;
  // ...text for the state signature (jsdom has no innerText)...
  const realmHTMLElement = (
    pageWindow as unknown as {
      HTMLElement: { prototype: HTMLElement };
    }
  ).HTMLElement;
  Object.defineProperty(realmHTMLElement.prototype, "innerText", {
    get(this: HTMLElement) {
      return this.textContent;
    },
    configurable: true,
  });
  // ...and a hit test that finds the pressed control, so it is not reported obstructed.
  pageDocument.elementsFromPoint = (): Element[] => [button];
  Object.defineProperty(pageWindow, "fetch", {
    value: () => Promise.reject(new TypeError("offline")),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(pageWindow, "PerformanceObserver", {
    value: observer,
    configurable: true,
  });
  const { browser, source } = fakeBrowser();
  pressBatch(browser, [control], {
    budgetMs: 1000,
    maxQuietMs: 100,
    mode: "quick",
  });
  const script = pageDocument.createElement("script");
  script.textContent = `window.__crawlDone = (${source()});`;
  pageDocument.body.append(script);
  const realm = pageWindow as unknown as Realm;
  try {
    const outcome = await realm.__crawlDone;
    return { outcome, longSupported: realm.__crawl2.longSupported };
  } finally {
    script.remove();
    iframe.remove();
  }
}

describe("longtask timing support", () => {
  it("reports blockedMs as null when the browser cannot observe longtask", async () => {
    const { outcome, longSupported } =
      await pressWithObserver(NoLongTaskObserver);

    expect(longSupported).toBe(false);
    expect(outcome.results[0]?.status).toBe("ok");
    expect(outcome.results[0]?.blockedMs).toBeNull();
  });

  it("keeps a numeric blockedMs when longtask is supported", async () => {
    const { outcome, longSupported } =
      await pressWithObserver(LongTaskObserver);

    expect(longSupported).toBe(true);
    expect(outcome.results[0]?.status).toBe("ok");
    expect(outcome.results[0]?.blockedMs).toBeTypeOf("number");
  });
});
