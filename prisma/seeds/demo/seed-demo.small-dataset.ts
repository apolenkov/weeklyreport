// SMALL tier — hand-authored, the demo opener. THREE leads co-own Vasily's
// three products, role-shaped, showing all three health colours at once (BI
// green, Integrations yellow, Portal red). Section order is load-bearing: it
// drives the deterministic row-id sequence of the shared writer.

import { SMALL_LEADS, SMALL_PRODUCTS } from "./seed-demo.small-cast.js";
import { IGOR_SECTIONS } from "./seed-demo.small-igor.js";
import { MARIA_SECTIONS } from "./seed-demo.small-maria.js";
import { VASILY_SECTIONS } from "./seed-demo.small-vasily.js";
import type { TierDataset } from "./seed-demo.types.js";

export const SMALL_DATASET: TierDataset = {
  leads: SMALL_LEADS,
  products: SMALL_PRODUCTS,
  sections: [...VASILY_SECTIONS, ...MARIA_SECTIONS, ...IGOR_SECTIONS],
};
