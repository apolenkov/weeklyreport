import type { DomInventory } from "../../replay/dom/dom-inventory.ts";
import {
  type NavigationSettlePage,
  settleNavigation,
} from "../../replay/navigation.ts";

export interface RevealExecutionObservation {
  readonly inventory: DomInventory;
  readonly url: string;
}

export interface RevealExecutionObservationPage extends NavigationSettlePage {
  readonly url: () => string;
}

export const captureRevealExecutionObservation = async (
  input: Readonly<{
    readonly inventory: () => Promise<DomInventory>;
    readonly page: RevealExecutionObservationPage;
  }>,
): Promise<RevealExecutionObservation> => {
  const initialUrl = input.page.url();
  const inventory = await input.inventory();
  if (input.page.url() === initialUrl) return { inventory, url: initialUrl };

  await settleNavigation(input.page);
  const settledUrl = input.page.url();
  const settledInventory = await input.inventory();
  if (input.page.url() !== settledUrl)
    throw new Error("Reveal URL changed during settled inventory capture");
  return { inventory: settledInventory, url: settledUrl };
};
