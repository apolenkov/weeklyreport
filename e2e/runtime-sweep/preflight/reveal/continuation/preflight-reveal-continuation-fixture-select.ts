import type { DomInventory } from "../../../replay/dom/dom-inventory.ts";
import type { RevealExecutionHarness } from "../interaction/preflight-reveal-types.ts";

export const DEFAULT_SELECT_REPRESENTATIVE = {
  kind: "select",
  value: "parent-product",
  index: 1,
} as const;

export type SelectRepresentative = typeof DEFAULT_SELECT_REPRESENTATIVE;

export const selectFreezerFor =
  (input: {
    readonly currentInventory: () => DomInventory;
    readonly events: string[];
    readonly representatives?: Readonly<Record<string, SelectRepresentative>>;
  }): NonNullable<RevealExecutionHarness["freezeRepresentativeInput"]> =>
  ({ action }) => {
    input.events.push(`freeze:${action.controlKey}`);
    if (action.operation !== "select") return Promise.resolve(undefined);
    if (
      !input
        .currentInventory()
        .controls.some(({ controlKey }) => controlKey === action.controlKey)
    )
      return Promise.reject(
        new Error(
          `Select is absent from the live branch: ${action.controlKey}`,
        ),
      );
    return Promise.resolve(
      input.representatives?.[action.controlKey] ??
        DEFAULT_SELECT_REPRESENTATIVE,
    );
  };
