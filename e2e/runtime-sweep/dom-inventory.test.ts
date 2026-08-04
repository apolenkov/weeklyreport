import type { JSHandle, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import { inventoryDom } from "./dom-inventory.ts";

const rawButton = {
  role: "button",
  tagName: "button",
  inputType: null,
  href: null,
  ariaLabel: "Submit",
  labelledByText: null,
  labelText: null,
  title: null,
  imageAlt: null,
  value: null,
  text: "Submit",
  visible: true,
  disabled: false,
} as const;

describe("runtime DOM inventory", () => {
  it("waits for an execution context that survives navigation", async () => {
    const handle = {
      jsonValue: () => Promise.resolve([rawButton]),
      dispose: () => Promise.resolve(),
    } as unknown as JSHandle<readonly (typeof rawButton)[]>;
    const page = {
      evaluate: vi
        .fn()
        .mockRejectedValue(
          new Error("Execution context was destroyed because of a navigation"),
        ),
      waitForFunction: vi.fn().mockResolvedValue(handle),
    } as unknown as Page;

    await expect(inventoryDom(page)).resolves.toMatchObject({
      controls: [{ accessibleName: "Submit", role: "button" }],
      issues: [],
    });
  });
});
