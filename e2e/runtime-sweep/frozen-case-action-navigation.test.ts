import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

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

    await expect(
      settleFrozenActionNavigation(page, boundary, {
        status: "fail",
        controlKey: "link:Status:1",
        reason: "The action produced no immediate DOM outcome",
      }),
    ).resolves.toEqual({
      status: "pass",
      controlKey: "link:Status:1",
      observation: {
        kind: "url",
        detail: "Main-frame navigation observed after the action",
      },
    });
  });
});
