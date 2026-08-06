import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { DomInventory } from "./dom-inventory.ts";
import {
  type FrozenActionNavigationBoundary,
  settleFrozenActionNavigation,
} from "./frozen-case-action-navigation.ts";

describe("frozen action navigation promotion", () => {
  it("removes a stale action failure reason when navigation proves the action", async () => {
    const page = {
      waitForLoadState: () => Promise.resolve(),
      waitForFunction: () => Promise.resolve(),
    } as unknown as Page;
    const boundary: FrozenActionNavigationBoundary = {
      expectation: undefined,
      observer: {
        initialUrl: "http://127.0.0.1:3105/report",
        waitForNavigation: () => Promise.resolve(true),
        cancel: () => undefined,
      },
    };
    const target = {
      controlKey: "link:Status:1",
      domOrderKey: "0001:link:Status:1",
      order: 1,
      role: "link",
      accessibleName: "Status",
      enabled: true,
      disabled: false,
      visible: true,
      tagName: "a",
      inputType: null,
      href: "/status",
    } satisfies DomInventory["controls"][number];

    await expect(
      settleFrozenActionNavigation(page, boundary, {
        status: "fail",
        controlKey: "link:Status:1",
        target,
        reason: "The action produced no immediate DOM outcome",
      }),
    ).resolves.toEqual({
      status: "pass",
      controlKey: "link:Status:1",
      observation: {
        kind: "url",
        detail: "Main-frame navigation observed after the action",
      },
      target,
    });
  });

  it("accepts an idempotent active link without requiring a URL change", async () => {
    const waitForNavigation = vi.fn(() => Promise.resolve(false));
    const boundary: FrozenActionNavigationBoundary = {
      expectation: { timeoutMs: 10_000 },
      observer: {
        initialUrl: "http://127.0.0.1:3105/admin?tab=settings",
        waitForNavigation,
        cancel: () => undefined,
      },
    };
    const outcome = {
      status: "pass" as const,
      controlKey: "link:Settings:1",
      target: {
        controlKey: "link:Settings:1",
        domOrderKey: "0001:link:Settings:1",
        order: 1,
        role: "link",
        accessibleName: "Settings",
        enabled: true,
        disabled: false,
        visible: true,
        tagName: "a",
        inputType: null,
        href: "/admin?tab=settings",
      } satisfies DomInventory["controls"][number],
    };

    await expect(
      settleFrozenActionNavigation({} as Page, boundary, outcome),
    ).resolves.toEqual(outcome);
    expect(waitForNavigation).not.toHaveBeenCalled();
  });

  it("preserves the exact unavailable-control reason", async () => {
    const waitForNavigation = vi.fn(() => Promise.resolve(false));
    const boundary: FrozenActionNavigationBoundary = {
      expectation: { timeoutMs: 10_000 },
      observer: {
        initialUrl: "http://127.0.0.1:3105/admin?tab=settings",
        waitForNavigation,
        cancel: () => undefined,
      },
    };
    const outcome = {
      status: "not-exercised" as const,
      controlKey: "link:Jobs:1",
      reason: "Control is not present in the live DOM",
    };

    await expect(
      settleFrozenActionNavigation({} as Page, boundary, outcome),
    ).resolves.toEqual(outcome);
    expect(waitForNavigation).not.toHaveBeenCalled();
  });
});
