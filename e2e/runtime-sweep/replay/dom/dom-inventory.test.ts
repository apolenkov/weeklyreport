import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import { inventoryDom } from "./dom-inventory.ts";

const rawButton = {
  role: "button",
  tagName: "button",
  inputType: null,
  href: null,
  recordStableId: null,
  interactionEffect: null,
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
    const evaluate = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Execution context was destroyed because of a navigation"),
      )
      .mockResolvedValue([rawButton]);
    const page = {
      evaluate,
      waitForLoadState: () => Promise.resolve(),
    } as unknown as Page;

    await expect(inventoryDom(page)).resolves.toMatchObject({
      controls: [{ accessibleName: "Submit", role: "button" }],
      issues: [],
    });
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated browser failures", async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValue(new Error("Browser disconnected"));
    const waitForLoadState = vi.fn();
    const page = { evaluate, waitForLoadState } as unknown as Page;

    await expect(inventoryDom(page)).rejects.toThrow("Browser disconnected");
    expect(evaluate).toHaveBeenCalledOnce();
    expect(waitForLoadState).not.toHaveBeenCalled();
  });

  it("captures declared interaction effects and rejects unknown values", async () => {
    const pageFor = (interactionEffect: string) =>
      ({
        evaluate: () => Promise.resolve([{ ...rawButton, interactionEffect }]),
      }) as unknown as Page;

    await expect(
      inventoryDom(pageFor("mutation-required")),
    ).resolves.toMatchObject({
      controls: [{ interactionEffect: "mutation-required" }],
    });
    await expect(inventoryDom(pageFor("unreviewed"))).rejects.toThrow(
      /unsupported data-interaction-effect/iu,
    );
  });

  it("captures scoped disclosure metadata for continuation proofs", async () => {
    const page = {
      evaluate: () =>
        Promise.resolve([
          {
            ...rawButton,
            ariaControls: "panel-a",
            ariaExpanded: false,
          },
        ]),
    } as unknown as Page;

    await expect(inventoryDom(page)).resolves.toMatchObject({
      controls: [{ ariaControls: "panel-a", ariaExpanded: false }],
    });
  });

  it("rejects an untrusted disclosure-independence declaration", async () => {
    const page = {
      evaluate: () =>
        Promise.resolve([
          { ...rawButton, disclosureIndependence: "unreviewed" },
        ]),
    } as unknown as Page;

    await expect(inventoryDom(page)).rejects.toThrow(
      /unsupported data-reveal-independence/iu,
    );
  });

  it("keeps record lineage separate from accessible control identity", async () => {
    const recordStableId = "88888888-8888-4888-8888-888888888888";
    const page = {
      evaluate: () => Promise.resolve([{ ...rawButton, recordStableId }]),
    } as unknown as Page;

    await expect(inventoryDom(page)).resolves.toMatchObject({
      controls: [
        {
          accessibleName: "Submit",
          controlKey: "button:Submit:1",
          recordStableId,
        },
      ],
    });
  });
});
